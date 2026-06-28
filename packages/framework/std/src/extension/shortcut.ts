import { IS_MAC } from '@labre/global/env';
import type { ExtensionType } from '@labre/store';

import type { UIEventHandler } from '../event/index.js';
import {
  ShortcutConflictReporterIdentifier,
  ShortcutIdentifier,
  ShortcutOverrideIdentifier,
} from '../identifier.js';
import type { BlockStdScope } from '../scope/index.js';
import { KeymapExtension } from './keymap.js';

export type ShortcutScope = 'global' | 'page' | 'edgeless';

/**
 * An enumerable, rebindable keyboard shortcut. A descriptor is both a manifest
 * entry (for a host "Shortcuts" settings panel) and the source of the actual
 * binding. The `handler` is a factory receiving the std scope (mirroring
 * {@link KeymapExtension}); the manifest the host consumes only needs the
 * metadata fields, not the handler.
 */
export interface ShortcutDescriptor {
  /** Stable id, e.g. `'undo'`, `'wardley.addNode'`. */
  id: string;
  /** i18n key; the label is resolved by the host. */
  labelKey: string;
  /** Default key combos per platform, each as an array, e.g. `['Mod', 'z']`. */
  defaultKeys: { mac: string[]; other: string[] };
  scope: ShortcutScope;
  /** `'core'` or the owning optional-block flag, for per-framework filtering. */
  owner: string;
  /** Optional activation context (host-interpreted). */
  when?: string;
  handler: (std: BlockStdScope) => UIEventHandler;
}

/** Host-provided rebinding table: combo array per id, or `'disabled'`. */
export type ShortcutOverrides = Record<string, string[] | 'disabled'>;

export interface ShortcutConflict {
  /** Canonical combo that more than one shortcut resolved to. */
  combo: string;
  scope: ShortcutScope;
  /** Ids competing for the combo (first is the one actually bound). */
  ids: string[];
}

export type ShortcutConflictReporter = (conflicts: ShortcutConflict[]) => void;

let _shortcutId = 1;

/**
 * Register shortcut descriptors. Each becomes a manifest entry and, once the
 * installer ({@link ShortcutKeymapExtension}) runs, an effective binding.
 */
export function ShortcutExtension(
  descriptors: ShortcutDescriptor[]
): ExtensionType {
  return {
    setup: di => {
      descriptors.forEach(descriptor => {
        di.addImpl(ShortcutIdentifier(`Shortcut-${_shortcutId++}`), descriptor);
      });
    },
  };
}

const platformKeys = (d: ShortcutDescriptor) =>
  IS_MAC ? d.defaultKeys.mac : d.defaultKeys.other;

/**
 * Canonicalize a combo (array of keys) so equivalent spellings compare equal:
 * modifiers are lowercased/sorted and `Mod` resolves to the platform modifier;
 * the final key is lowercased (Shift is a separate modifier).
 */
export function canonicalCombo(keys: string[]): string {
  const key = (keys.at(-1) ?? '').toLowerCase();
  const mods = keys
    .slice(0, -1)
    .map(m => {
      const l = m.toLowerCase();
      if (l === 'mod') return IS_MAC ? 'meta' : 'ctrl';
      if (l === 'cmd' || l === 'm' || l === 'meta') return 'meta';
      if (l === 'control' || l === 'c' || l === 'ctrl') return 'ctrl';
      if (l === 'a' || l === 'alt') return 'alt';
      if (l === 's' || l === 'shift') return 'shift';
      return l;
    })
    .sort();
  return [...mods, key].join('-');
}

/**
 * Build the effective keymap for one scope from the registered descriptors and
 * the override table. `'disabled'` ids are dropped; combo conflicts within the
 * scope are reported (and only the first descriptor for a combo is bound — the
 * duplicates are never bound silently).
 */
export function resolveKeymap(
  descriptors: ShortcutDescriptor[],
  overrides: ShortcutOverrides,
  scope: ShortcutScope,
  std: BlockStdScope
): { keymap: Record<string, UIEventHandler>; conflicts: ShortcutConflict[] } {
  const keymap: Record<string, UIEventHandler> = {};
  const conflicts: ShortcutConflict[] = [];
  const boundBy = new Map<string, string>(); // canonical combo -> bound id

  for (const d of descriptors) {
    if (d.scope !== scope) continue;
    const override = overrides[d.id];
    if (override === 'disabled') continue;
    const keys = override ?? platformKeys(d);
    if (!keys.length) continue;

    const canonical = canonicalCombo(keys);
    const existing = boundBy.get(canonical);
    if (existing) {
      const conflict = conflicts.find(c => c.combo === canonical);
      if (conflict) {
        if (!conflict.ids.includes(d.id)) conflict.ids.push(d.id);
      } else {
        conflicts.push({ combo: canonical, scope, ids: [existing, d.id] });
      }
      continue; // do not silently bind a second action to the same combo
    }

    boundBy.set(canonical, d.id);
    keymap[keys.join('-')] = d.handler(std);
  }

  return { keymap, conflicts };
}

/**
 * Install the effective keymap for a scope. Reads every registered
 * {@link ShortcutDescriptor} plus the host override table, resolves conflicts,
 * and binds via the normal dispatcher keymap mechanism. Re-runs whenever the
 * specs are rebuilt (e.g. a framework is toggled on/off).
 *
 * Only `'global'` scope is wired today; `'page'`/`'edgeless'` scoping is a
 * follow-up.
 */
export function ShortcutKeymapExtension(
  scope: ShortcutScope = 'global'
): ExtensionType {
  // No flavour/blockId option → a global keymap (like `fallbackKeymap`).
  return KeymapExtension(std => {
    const descriptors = [...std.provider.getAll(ShortcutIdentifier).values()];
    const overrides = std.getOptional(ShortcutOverrideIdentifier) ?? {};
    const { keymap, conflicts } = resolveKeymap(
      descriptors,
      overrides,
      scope,
      std
    );
    if (conflicts.length) {
      const report = std.getOptional(ShortcutConflictReporterIdentifier);
      if (report) report(conflicts);
      else
        console.warn(
          '[shortcut] combo conflicts (duplicates not bound):',
          conflicts
        );
    }
    return keymap;
  });
}
