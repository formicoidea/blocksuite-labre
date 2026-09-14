import {
  backgroundIncludesPoint,
  UML_FRAME_BAND_HEIGHT,
} from '@labre/affine-model';
import { describe, expect, it, vi } from 'vitest';

import { umlDiagramBand, umlInDiagramBand } from '../board-hit.js';
import {
  UML_DIAGRAM_BOX,
  UML_DIAGRAM_MARGIN,
  UML_NAME_FONT_SIZE,
  UML_SUBJECT_BOX,
  UML_SUBJECT_MARGIN,
} from '../consts.js';
import { UmlDiagramView, UmlSubjectView } from '../element-view.js';

/**
 * A UML frame is SELECTED by its border (issue #194) — and the name written on
 * it still receives the double-click that renames it.
 *
 * Same seam the Wardley map, the C4 board and the EDGY facets use: the pointer
 * router asks the VIEW's `includesPoint`, picking asks the MODEL's. What this
 * file pins is the ROUTING, not the label geometry — where the heading sits is
 * `background.unit.spec.ts`'s business, and every point below is derived from
 * the declared band or the declared anchor so the two cannot drift apart.
 *
 * ## The two frames answer differently, on purpose
 *
 * The DIAGRAM's rename zone is its whole heading band: the band is the sheet's
 * own strip — nothing is ever dropped there — and it is what the model picks, so
 * the click that selects and the click that renames are the same click. The
 * SUBJECT's is the drawn words alone: its name sits INSIDE the plot, over the
 * use cases the rectangle is drawn round, where a wider zone would swallow
 * clicks meant for them.
 */

const W = UML_DIAGRAM_BOX.w;
const H = UML_DIAGRAM_BOX.h;

/** In the band, on the words. */
const ON_HEADING = {
  x: UML_DIAGRAM_MARGIN + 20,
  y: UML_FRAME_BAND_HEIGHT - UML_FRAME_BAND_HEIGHT / 3,
};

/**
 * In the band, and nowhere near the words nor near an edge. Deliberately clear
 * of the border band, which would answer `true` for a reason that has nothing to
 * do with the heading.
 */
const ON_EMPTY_BAND = { x: W / 2, y: 30 };

/** The middle of the sheet, where the diagram goes. */
const ON_OPEN_SPACE = { x: W / 2, y: H / 2 };

/** Just under the band, where a class dropped at the top of the plot sits. */
const UNDER_THE_BAND = { x: W / 2, y: UML_FRAME_BAND_HEIGHT + 20 };

const PICK = { hitThreshold: 10, zoom: 1 };

/** A view of either frame, over a detached model of the given box. */
function frame(
  Ctor: typeof UmlDiagramView | typeof UmlSubjectView,
  { name, w, h }: { name: string; w: number; h: number }
) {
  const model = {
    id: 'frame',
    name,
    kind: 'class',
    // The DERIVED half of the label, which is what the declaration binds.
    heading: `class ${name}`,
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

function diagram(name = 'Orders') {
  return frame(UmlDiagramView, { name, w: W, h: H });
}

const at = (
  view: ReturnType<typeof frame>,
  p: { x: number; y: number }
): boolean => view.includesPoint(p.x, p.y, PICK as never, null as never);

describe('where a UML diagram frame answers the pointer', () => {
  it('routes the pointer to the view over its heading', () => {
    expect(at(diagram(), ON_HEADING)).toBe(true);
  });

  it('answers over the WHOLE heading band, words or no words', () => {
    // The band is what the model picks, so a user aiming anywhere along the
    // sheet's own strip gets the sheet — and the tag they can see is inside it.
    expect(at(diagram(), ON_EMPTY_BAND)).toBe(true);
    expect(
      umlInDiagramBand({ deserializedXYWH: [0, 0, W, H] }, [
        ON_EMPTY_BAND.x,
        ON_EMPTY_BAND.y,
      ])
    ).toBe(true);
  });

  it('lets the sheet go, so a node under the pointer gets the click', () => {
    expect(at(diagram(), ON_OPEN_SPACE)).toBe(false);
    // …including immediately under the band's own edge, which is where a class
    // dropped at the top of the plot sits. The band must not reach past what it
    // reserves, or it steals the clicks meant for what is drawn below it.
    expect(at(diagram(), UNDER_THE_BAND)).toBe(false);
  });

  it('still answers on its border, straight from the model', () => {
    expect(at(diagram(), { x: 5, y: H / 2 })).toBe(true);
  });

  it('reads the band off the declaration, and clamps a degenerate frame', () => {
    const band = umlDiagramBand({ deserializedXYWH: [0, 0, W, H] })!;
    // The band IS the top margin, full width — one number, the model's.
    expect(band).toEqual({ x: 0, y: 0, w: W, h: UML_FRAME_BAND_HEIGHT });

    // A frame dragged shorter than its own heading keeps a band, clamped to
    // what there is: the renderer clamps the same way, so the strip stays
    // honest.
    const squashed = umlDiagramBand({ deserializedXYWH: [0, 0, W, 20] })!;
    expect(squashed.h).toBe(20);

    // Nothing at all is not a band.
    expect(umlDiagramBand({ deserializedXYWH: [0, 0, 0, 0] })).toBeNull();
  });
});

describe('where a UML subject answers the pointer', () => {
  const BW = UML_SUBJECT_BOX.w;
  const BH = UML_SUBJECT_BOX.h;

  const subject = () =>
    frame(UmlSubjectView, { name: 'Order service', w: BW, h: BH });

  /** On the words: top-left of the plot, one line below its top edge. */
  const ON_NAME = {
    x: UML_SUBJECT_MARGIN + 20,
    y: UML_SUBJECT_MARGIN + UML_NAME_FONT_SIZE - 4,
  };

  it('answers over its name, and nowhere else inside the frame', () => {
    // Unchanged by the diagram's band, and it must stay that way: a subject is
    // drawn OVER use cases, so a wide rename zone would swallow the clicks
    // meant for the ellipses it is drawn round.
    expect(at(subject(), ON_NAME)).toBe(true);
    expect(at(subject(), { x: BW / 2, y: BH / 2 })).toBe(false);
    // Across the top, where the diagram frame wears its band — and where a
    // subject wears nothing, because it has no heading to write in one.
    expect(at(subject(), { x: BW / 2, y: 30 })).toBe(false);
  });
});
