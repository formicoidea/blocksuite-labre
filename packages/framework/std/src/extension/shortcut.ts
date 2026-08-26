import { IS_MAC } from '@labre/global/env';
import type { ExtensionType } from '@labre/store';

import type { UIEventHandler } from '../event/index.js';
import { tryNormalizeKeyName } from '../event/keymap.js';
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
  /**
   * Default keys per platform, as a **sequence of keystrokes**. Each
   * keystroke is a dash-joined combo, e.g. `['Mod-z']` (single keystroke)
   * or `['w', 'c']` (chord: press `w`, then `c`).
   */
  defaultKeys: { mac: string[]; other: string[] };
  scope: ShortcutScope;
  /** `'core'` or the owning optional-block flag, for per-framework filtering. */
  owner: string;
  /** Optional activation context (host-interpreted). */
  when?: string;
  handler: (std: BlockStdScope) => UIEventHandler;
}

/**
 * Host-provided rebinding table: keystroke sequence per id (same shape as
 * {@link ShortcutDescriptor.defaultKeys}), or `'disabled'`. Tables persisted
 * in the pre-chord v0.29 format (one combo as a modifiers array, e.g.
 * `['Ctrl', 'Shift', 'Z']`) keep working — see {@link normalizeLegacyCombo}.
 */
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
 * Canonicalize one keystroke (dash-joined combo like `'Mod-z'`) so equivalent
 * spellings compare equal: modifiers are lowercased/sorted and `Mod` resolves
 * to the platform modifier; the final key is lowercased (Shift is a separate
 * modifier). Delegates parsing to the runtime keymap parser so canonical
 * equality always matches runtime binding equality (`'Space'` ≡ `' '`, same
 * alias table). Returns `null` for an unparseable keystroke.
 */
function canonicalKeystroke(keystroke: string): string | null {
  const normalized = tryNormalizeKeyName(keystroke);
  if (normalized === null) return null;
  const parts = normalized.split(/-(?!$)/);
  const key = (parts.at(-1) ?? '').toLowerCase();
  const mods = parts
    .slice(0, -1)
    .map(m => m.toLowerCase())
    .sort();
  return [...mods, key].join('-');
}

/**
 * Canonicalize a keystroke sequence (see {@link ShortcutDescriptor.defaultKeys})
 * so equivalent spellings compare equal, e.g. `['Cmd-z']` ≡ `['Meta-z']` and
 * `['w', 'Shift-C']` ≡ `['w', 'shift-c']`. Returns `null` when any keystroke
 * is invalid (unknown modifier) — callers must not bind such a sequence.
 */
export function canonicalCombo(keys: string[]): string | null {
  const strokes = keys.map(canonicalKeystroke);
  if (strokes.some(s => s === null)) return null;
  return strokes.join(' ');
}

const LEGACY_MODIFIER = /^(mod|cmd|meta|ctrl|control|alt|shift)$/i;

/**
 * v0.29 compat: the previous released format expressed ONE combo as a
 * modifiers array (`['Ctrl', 'Shift', 'Z']`). A bare multi-letter modifier
 * name can never be a chord step (lone modifier presses are filtered by the
 * dispatcher), so an array whose leading elements are all bare modifier
 * names is unambiguously the legacy format — fold it into a single
 * keystroke. Single-letter aliases (`c`, `m`, ...) are deliberately NOT
 * folded: they are valid chord prefixes.
 */
export function normalizeLegacyCombo(keys: string[]): string[] {
  if (
    keys.length > 1 &&
    keys.slice(0, -1).every(k => LEGACY_MODIFIER.test(k))
  ) {
    return [keys.join('-')];
  }
  return keys;
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
    const keys = normalizeLegacyCombo(override ?? platformKeys(d));
    if (!keys.length) continue;

    const canonical = canonicalCombo(keys);
    if (canonical === null) {
      // Invalid keystroke (host override typo, unknown modifier): skip the
      // binding instead of letting the keymap installer throw and take the
      // whole scope down.
      console.warn(`[shortcut] invalid keys for "${d.id}" — not bound:`, keys);
      continue;
    }
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
    // A multi-keystroke sequence becomes a space-separated chord binding,
    // resolved by the dispatcher's keymap (see `bindKeymap`).
    keymap[keys.join(' ')] = d.handler(std);
  }

  return { keymap, conflicts };
}

/**
 * Install the effective keymap for a scope. Reads every registered
 * {@link ShortcutDescriptor} plus the host override table, resolves conflicts,
 * and binds via the normal dispatcher keymap mechanism. Re-runs whenever the
 * specs are rebuilt (e.g. a framework is toggled on/off).
 *
 * Scoping works by registration site: `'global'` is installed by the root
 * view extension for every editor, while `'page'`/`'edgeless'` installers are
 * registered only in the matching view-extension branch, so their shortcuts
 * exist only when that editor mode is active.
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
