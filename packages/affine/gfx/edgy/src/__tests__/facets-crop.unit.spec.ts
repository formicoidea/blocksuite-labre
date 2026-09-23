import { describe, expect, it } from 'vitest';

import {
  CROP,
  CROP_LABELED,
  cropLabeledScale,
  LABEL_FONT_SIZE,
  VENN,
} from '../consts';
import {
  CIRCLE_A,
  CIRCLE_B,
  CIRCLE_C,
  facetLabelAnchors,
} from '../label-layout';
import { FACETS_SCALE } from '../presets';

/**
 * The frame of a facets diagram sits ON the drawing (Notion "Ajuster les
 * bordures des fonds de cartes au plus proche des bords").
 *
 * What this would have caught: `CROP_LABELED` made room for the three facet
 * names with ONE symmetric number, `sideAllowance = 140` either side, while the
 * words are "Identity" on the left and "Architecture" on the right — one of
 * them two thirds longer than the other. A diagram was therefore born with
 * 126.6 model units of nothing between its left border and the first pixel of
 * ink, and 74.8 on the right. Since a framework background is caught by its
 * border and by nothing else
 * (`model/src/elements/framework-background/hit-test.ts`, a band of `10 / zoom`
 * around the `xywh`), the board was grabbed at a line drawn a seventh of its
 * width away from anything visible.
 *
 * The reach of each word below is MEASURED — read off the canvas of the
 * playground at `LABEL_FONT_SIZE` in the shipped wording, not estimated from a
 * character count. They are the numbers `LABEL_ALLOWANCE` was sized against, so
 * restating them here is what makes this file a check rather than a copy of the
 * declaration.
 */

/** Measured advance of each shipped facet name, `500 15px Inter`, REF units. */
const MEASURED_WIDTH: Record<string, number> = {
  identityLabel: 53.6,
  architectureLabel: 88.1,
  experienceLabel: 75,
};

/**
 * Measured drop from a `middle` baseline to the bottom of the ink at 15px —
 * "Experience" has a descender, so this is more than half a cap height.
 */
const MEASURED_DESCENT = 7.2;

/** Half of the white separating outline drawn round each circle. */
const STROKE_HALF = 2.5 / 2;

/** A model whose three names are the shipped vocabulary. */
const facets = () =>
  ({
    identityLabel: 'Identity',
    architectureLabel: 'Architecture',
    experienceLabel: 'Experience',
    showLabels: true,
  }) as never;

/** Every pixel the diagram paints, in REF coords. */
function inkInRef() {
  const R = VENN.R + STROKE_HALF;
  let minX = Math.min(CIRCLE_A.x, CIRCLE_B.x, CIRCLE_C.x) - R;
  let maxX = Math.max(CIRCLE_A.x, CIRCLE_B.x, CIRCLE_C.x) + R;
  const minY = Math.min(CIRCLE_A.y, CIRCLE_B.y, CIRCLE_C.y) - R;
  let maxY = Math.max(CIRCLE_A.y, CIRCLE_B.y, CIRCLE_C.y) + R;

  for (const { field, x, y, align } of facetLabelAnchors(facets())) {
    const width = MEASURED_WIDTH[field];
    const left =
      align === 'end' ? x - width : align === 'center' ? x - width / 2 : x;
    minX = Math.min(minX, left);
    maxX = Math.max(maxX, left + width);
    maxY = Math.max(maxY, y + MEASURED_DESCENT);
  }
  return { minX, minY, maxX, maxY };
}

/** The empty band on each side of a diagram of size `w × h`, in model units. */
function deadMargins(w: number, h: number) {
  const { s, ox, oy } = cropLabeledScale(w, h);
  const ink = inkInRef();
  return {
    left: ox + ink.minX * s,
    top: oy + ink.minY * s,
    right: w - (ox + ink.maxX * s),
    bottom: h - (oy + ink.maxY * s),
    s,
  };
}

const BIRTH_W = CROP_LABELED.w * FACETS_SCALE;
const BIRTH_H = CROP_LABELED.h * FACETS_SCALE;

describe('the facets frame sits on the Venn', () => {
  it('is born at the size of its drawing, to the unit', () => {
    // 687.0 × 466.5, against 874.5 × 487.5 before: 187.5 units of nothing gone
    // from the width, 21 from the height, and the Venn itself is still drawn at
    // exactly the same size. (The width carries the `0.866` of the circle
    // layout, hence the tolerance.)
    expect(BIRTH_W).toBeCloseTo(686.99, 1);
    expect(BIRTH_H).toBe(466.5);
  });

  it('leaves at most 8 model units of nothing on any side, at birth', () => {
    const dead = deadMargins(BIRTH_W, BIRTH_H);
    for (const side of ['left', 'top', 'right', 'bottom'] as const) {
      expect(dead[side]).toBeGreaterThanOrEqual(0);
      expect(dead[side]).toBeLessThanOrEqual(8);
    }
  });

  it.each([
    ['half the size', 0.5],
    ['twice the size', 2],
  ])('never reopens the gap when the board is resized: %s', (_what, k) => {
    // The fit is uniform, so a margin can only grow with the drawing: measured
    // per unit of scale it must stay under what it is at birth.
    const dead = deadMargins(BIRTH_W * k, BIRTH_H * k);
    for (const side of ['left', 'top', 'right', 'bottom'] as const) {
      expect(dead[side]).toBeGreaterThanOrEqual(0);
      expect(dead[side] / dead.s).toBeLessThanOrEqual(8 / FACETS_SCALE);
    }
  });

  it.each([
    ['stretched wide', 3, 1],
    ['stretched tall', 1, 3],
  ])('shows every name in full whatever the ratio: %s', (_what, kw, kh) => {
    // A diagram dragged off its birth proportion letterboxes (`cropLabeledScale`
    // is a uniform fit), so the empty band grows on two sides — but no word is
    // ever cut, which is the half the allowances are responsible for.
    const dead = deadMargins(BIRTH_W * kw, BIRTH_H * kh);
    for (const side of ['left', 'top', 'right', 'bottom'] as const) {
      expect(dead[side]).toBeGreaterThanOrEqual(0);
    }
  });

  it('leaves the circles box alone: the dynamic template is pinned to it', () => {
    // `templates/dynamic.ts` places all twelve elements of the EDGY dynamic
    // board in coordinates relative to `CROP`. Moving it would move them on
    // every document already built from that template, for nothing: `CROP` is
    // used when the names are HIDDEN, and it was already tight.
    expect(CROP.x).toBeCloseTo(188.504, 3);
    expect(CROP.y).toBe(45);
    expect(CROP.w).toBeCloseTo(302.992, 3);
    expect(CROP.h).toBe(290);
  });

  it('keeps the font the allowances were measured at', () => {
    expect(LABEL_FONT_SIZE).toBe(15);
  });
});
