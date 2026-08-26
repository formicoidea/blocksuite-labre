import { Bound } from '@labre/global/gfx';
import { describe, expect, it, vi } from 'vitest';

import type { FrameworkBackgroundDef } from '../framework-background/def.js';
import {
  backgroundAxisFact,
  backgroundAxisFacts,
  backgroundBoundaryCoords,
  backgroundTransitionBands,
  backgroundTransitionsShown,
  backgroundTransitionVisibleProps,
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

describe('a transition as the BAND it really is', () => {
  const banded: FrameworkBackgroundDef = { ...def, transitionBandWidth: 0.1 };
  const plotWidth = (w: number) => w - 40 - 30;

  it('centres the band on the transition and names the zones it separates', () => {
    const [first, , third] = backgroundTransitionBands(
      banded,
      new Bound(0, 0, 1600, 900)
    ).x;
    const half = (0.1 * plotWidth(1600)) / 2;

    expect(first.id).toBe('a|b');
    expect(first.at).toBeCloseTo(40 + 0.175 * plotWidth(1600), 6);
    expect(first.min).toBeCloseTo(first.at - half, 6);
    expect(first.max).toBeCloseTo(first.at + half, 6);
    // A name, not an index: it survives a zone being inserted between two
    // others, and says which frontier a finding is about.
    expect(third.id).toBe('c|d');
  });

  it('keeps the same width AS A RATIO however the map is resized', () => {
    // The defect this replaces: a band declared in model units is four times as
    // strict on a map four times as big, for a gesture that looks identical on
    // screen. Measured as a fraction of the plot, the band does not move.
    for (const w of [800, 1600, 3200]) {
      const [band] = backgroundTransitionBands(
        banded,
        new Bound(0, 0, w, (w * 9) / 16)
      ).x;

      expect((band.max - band.min) / plotWidth(w)).toBeCloseTo(0.1, 9);
    }
  });

  it('follows the instance, position included', () => {
    const moved = backgroundTransitionBands(
      banded,
      new Bound(1000, 500, 800, 450)
    );
    const origin = backgroundTransitionBands(banded, new Bound(0, 0, 800, 450));

    expect(moved.x[0].min).toBeCloseTo(origin.x[0].min + 1000, 6);
  });

  it('yields NOTHING when the frame declares no width', () => {
    // A width nobody wrote down is not a width to invent: a rule asking for the
    // band gets silence, and says so on its own terms.
    expect(backgroundTransitionBands(def, new Bound(0, 0, 1600, 900))).toEqual({
      x: [],
      y: [],
    });
  });

  it('drops the requirement rather than invert a band of no width', () => {
    // A width of 0 (or a negative typo) makes `min > max` — a band nothing can
    // be inside, which silently turns "must be at a transition" into "must be
    // nowhere". Loudly dropped instead.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bound = new Bound(0, 0, 1600, 900);

    for (const width of [0, -0.2]) {
      expect(
        backgroundTransitionBands({ ...def, transitionBandWidth: width }, bound)
      ).toEqual({ x: [], y: [] });
    }
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(' ')).toContain('transitionBandWidth');
    warn.mockRestore();
  });

  it('narrows a band too wide for the gap, instead of overlapping', () => {
    // Declared 0.3, against transitions 0.225 apart (0.175 → 0.4): bands would
    // overlap, a point would sit at two frontiers at once and the middle of a
    // phase would qualify as a boundary. Clamped to the gap, which is the
    // widest they can be while still meeting at a single point.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bound = new Bound(0, 0, 1600, 900);
    const { x } = backgroundTransitionBands(
      { ...def, type: 'too-wide', transitionBandWidth: 0.3 },
      bound
    );
    const plot = 1600 - 40 - 30;

    expect(x[0].max - x[0].min).toBeCloseTo(0.225 * plot, 6);
    // Adjacent bands touch, and never cross.
    expect(x[0].max).toBeLessThanOrEqual(x[1].min + 1e-9);
    expect(warn.mock.calls.flat().join(' ')).toContain('Narrowed');
    warn.mockRestore();
  });
});

