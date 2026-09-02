import {
  backgroundIncludesPoint,
  C4_BOARD_TITLE_BAND_HEIGHT,
} from '@labre/affine-model';
import { describe, expect, it, vi } from 'vitest';

import { c4BoardTitleBand, c4InBoardTitleBand } from '../board-hit';
import {
  BOARD_MARGIN,
  BOARD_REF_HEIGHT,
  BOARD_REF_WIDTH,
  BOUNDARY_MARGIN,
  BOUNDARY_NAME_INSET,
  BOUNDARY_REF_HEIGHT,
  BOUNDARY_REF_WIDTH,
  BOUNDARY_TYPE_STEP,
} from '../consts';
import { C4BoardView, C4BoundaryView } from '../element-view';

/**
 * A C4 frame is SELECTED by its border (issue #194) — and the name written on
 * it still receives the double-click that renames it.
 *
 * Same seam the Wardley map and the EDGY facets use: the pointer router asks
 * the VIEW's `includesPoint`, picking asks the MODEL's. What this file pins is
 * the ROUTING, not the label geometry — where the title sits is
 * `background.unit.spec.ts`'s business, and every point below is derived from
 * the declared band or the declared anchor so the two cannot drift apart.
 *
 * ## The two frames answer differently, on purpose
 *
 * The BOARD's rename zone is its whole title band: the header strip is painted,
 * so a user aiming at it is aiming at something they can see, and a strip you
 * may only double-click the glyphs of is a target that lies about where it is.
 * The BOUNDARY's is the drawn words alone: its name sits INSIDE the plot, over
 * the diagram the frame is drawn round, where a wider zone would swallow clicks
 * meant for the elements underneath.
 */

const W = BOARD_REF_WIDTH;
const H = BOARD_REF_HEIGHT;

/** In the band, on the words. */
const ON_TITLE = {
  x: BOARD_MARGIN + 20,
  y: C4_BOARD_TITLE_BAND_HEIGHT - C4_BOARD_TITLE_BAND_HEIGHT / 3,
};

/**
 * In the band, and nowhere near the words nor near an edge — the half this
 * slice adds. Deliberately clear of the border band, which would answer `true`
 * for a reason that has nothing to do with the title.
 */
const ON_EMPTY_BAND = { x: W / 2, y: 30 };

/** The middle of the sheet, where the diagram goes. */
const ON_OPEN_SPACE = { x: W / 2, y: H / 2 };

/** Just under the band, where a node dropped at the top of the plot sits. */
const UNDER_THE_BAND = { x: W / 2, y: C4_BOARD_TITLE_BAND_HEIGHT + 20 };

const PICK = { hitThreshold: 10, zoom: 1 };

/** A view of either frame, over a detached model of the given box. */
function frame(
  Ctor: typeof C4BoardView | typeof C4BoundaryView,
  { name, w, h }: { name: string; w: number; h: number }
) {
  const model = {
    id: 'frame',
    name,
    deserializedXYWH: [0, 0, w, h],
    x: 0,
    y: 0,
    w,
    h,
    rotate: 0,
    isLocked: () => false,
    includesPoint: (x: number, y: number, options: object) =>
      backgroundIncludesPoint({ x: 0, y: 0, w, h, rotate: 0 }, x, y, options),
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

  const view = new Ctor(model as never, gfx as never);
  view.onCreated();
  return view;
}

function board(name = 'System context') {
  return frame(C4BoardView, { name, w: W, h: H });
}

const at = (
  view: ReturnType<typeof frame>,
  p: { x: number; y: number }
): boolean => view.includesPoint(p.x, p.y, PICK as never, null as never);

describe('where a C4 board answers the pointer', () => {
  it('routes the pointer to the view over its title', () => {
    expect(at(board(), ON_TITLE)).toBe(true);
  });

  it('answers over the WHOLE title band, words or no words', () => {
    // The band is painted, so every unit of it is a target the user can see —
    // and the model picks the same strip, so the click that renames and the
    // click that selects are the same click.
    expect(at(board(), ON_EMPTY_BAND)).toBe(true);
    expect(
      c4InBoardTitleBand({ deserializedXYWH: [0, 0, W, H] }, [
        ON_EMPTY_BAND.x,
        ON_EMPTY_BAND.y,
      ])
    ).toBe(true);
  });

  it('lets the sheet go, so a node under the pointer gets the click', () => {
    expect(at(board(), ON_OPEN_SPACE)).toBe(false);
    // …including immediately under the band's own edge, which is where a node
    // dropped at the top of the plot sits. The band must not reach past what it
    // paints, or it steals the clicks meant for what is drawn below it.
    expect(at(board(), UNDER_THE_BAND)).toBe(false);
  });

  it('still answers on its border, straight from the model', () => {
    expect(at(board(), { x: 5, y: H / 2 })).toBe(true);
  });

  it('reads the band off the declaration, and clamps a degenerate board', () => {
    const band = c4BoardTitleBand({ deserializedXYWH: [0, 0, W, H] })!;
    // The band IS the top margin, full width — one number, the declaration's.
    expect(band).toEqual({ x: 0, y: 0, w: W, h: C4_BOARD_TITLE_BAND_HEIGHT });

    // A board dragged shorter than its own header keeps a band, clamped to what
    // there is: the renderer clamps the same way, so the strip stays honest.
    const squashed = c4BoardTitleBand({ deserializedXYWH: [0, 0, W, 20] })!;
    expect(squashed.h).toBe(20);

    // Nothing at all is not a band.
    expect(c4BoardTitleBand({ deserializedXYWH: [0, 0, 0, 0] })).toBeNull();
  });
});

describe('where a C4 boundary answers the pointer', () => {
  const BW = BOUNDARY_REF_WIDTH;
  const BH = BOUNDARY_REF_HEIGHT;

  const boundary = () =>
    frame(C4BoundaryView, { name: 'Internet banking', w: BW, h: BH });

  /** On the words: bottom-left of the plot, one bracket-line step up. */
  const ON_NAME = {
    x: BOUNDARY_MARGIN + 20,
    y: BH - BOUNDARY_MARGIN - BOUNDARY_NAME_INSET - BOUNDARY_TYPE_STEP,
  };

  it('answers over its name, and nowhere else inside the frame', () => {
    // Unchanged by the board's band, and it must stay that way: a boundary is
    // drawn OVER a diagram, so a wide rename zone would swallow the clicks
    // meant for the elements it is drawn round.
    expect(at(boundary(), ON_NAME)).toBe(true);
    expect(at(boundary(), { x: BW / 2, y: BH / 2 })).toBe(false);
    // Across the top, where the board wears its band — and where a boundary
    // wears nothing, because it has no header to write a title in.
    expect(at(boundary(), { x: BW / 2, y: 30 })).toBe(false);
  });
});
