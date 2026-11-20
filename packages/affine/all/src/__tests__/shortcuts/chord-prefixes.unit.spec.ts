import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RESERVED_EDGELESS_KEYS } from '@labre/affine-block-root';
import {
  type AnyCommandDescriptor,
  canonicalCombo,
  type FrameworkId,
} from '@labre/std';
import { describe, expect, test } from 'vitest';

import { getCommands } from '../../commands.js';
import { FRAMEWORK_DESCRIPTORS } from '../../frameworks.js';

/**
 * The framework chord prefixes (`docs/adr/0055`), held by tests because the
 * keymap engine enforces none of it.
 *
 * A framework spells its prefix twice: as its own package constant, which
 * builds its chords through `frameworkChord`, and as
 * `FrameworkDescriptor.chordPrefix` in `frameworks.ts`, which the package
 * cannot import. Nothing at runtime compares the two, and nothing at runtime
 * notices a prefix that shadows a single-key tool: `resolveKeymap` only
 * reports two ids on the SAME combo, and `bindKeymap`'s "a single binding on
 * the prefix wins" sees its own keymap only, while the tool letters are bound
 * by a different one (`edgeless-keyboard.ts`, the toolbar buttons). A chord
 * on `t` would have changed what the Text tool's `t` does, silently; that is
 * the collision this file exists to refuse.
 *
 * It replaces the two chord tests of `registry.unit.spec.ts`, which assumed
 * every prefix was unique: the two DDD boards share `d` by product decision.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
// …/packages/affine/all/src/__tests__/shortcuts → repo root is 6 levels up.
const ROOT = join(HERE, '..', '..', '..', '..', '..', '..');

/**
 * The prefixes MEANT to be shared, and by whom. The only entry is the product
 * owner's "DDD: `d`", over the two DDD boards that ship chords; a third
 * framework landing on `d`, or any other accidental share, fails below.
 */
const SHARED_PREFIXES: Record<string, readonly FrameworkId[]> = {
  d: ['ddd-context-map', 'ddd-core-domain'],
};

/**
 * Bare letters a toolbar button binds on the edgeless root for itself, through
 * its own `bindHotKey` — outside `edgeless-keyboard.ts`, so outside
 * `RESERVED_EDGELESS_KEYS` and its mirror test. Mirrored against the sources
 * by the last test of this file.
 */
const TOOLBAR_BARE_KEYS = [
  { key: 'm', file: 'packages/affine/gfx/mindmap/src/toolbar/mindmap-menu.ts' },
  {
    key: 'm',
    file: 'packages/affine/gfx/mindmap/src/toolbar/mindmap-tool-button.ts',
  },
  {
    key: 's',
    file: 'packages/affine/gfx/shape/src/draggable/shape-draggable.ts',
  },
] as const;

const commands = getCommands();
const isFrameworkOwned = (c: AnyCommandDescriptor) => c.owner !== 'core';
const hasKeys = (c: AnyCommandDescriptor) =>
  c.defaultKeys.mac.length > 0 || c.defaultKeys.other.length > 0;
const chords = commands.filter(c => isFrameworkOwned(c) && hasKeys(c));
const prefixOf = (id: FrameworkId) =>
  FRAMEWORK_DESCRIPTORS.find(d => d.id === id)?.chordPrefix;

