import {
  resolveKeymap,
  toShortcutDescriptor,
  type BlockStdScope,
  type ShortcutDescriptor,
  type ShortcutScope,
  type UIEventHandler,
} from '@labre/std';
import { describe, expect, test } from 'vitest';

import { getCommands } from '../../commands.js';
import { KEYMAP_GOLDEN as golden } from './keymap-golden.js';

/**
 * THE non-negotiable of the PF3 switchover (`docs/adr/0008` § non-negotiables):
 * users' persisted v0.29 override tables stay valid, which means the effective
 * keymap must resolve identically before and after.
 *
 * `keymap-golden.ts` was generated on `blocksuite-labre-main` from the
 * pre-switchover declarations (`coreShortcuts` + `shapeShortcuts` +
 * `wardleyShortcuts`) and is frozen. This test rebuilds the same two things
 * from the command registry and compares:
 *
 * - `declarations`: id → (owner, scope, mac keys, other keys) for every id that
 *   had a binding before. A renamed id or a moved chord fails here.
 * - `bindings`: the combo → id map `resolveKeymap` actually installs, per
 *   PLATFORM and per scope. A swap of two ids fails here even when the
 *   declarations match.
 *
 * The registry now declares ~50 MORE commands than the golden — all keyless by
 * intent — so the comparison is "every golden id resolves the same", plus an
 * explicit assertion that the newcomers bind nothing.
 */
const std = {} as BlockStdScope;
const PLATFORMS = ['mac', 'other'] as const;
const SCOPES: ShortcutScope[] = ['global', 'page', 'edgeless'];

type Platform = (typeof PLATFORMS)[number];

/**
 * Project a descriptor onto ONE platform, then tag its handler with its own id
 * so the resolved keymap is readable.
 *
 * `resolveKeymap` picks its platform through `IS_MAC`, a module constant of
 * `@labre/global/env` fixed by whichever OS runs the suite. Collapsing both
 * fields onto the platform under test drives the real engine —
 * canonicalisation, chord assembly, conflict detection — over the real
 * per-platform declarations, so both keymaps are verified on either OS.
 */
const project = (platform: Platform, d: ShortcutDescriptor) => {
  const keys = d.defaultKeys[platform];
  return {
    ...d,
    defaultKeys: { mac: keys, other: keys },
    handler: () => (() => d.id) as unknown as UIEventHandler,
  };
};

const descriptors = () => getCommands().map(toShortcutDescriptor);

const resolve = (platform: Platform, scope: ShortcutScope) =>
  resolveKeymap(
    descriptors().map(d => project(platform, d)),
    {},
    scope,
    std
  );

function bindings(
  platform: Platform,
  scope: ShortcutScope
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(resolve(platform, scope).keymap).map(([combo, handler]) => [
      combo,
      (handler as unknown as () => string)(),
    ])
  );
}

describe('effective keymap is unchanged by the command switchover', () => {
  test('every id that had a binding still declares the same keys', () => {
    const byId = new Map(
      descriptors().map(d => [
        d.id,
        { id: d.id, owner: d.owner, scope: d.scope, ...d.defaultKeys },
      ])
    );
    for (const expected of golden.declarations) {
      expect(byId.get(expected.id), `missing command ${expected.id}`).toEqual(
        expected
      );
    }
  });

  describe.each(PLATFORMS)('on %s', platform => {
    test.each(SCOPES)(
      'the %s scope binds exactly the same combos to the same ids',
      scope => {
        const expected = golden.bindings[platform];
        expect(bindings(platform, scope)).toEqual(
          expected[scope as keyof typeof expected]
        );
      }
    );
  });

  /**
   * The one platform difference in the whole manifest, pinned so the
   * two-platform golden cannot quietly collapse back into one.
   */
  test('redo-windows binds on Windows/Linux and is absent on mac', () => {
    expect(bindings('other', 'global')['Control-y']).toBe('redo-windows');
    expect(Object.values(bindings('mac', 'global'))).not.toContain(
      'redo-windows'
    );
  });

  test('the newly declared commands bind nothing and conflict with nothing', () => {
    const goldenIds = new Set<string>(golden.declarations.map(d => d.id));
    const newcomers = descriptors().filter(d => !goldenIds.has(d.id));
    // The whole point of the switchover: ~50 artefacts that only existed as
    // menu buttons are now commands.
    expect(newcomers.length).toBeGreaterThan(40);
    expect(
      newcomers.every(
        d => d.defaultKeys.mac.length === 0 && d.defaultKeys.other.length === 0
      )
    ).toBe(true);

    for (const platform of PLATFORMS) {
      for (const scope of SCOPES) {
        expect(
          resolve(platform, scope).conflicts,
          `${platform}/${scope}`
        ).toEqual([]);
      }
    }
  });
});
