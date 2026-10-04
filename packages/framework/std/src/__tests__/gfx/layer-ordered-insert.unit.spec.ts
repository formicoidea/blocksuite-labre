/**
 * `insertToOrderedArray` finds its position by bisection since a paste of N
 * elements spent N² calls to `compare` in the linear scan it replaced (each
 * call walks both elements' group chains through `getGroup`).
 *
 * The scan defined the semantics, so it is kept here as the oracle: on an
 * array sorted by `compare`, the bisection must land exactly where the scan
 * did — after every element that sorts before the new one or ties with it, a
 * container before its own children, a child ordered by its top-level
 * ancestor. Siblings sharing an index keep their insertion order.
 *
 * What the oracle does NOT cover, on purpose: an index shared by two
 * UNRELATED subtrees (a group and a loose element, as two peers adding at the
 * top at once can produce). `compare` is not transitive there — the loose
 * element ties with the group and with its child, while the group sorts
 * before its child — so the array has no single sorted position, and the scan
 * and the bisection may pick different tied ones. Neither is more right: the
 * order among such ties was already arbitrary, and the next `_reset`
 * re-sorts it with the same comparator.
 */
import { describe, expect, it } from 'vitest';

import { gfxGroupCompatibleSymbol } from '../../gfx/model/base.js';
import type { GfxModel } from '../../gfx/model/model.js';
import { compare, insertToOrderedArray, SortOrder } from '../../utils/layer.js';

type Fake = {
  id: string;
  index: string;
  group: Fake | null;
  readonly groups: Fake[];
  [gfxGroupCompatibleSymbol]?: true;
};

function fake(id: string, index: string, group: Fake | null = null): Fake {
  return {
    id,
    index,
    group,
    get groups() {
      const chain: Fake[] = [];
      for (let g = this.group; g; g = g.group) chain.push(g);
      return chain;
    },
  };
}

function container(id: string, index: string, group: Fake | null = null) {
  const model = fake(id, index, group);
  model[gfxGroupCompatibleSymbol] = true;
  return model;
}

/** The linear scan `insertToOrderedArray` used before the bisection. */
function linearInsert(array: GfxModel[], element: GfxModel) {
  let idx = 0;
  while (
    idx < array.length &&
    [SortOrder.BEFORE, SortOrder.SAME].includes(compare(array[idx], element))
  ) {
    ++idx;
  }
  array.splice(idx, 0, element);
}

/** A deterministic pseudo-random sequence, so a failure replays. */
function random(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

/**
 * A board of loose elements, two groups (one nested in the other) and their
 * children, in a random order and with distinct indexes.
 */
function board(next: () => number) {
  const pool = Array.from({ length: 32 }, (_, i) => `a${10 + i}`);
  const index = () => pool.splice(Math.floor(next() * pool.length), 1)[0];
  const outer = container('outer', index());
  const inner = container('inner', index(), outer);
  const elements: Fake[] = [outer, inner];
  for (let i = 0; i < 30; i++) {
    const roll = next();
    const parent = roll < 0.3 ? outer : roll < 0.5 ? inner : null;
    elements.push(fake(`e${i}`, index(), parent));
  }
  return elements as unknown as GfxModel[];
}

describe('insertToOrderedArray', () => {
  it('lands where the linear scan did, group chains included', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const next = random(seed);
      const elements = board(next);

      const bisected: GfxModel[] = [];
      const scanned: GfxModel[] = [];
      for (const element of elements) {
        insertToOrderedArray(bisected, element);
        linearInsert(scanned, element);
      }

      expect(bisected.map(e => e.id)).toEqual(scanned.map(e => e.id));
    }
  });

  it('puts a container before its children and after what sorts below it', () => {
    const group = container('group', 'a5');
    const child = fake('child', 'a1', group);
    const below = fake('below', 'a4');
    const above = fake('above', 'a6');

    const array: GfxModel[] = [];
    for (const element of [above, child, below, group] as unknown[]) {
      insertToOrderedArray(array, element as GfxModel);
    }

    expect(array.map(e => e.id)).toEqual(['below', 'group', 'child', 'above']);
  });

  it('inserts after the elements it ties with', () => {
    const first = fake('first', 'a1');
    const second = fake('second', 'a1');
    const array = [first] as unknown as GfxModel[];

    insertToOrderedArray(array, second as unknown as GfxModel);

    expect(array.map(e => e.id)).toEqual(['first', 'second']);
  });
});
