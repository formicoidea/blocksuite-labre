import { backgroundIncludesPoint } from '@labre/affine-model';
import { describe, expect, it, vi } from 'vitest';

import {
  BOARD_MARGIN,
  BOARD_REF_HEIGHT,
  BOARD_REF_WIDTH,
  BOARD_TITLE_MARGIN,
} from '../consts';
import { C4BoardView } from '../element-view';

/**
 * A C4 board is SELECTED by its border (issue #194) — and the title written in
 * its top margin still receives the double-click that renames it.
 *
 * Same seam the Wardley map and the EDGY facets use: the pointer router asks
 * the VIEW's `includesPoint`, picking asks the MODEL's. What this file pins is
 * the ROUTING, not the label geometry — where the title sits is
 * `background.unit.spec.ts`'s business, and the point below is derived from the
 * same declared anchor so the two cannot drift apart.
 */

const W = BOARD_REF_WIDTH;
const H = BOARD_REF_HEIGHT;

/**
 * On the title: the label is anchored at the plot's top-left, walked back up
 * into the title margin by a third of it, and drawn rightwards from there.
 */
const ON_TITLE = {
  x: BOARD_MARGIN + 20,
  y: BOARD_TITLE_MARGIN - BOARD_TITLE_MARGIN / 3,
};

/** The middle of the sheet, where the diagram goes. */
const ON_OPEN_SPACE = { x: W / 2, y: H / 2 };

const PICK = { hitThreshold: 10, zoom: 1 };

function setup(name = 'System context') {
  const model = {
    id: 'board',
    name,
    deserializedXYWH: [0, 0, W, H],
    x: 0,
    y: 0,
    w: W,
    h: H,
    rotate: 0,
    isLocked: () => false,
    includesPoint: (x: number, y: number, options: object) =>
      backgroundIncludesPoint(
        { x: 0, y: 0, w: W, h: H, rotate: 0 },
        x,
        y,
        options
      ),
  };

  const gfx = {
    viewport: { toModelCoord: (x: number, y: number) => [x, y] },
    selection: { set: vi.fn() },
    std: {
      store: { captureSync: vi.fn(), readonly: false },
      get: () => ({ updateElement: vi.fn() }),
      getOptional: () => null,
    },
  };

  const view = new C4BoardView(model as never, gfx as never);
  view.onCreated();
  return view;
}

const at = (view: C4BoardView, p: { x: number; y: number }) =>
  view.includesPoint(p.x, p.y, PICK as never, null as never);

describe('where a C4 board answers the pointer', () => {
  it('routes the pointer to the view over its title', () => {
    expect(at(setup(), ON_TITLE)).toBe(true);
  });

  it('lets the sheet go, so a node under the pointer gets the click', () => {
    expect(at(setup(), ON_OPEN_SPACE)).toBe(false);
  });

  it('still answers on its border, straight from the model', () => {
    expect(at(setup(), { x: 5, y: H / 2 })).toBe(true);
  });
});
