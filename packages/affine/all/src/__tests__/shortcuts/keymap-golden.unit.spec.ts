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
 * `keymap-golden.json` was generated on `blocksuite-labre-main` from the
 * pre-switchover declarations (`coreShortcuts` + `shapeShortcuts` +
 * `wardleyShortcuts`) and is frozen. This test rebuilds the same two things
 * from the command registry and compares:
 *
 * - `declarations`: id → (owner, scope, mac keys, other keys) for every id that
 *   had a binding before. A renamed id or a moved chord fails here.
 * - `bindings`: the combo → id map `resolveKeymap` actually installs, per
 *   scope. A swap of two ids fails here even when the declarations match.
 *
 * The registry now declares ~50 MORE commands than the golden — all keyless by
 * intent — so the comparison is "every golden id resolves the same", plus an
 * explicit assertion that the newcomers bind nothing.
 */
const std = {} as BlockStdScope;

/** Bind the id itself as the handler, so the resolved keymap is readable. */
const tag = (d: ShortcutDescriptor): ShortcutDescriptor => ({
  ...d,
  handler: () => (() => d.id) as unknown as UIEventHandler,
});

const descriptors = () => getCommands().map(toShortcutDescriptor);

function bindings(scope: ShortcutScope): Record<string, string> {
  const { keymap } = resolveKeymap(descriptors().map(tag), {}, scope, std);
  return Object.fromEntries(
    Object.entries(keymap).map(([combo, handler]) => [
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

  test.each(['global', 'page', 'edgeless'] as ShortcutScope[])(
    'the %s scope binds exactly the same combos to the same ids',
    scope => {
      expect(bindings(scope)).toEqual(
        golden.bindings[scope as keyof typeof golden.bindings]
      );
    }
  );

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

    for (const scope of ['global', 'page', 'edgeless'] as ShortcutScope[]) {
      expect(resolveKeymap(descriptors(), {}, scope, std).conflicts).toEqual(
        []
      );
    }
  });
});
