/**
 * `RemapDropped` is what `remapView` returns to a host's import dialog
 * (labre PRD REQ-DB-2). 0.50 adds `colorRules` (ADR 0036). A type a host
 * calls only WIDENS in a minor (docs/lessons.md 33): what a 0.49 dialog read
 * must still type, with the same field types, so a host that upgrades
 * compiles unchanged and gains one count to show.
 *
 * Typechecked by `yarn build` (tests included); the `expectTypeOf` lines fail
 * the build, not the run.
 */
import { describe, expect, expectTypeOf, test } from 'vitest';

import { type RemapDropped, remapView } from '../view-transfer/remap-view.js';

/** `RemapDropped` exactly as 0.49 declared it. */
type RemapDropped049 = {
  filters: number;
  sorts: number;
  group: boolean;
  properties: number;
};

describe('RemapDropped (ADR 0036)', () => {
  test('still carries every 0.49 field, with its type', () => {
    expectTypeOf<RemapDropped>().toMatchTypeOf<RemapDropped049>();
    const read049 = (dropped: RemapDropped049) =>
      dropped.filters + dropped.sorts + dropped.properties;
    const { dropped } = remapView({ mode: 'table' }, [], [], {});
    expect(read049(dropped)).toBe(0);
  });

  test('adds the colour rules removed, always a number', () => {
    expectTypeOf<RemapDropped['colorRules']>().toEqualTypeOf<number>();
    expect(remapView({ mode: 'table' }, [], [], {}).dropped.colorRules).toBe(0);
  });
});