/**
 * A frontier the user cannot SEE (PO, 25/08/2026).
 *
 * A framework whose dividers are a per-part toggle says so beside the line that
 * draws them — `axes[].ticks.visibleProp` — and these facts resolve it against
 * ONE instance. What hangs off it is proportionality: a rule that judges an
 * alignment against a dashed line has nothing to say while the dashed line is
 * switched off.
 */
describe('the transitions an instance actually shows', () => {
  const stroke = { color: '#000', width: 1 };

  /** The same frame, with its columns drawn as gated graduations. */
  const gated: FrameworkBackgroundDef = {
    ...def,
    transitionBandWidth: 0.1,
    axes: [
      {
        id: 'evolution',
        orientation: 'horizontal',
        at: 1,
        stroke,
        ticks: {
          ticks: [{ at: 0.175 }, { at: 0.4 }, { at: 0.7 }],
          stroke: { ...stroke, dash: [5, 5] },
          visibleProp: 'showColumns',
        },
      },
      { id: 'value-chain', orientation: 'vertical', at: 0, stroke },
    ],
  };
  const bound = new Bound(0, 0, 1600, 900);

  it('names the prop that shows an axis its graduations, as a fact', () => {
    // The declaration already carries it, beside the stroke that paints the
    // line: a rule reads the same field the renderer does, so the two can never
    // disagree about whether the frontier is on the canvas.
    expect(backgroundAxisFact(gated, 'evolution')?.transitionsVisibleProp).toBe(
      'showColumns'
    );
    // An axis with no graduations gates nothing.
    expect(
      backgroundAxisFact(gated, 'value-chain')?.transitionsVisibleProp
    ).toBeUndefined();
  });

  it('lists every prop that can make a frontier appear or disappear', () => {
    expect(backgroundTransitionVisibleProps(gated)).toEqual(['showColumns']);
    // A framework that offers no toggle contributes none — the list is data
    // read off declarations, not a name the engine knows.
    expect(backgroundTransitionVisibleProps(def)).toEqual([]);
  });

  it('drops the bands of an instance whose graduations are hidden', () => {
    expect(
      backgroundTransitionBands(gated, bound, { showColumns: true }).x
    ).toHaveLength(3);
    // Hidden: the same silence as a frame that declares no transition at all.
    expect(
      backgroundTransitionBands(gated, bound, { showColumns: false })
    ).toEqual({ x: [], y: [] });
  });

  it('gates only the plot axis the graduations run across', () => {
    // Vertical columns are `x` positions. A rule measuring along the value
    // chain is not touched by the evolution columns being switched off — and
    // there is nothing to touch here, since this frame has no `y` transition.
    const hidden = backgroundTransitionBands(gated, bound, {
      showColumns: false,
    });
    expect(hidden.x).toEqual([]);
    expect(hidden.y).toEqual([]);
  });

  it('asks the DECLARATION when no instance is given', () => {
    // The question "where are this framework's frontiers" is not the question
    // "which of them is this map drawing": a caller describing the meaning of a
    // map — the reading pass — wants all of them, and got all of them before
    // this argument existed.
    expect(backgroundTransitionBands(gated, bound).x).toHaveLength(3);
  });

  it('treats a prop the instance does not carry as nothing hidden', () => {
    // Painting asks "do I draw this" and an absent prop means nothing to draw;
    // a rule asks "has the user hidden the line I am judging against", and an
    // absent prop is not the user hiding anything. A model that has never heard
    // of the toggle keeps the rule it has always had.
    expect(backgroundTransitionsShown(gated, 'x', {})).toBe(true);
    expect(
      backgroundTransitionsShown(gated, 'x', { showColumns: undefined })
    ).toBe(true);
    expect(
      backgroundTransitionBands(gated, bound, { other: 1 }).x
    ).toHaveLength(3);
  });

  it('leaves a framework that declares no toggle exactly as it was', () => {
    // The whole backwards-compatibility claim in one line: a background whose
    // graduations are ungated (or which declares none at all) shows its
    // frontiers whatever any instance says.
    const banded: FrameworkBackgroundDef = { ...def, transitionBandWidth: 0.1 };

    expect(
      backgroundTransitionsShown(banded, 'x', { showColumns: false })
    ).toBe(true);
    expect(
      backgroundTransitionBands(banded, bound, { showColumns: false }).x
    ).toHaveLength(3);
  });
});
