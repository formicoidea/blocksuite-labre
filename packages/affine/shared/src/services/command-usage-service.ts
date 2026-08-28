import {
  type CommandUsageStore,
  CommandUsageIdentifier,
  type AnyCommandDescriptor,
} from '@labre/std';
import type { ExtensionType } from '@labre/store';

/**
 * Where `createLocalCommandUsageStore` persists. Namespaced like the rest of
 * Labre's browser-local state, and versionless on purpose: the shape is two
 * numbers per command, and a reader that does not recognise an entry drops it.
 */
export const COMMAND_USAGE_KEY = 'labre:command-usage';

/**
 * Enough for every command of every framework several times over (the registry
 * holds 76 today), small enough that the JSON stays a few kilobytes. Overflow
 * evicts the least recently used entry, so the measure a ranking cares about —
 * what this user reached for lately — is the last thing lost.
 */
const MAX_ENTRIES = 200;

/** `{ c: count, t: lastUsedAt }` — short keys, this is written on every run. */
interface StoredEntry {
  c: number;
  t: number;
}

type StoredUsage = Record<string, StoredEntry>;

/**
 * `localStorage` throws outright in a few environments (private mode quotas,
 * sandboxed frames, some test runners), and a usage measure is never important
 * enough to take a command down with it — every access is therefore
 * best-effort. Same rule and same shape as the icon picker's recent store.
 */
const storage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const readUsage = (): StoredUsage => {
  try {
    const raw = storage()?.getItem(COMMAND_USAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    // Entry by entry: one corrupted record must not discard the whole table.
    const usage: StoredUsage = {};
    for (const [id, value] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      const { c, t } = (value ?? {}) as Partial<StoredEntry>;
      if (typeof c === 'number' && typeof t === 'number') usage[id] = { c, t };
    }
    return usage;
  } catch {
    return {};
  }
};

const writeUsage = (usage: StoredUsage): void => {
  try {
    storage()?.setItem(COMMAND_USAGE_KEY, JSON.stringify(usage));
  } catch {
    // best-effort: this session keeps working, the measure just misses a run
  }
};

/** Keeps the {@link MAX_ENTRIES} most recently used entries, nothing else. */
const evictOverflow = (usage: StoredUsage): StoredUsage => {
  const ids = Object.keys(usage);
  if (ids.length <= MAX_ENTRIES) return usage;
  const kept = ids
    .sort((a, b) => usage[b].t - usage[a].t)
    .slice(0, MAX_ENTRIES);
  return Object.fromEntries(kept.map(id => [id, usage[id]]));
};

/**
 * The default {@link CommandUsageStore}: recency and frequency in this
 * browser's `localStorage`, per command id.
 *
 * It measures only. Nothing ranks anything here — PF6's "seven most-recent +
 * six most-used" sub-menu reads these numbers, and a host that
 * wants the measure to follow the user across devices replaces the whole store
 * through {@link CommandUsageExtension}.
 */
export function createLocalCommandUsageStore(): CommandUsageStore {
  return {
    record: (command: AnyCommandDescriptor) => {
      const usage = readUsage();
      const previous = usage[command.id];
      usage[command.id] = { c: (previous?.c ?? 0) + 1, t: Date.now() };
      writeUsage(evictOverflow(usage));
    },
    statsOf: (commandId: string) => {
      const entry = readUsage()[commandId];
      return entry ? { count: entry.c, lastUsedAt: entry.t } : undefined;
    },
  };
}

/**
 * Host override seam: replace the browser-local measure with the host's own.
 *
 * This is where a host persists command usage in ITS database — so the ranking
 * follows the user from laptop to browser to tablet instead of restarting at
 * zero, which is exactly what a "most-used" sub-menu is judged on. The library
 * ships the local store as the default (`CommandUsageViewExtension`) and never
 * requires a host to care.
 *
 * Mirrors `EditorSettingExtension` / `KeymapOverrideExtension`: `di.override`,
 * so a host registering after the library's own extensions always wins.
 */
export function CommandUsageExtension(store: CommandUsageStore): ExtensionType {
  return {
    setup: di => {
      di.override(CommandUsageIdentifier, () => store);
    },
  };
}