describe('framework chord prefixes', () => {
  /**
   * The allocation itself, so a moved letter is a reviewed diff. `ddd-event-
   * storming` has none because the requested `t` is the Text tool, `c4`
   * because nobody asked for one.
   */
  test('the allocated prefixes are the decided ones', () => {
    expect(
      Object.fromEntries(FRAMEWORK_DESCRIPTORS.map(d => [d.id, d.chordPrefix]))
    ).toEqual({
      wardley: 'w',
      edgy: 'g',
      'cynefin-estuarine': 'y',
      bpmn: 'b',
      'ddd-event-storming': undefined,
      c4: undefined,
      'ddd-core-domain': 'd',
      'ddd-context-map': 'd',
      uml: 'u',
    });
  });

  test('a framework chord is its declared prefix then one key, on both platforms', () => {
    for (const command of chords) {
      const prefix = prefixOf(command.owner as FrameworkId);
      expect(prefix, `${command.owner} has chords but no prefix`).toBeTruthy();
      expect(command.defaultKeys.mac, command.id).toEqual(
        command.defaultKeys.other
      );
      expect(command.defaultKeys.other.length, command.id).toBe(2);
      expect(command.defaultKeys.other[0], command.id).toBe(prefix);
    }
  });

  test('a declared prefix has a chord behind it', () => {
    for (const { id, chordPrefix } of FRAMEWORK_DESCRIPTORS) {
      if (chordPrefix === undefined) continue;
      expect(
        chords.some(c => c.owner === id),
        `${id} allocates "${chordPrefix}" for nothing`
      ).toBe(true);
    }
  });

  test('a prefix is shared only where the sharing is declared', () => {
    const owners = new Map<string, FrameworkId[]>();
    for (const { id, chordPrefix } of FRAMEWORK_DESCRIPTORS) {
      if (chordPrefix === undefined) continue;
      owners.set(chordPrefix, [...(owners.get(chordPrefix) ?? []), id]);
    }
    for (const [prefix, ids] of owners) {
      if (ids.length === 1) continue;
      expect(
        [...ids].sort(),
        `"${prefix}" is shared by ${ids.join(', ')}`
      ).toEqual([...(SHARED_PREFIXES[prefix] ?? [])].sort());
    }
    // …and a declared share still holds: no stale entry in the table above.
    for (const [prefix, ids] of Object.entries(SHARED_PREFIXES)) {
      expect(owners.get(prefix)?.sort(), prefix).toEqual([...ids].sort());
    }
  });

  test('second keys are unique within a prefix, across every framework sharing it', () => {
    const seen = new Map<string, string>();
    for (const command of chords) {
      const combo = command.defaultKeys.other.join(' ');
      expect(seen.get(combo), `${command.id} reuses "${combo}"`).toBe(
        undefined
      );
      seen.set(combo, command.id);
    }
  });

  test('a second key is one lowercase letter or digit', () => {
    // Accepts `c` or `7`; rejects `C` (a Shift stroke the chord matcher reads
    // as `Shift-C`), `Mod-c` and `Escape`.
    const SECOND_KEY = /^[a-z0-9]$/;
    for (const command of chords) {
      expect(command.defaultKeys.other[1], command.id).toMatch(SECOND_KEY);
    }
  });

  test('no prefix is a single-key shortcut', () => {
    const singles = new Set<string | null>([
      ...RESERVED_EDGELESS_KEYS.map(k => canonicalCombo([k])),
      ...TOOLBAR_BARE_KEYS.map(({ key }) => canonicalCombo([key])),
      ...commands.flatMap(c =>
        [c.defaultKeys.mac, c.defaultKeys.other]
          .filter(keys => keys.length === 1)
          .map(keys => canonicalCombo(keys))
      ),
    ]);
    for (const { id, chordPrefix } of FRAMEWORK_DESCRIPTORS) {
      if (chordPrefix === undefined) continue;
      expect(
        singles.has(canonicalCombo([chordPrefix])),
        `${id}'s prefix "${chordPrefix}" is already a single-key shortcut`
      ).toBe(false);
    }
  });

  test('no chord collides with any other registered shortcut', () => {
    const boundBy = new Map<string, string[]>();
    for (const c of commands) {
      for (const keys of new Set([
        c.defaultKeys.mac.join(' '),
        c.defaultKeys.other.join(' '),
      ])) {
        if (!keys) continue;
        const combo = `${c.scope}:${canonicalCombo(keys.split(' '))}`;
        boundBy.set(combo, [...(boundBy.get(combo) ?? []), c.id]);
      }
    }
    for (const command of chords) {
      const combo = `${command.scope}:${canonicalCombo(command.defaultKeys.other)}`;
      expect(boundBy.get(combo), combo).toEqual([command.id]);
    }
  });

  test('the toolbar bare keys are really bound where this file says', () => {
    for (const { key, file } of TOOLBAR_BARE_KEYS) {
      // Accepts the binding line `          m: () => {`; rejects `  m: 1,`
      // outside an arrow and `mode: () =>`.
      const binding = new RegExp(`^\\s+${key}: (\\(\\)|ctx) =>`, 'm');
      expect(readFileSync(join(ROOT, file), 'utf8'), file).toMatch(binding);
    }
  });
});
