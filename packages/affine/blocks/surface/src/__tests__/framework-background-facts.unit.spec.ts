import { Bound } from '@labre/global/gfx';
import { describe, expect, it } from 'vitest';

import type { FrameworkBackgroundDef } from '../framework-background/def.js';
import {
  backgroundAxisFact,
  backgroundAxisFacts,
  backgroundBoundaryCoords,
  backgroundZoneBoundaries,
} from '../framework-background/facts.js';

/**
 * The declaration read as EVALUATION FACTS (PF5.15 / PF5.16).
 *
 * A framework already declares its frame of reference so the primitive can
 * paint it. These are the accessors that let a RULE read the same declaration —
 * which way an axis runs, where one zone ends — without the engine owning a
 * registry of backgrounds or a single line of framework knowledge.
 */

const stroke = { color: '#000', width: 1 };

/** A frame shaped like a Wardley map: two axes, four columns. */
const def: FrameworkBackgroundDef = {
  type: 'test',
  geometry: {
    width: 1600,
    height: 900,
    lockAspectRatio: true,
    resizable: false,
    margin: { left: 40, right: 30, top: 30, bottom: 38 },
  },
  axes: [
    { id: 'evolution', orientation: 'horizontal', at: 1, stroke },
    { id: 'value-chain', orientation: 'vertical', at: 0, stroke },
  ],
  zones: [
    { id: 'a', rect: { x: 0, y: 0, w: 0.175, h: 1 } },
    { id: 'b', rect: { x: 0.175, y: 0, w: 0.225, h: 1 } },
    { id: 'c', rect: { x: 0.4, y: 0, w: 0.3, h: 1 } },
    { id: 'd', rect: { x: 0.7, y: 0, w: 0.3, h: 1 } },
  ],
};

describe('axes as facts', () => {
  it('reports the sense of progression, in MODEL space', () => {
    expect(backgroundAxisFacts(def)).toEqual([
      // Rightwards is more evolved.
      { id: 'evolution', orientation: 'horizontal', forward: [1, 0] },
      // UP is more valuable — the opposite of increasing screen `y`, which is
      // exactly the trap a rule must not fall into.
      { id: 'value-chain', orientation: 'vertical', forward: [0, -1] },
    ]);
  });

  it('finds one axis by id, and admits when there is none', () => {
    expect(backgroundAxisFact(def, 'evolution')?.forward).toEqual([1, 0]);
    // A rule naming an axis the frame does not declare gets `undefined` and
    // stays silent, rather than guessing at an axis.
    expect(backgroundAxisFact(def, 'temperature')).toBeUndefined();
  });

  it('says nothing about a background that declares no axis', () => {
    expect(backgroundAxisFacts({ ...def, axes: undefined })).toEqual([]);
  });
});

describe('zone transitions as facts', () => {
  it('reports the INTERIOR edges only, sorted and de-duplicated', () => {
    // 0 and 1 are the borders of the plot, not transitions between two zones:
    // a rule saying "sit on a transition" must not accept the map's own edge.
    // Adjacent zones share an edge, and it is reported once.
    expect(backgroundZoneBoundaries(def).x).toEqual([0.175, 0.4, 0.7]);
    // Full-height columns cross no horizontal transition.
    expect(backgroundZoneBoundaries(def).y).toEqual([]);
  });

  it('says nothing about a background that declares no zone', () => {
    expect(backgroundZoneBoundaries({ ...def, zones: undefined })).toEqual({
      x: [],
      y: [],
    });
  });

  it('places them in model coordinates, through the PLOT', () => {
    const bound = new Bound(0, 0, 1600, 900);
    const { x } = backgroundBoundaryCoords(def, bound);

    // The plot is the element box minus the declared margin: 40 → 1570, so a
    // transition at 0.175 is NOT at 17.5% of the element's width. Getting this
    // wrong is exactly how an inertia bar ends up "on" a boundary drawn 40
    // units away.
    const plotWidth = 1600 - 40 - 30;
    expect(x[0]).toBeCloseTo(40 + 0.175 * plotWidth, 6);
    expect(x[2]).toBeCloseTo(40 + 0.7 * plotWidth, 6);
  });

  it('follows the instance, not the reference size', () => {
    // Two maps of different sizes on one board have different transitions, and
    // a finding is measured against the map it was attributed to.
    const small = backgroundBoundaryCoords(def, new Bound(0, 0, 800, 450));
    const moved = backgroundBoundaryCoords(def, new Bound(1000, 500, 800, 450));

    expect(small.x[0]).toBeLessThan(
      backgroundBoundaryCoords(def, new Bound(0, 0, 1600, 900)).x[0]
    );
    expect(moved.x[0]).toBeCloseTo(small.x[0] + 1000, 6);
  });
});
