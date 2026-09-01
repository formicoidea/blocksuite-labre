import { backgroundIncludesPoint } from '@labre/affine-model';
import { describe, expect, it, vi } from 'vitest';

import { REF_H, REF_W, VENN } from '../consts';
import { EdgyView } from '../element-view';

/**
 * The facets diagram is SELECTED by its border (issue #194) — and its three
 * facet labels still receive the double-click that renames them.
 *
 * Same seam the Wardley map uses, asserted the same way: the pointer router
 * asks the VIEW, picking asks the MODEL, and the framework declares its own
 * gesture zones beside the code that draws them.
 */

// Drawn at the reference size, so `refScale` is the identity and a reference
// coordinate IS a model coordinate — the labels are read off the same anchors
// the renderer paints them from.
const W = REF_W;
const H = REF_H;

/** The "Experience" label anchor: centred under the bottom circle. */
const ON_EXPERIENCE_LABEL = {
  x: VENN.cx,
  y: VENN.cy + VENN.r0 + VENN.R + 22,
};

/** The middle of the Venn — on no label, and nowhere near an edge. */
const ON_OPEN_SPACE = { x: VENN.cx, y: VENN.cy };

const PICK = { hitThreshold: 10, zoom: 1 };

function setup(props: Record<string, unknown> = {}) {
  const model = {
    id: 'edgy',
    deserializedXYWH: [0, 0, W, H],
    x: 0,
    y: 0,
    w: W,
    h: H,
    rotate: 0,
    showLabels: true,
    cropToCircles: false,
    identityLabel: 'Identity',
    architectureLabel: 'Architecture',
    experienceLabel: 'Experience',
    isLocked: () => false,
    includesPoint: (x: number, y: number, options: object) =>
      backgroundIncludesPoint(
        { x: 0, y: 0, w: W, h: H, rotate: 0 },
        x,
        y,
        options
      ),
    ...props,
  };

  const gfx = {
    viewport: { toModelCoord: (x: number, y: number) => [x, y] },
    selection: { set: vi.fn() },
    std: {
      store: { captureSync: vi.fn() },
      get: () => ({ updateElement: vi.fn() }),
      getOptional: () => null,
    },
  };

  const view = new EdgyView(model as never, gfx as never);
  view.onCreated();
  return view;
}

const at = (view: EdgyView, p: { x: number; y: number }) =>
  view.includesPoint(p.x, p.y, PICK as never, null as never);

describe('where an EDGY facets diagram answers the pointer', () => {
  it('routes the pointer to the view over a facet label', () => {
    expect(at(setup(), ON_EXPERIENCE_LABEL)).toBe(true);
  });

  it('lets the Venn go, so a shape under the pointer gets the click', () => {
    expect(at(setup(), ON_OPEN_SPACE)).toBe(false);
  });

  it('still answers on its border, straight from the model', () => {
    expect(at(setup(), { x: 5, y: H / 2 })).toBe(true);
  });

  it('claims no label zone when the labels are hidden', () => {
    // Nothing is drawn there, so nothing may be aimed at there.
    expect(at(setup({ showLabels: false }), ON_EXPERIENCE_LABEL)).toBe(false);
  });
});
