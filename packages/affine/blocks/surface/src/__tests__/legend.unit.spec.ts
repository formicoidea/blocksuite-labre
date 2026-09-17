import { Bound } from '@labre/global/gfx';
import { describe, expect, it } from 'vitest';

import { rolesInBound } from '../extensions/legend';

/**
 * The SCAN a legend starts from: which roles the elements drawn inside a
 * board's perimeter carry. What the engine then makes of them is
 * `legend-from-commands.unit.spec.ts`.
 */

interface FixtureElement {
  role?: string;
  xywh: string;
}

/**
 * A gfx with a REAL bound filter, so "an artefact outside the perimeter is not
 * in the legend" is proved by the geometry rather than by the stub being told
 * the answer.
 */
function gfxOver(elements: FixtureElement[]) {
  const overlaps = (a: Bound, b: Bound) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  return {
    getElementsByBound: (bound: Bound) =>
      elements.filter(el => overlaps(bound, Bound.deserialize(el.xywh))),
  };
}

const at = (x: number, y: number, role?: string): FixtureElement => ({
  role,
  xywh: new Bound(x, y, 20, 20).serialize(),
});

/** The background every case below scans: 1000 × 800 at the origin. */
const BG = new Bound(0, 0, 1000, 800);

describe('rolesInBound', () => {
  it('collects the roles inside the perimeter and ignores those outside it', () => {
    const gfx = gfxOver([
      at(100, 100, 'fx:event'),
      at(200, 200, 'fx:flow'),
      // Well past the background's right edge.
      at(5000, 100, 'fx:command'),
    ]);
    expect([...rolesInBound(gfx as never, BG)].sort()).toEqual([
      'fx:event',
      'fx:flow',
    ]);
  });

  it('ignores neutral elements, so a board drawn before roles yields nothing', () => {
    const gfx = gfxOver([at(100, 100), at(200, 200)]);
    expect(rolesInBound(gfx as never, BG).size).toBe(0);
  });
});
