import {
  backgroundIncludesPoint,
  UML_FRAME_BAND_HEIGHT,
} from '@labre/affine-model';
import { GfxViewEventManager } from '@labre/std/gfx';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  umlDiagramBand,
  umlFragmentOperands,
  umlInDiagramBand,
  umlInPartitionBand,
  umlInRegionBand,
  umlPartitionBand,
  umlRegionBand,
} from '../board-hit.js';
import {
  UML_DIAGRAM_BOX,
  UML_DIAGRAM_MARGIN,
  UML_FRAGMENT_BOX,
  UML_NAME_FONT_SIZE,
  UML_PARTITION_BAND,
  UML_PARTITION_BOX,
  UML_REGION_BAND,
  UML_REGION_BOX,
  UML_SUBJECT_BOX,
  UML_SUBJECT_MARGIN,
} from '../consts.js';
import {
  UmlDiagramView,
  UmlFragmentView,
  UmlPartitionView,
  UmlRegionView,
  UmlSubjectView,
} from '../element-view.js';

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

  const gfx: Record<string, unknown> = {
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

  // What the real pointer router walks: the grid returns the models near the
  // point, `view.get` maps each back to its view.
  gfx.grid = { search: () => [model] };
  gfx.view = { get: () => view };

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

/**
 * Everything above calls the view DIRECTLY. `DblClickAddEdgelessText` asks the
 * other layer — the pointer router — whether a double click belongs to a view,
 * and drops a text block wherever the answer is "nobody" (#332). Over a
 * subject's name the MODEL answers "nobody" while the view is opening its
 * rename input; the router's answer is what keeps the text block out.
 */
describe('a double click on a UML frame name is not a double click on empty canvas', () => {
  const BW = UML_SUBJECT_BOX.w;
  const BH = UML_SUBJECT_BOX.h;

  const routerOf = (view: ReturnType<typeof frame>) =>
    new GfxViewEventManager(view.gfx as never);

  it('reports a view over the subject name, where the model reports none', () => {
    const view = frame(UmlSubjectView, { name: 'Order service', w: BW, h: BH });
    const x = UML_SUBJECT_MARGIN + 20;
    const y = UML_SUBJECT_MARGIN + UML_NAME_FONT_SIZE - 4;

    expect(
      backgroundIncludesPoint(
        { x: 0, y: 0, w: BW, h: BH, rotate: 0 },
        x,
        y,
        PICK
      )
    ).toBe(false);
    expect(routerOf(view).hasViewAt(x, y)).toBe(true);
  });

  it('reports a view over the diagram heading', () => {
    expect(routerOf(diagram()).hasViewAt(ON_HEADING.x, ON_HEADING.y)).toBe(
      true
    );
  });

  it('leaves the open sheet free, so a double click there still adds a text', () => {
    expect(
      routerOf(diagram()).hasViewAt(ON_OPEN_SPACE.x, ON_OPEN_SPACE.y)
    ).toBe(false);
  });
});

/* ── The two behaviour frames ──────────────────────────────────────────── */

/** A partition or composite state view over a detached model of the given box. */
function behaviourFrame(
  Ctor: typeof UmlPartitionView | typeof UmlRegionView,
  {
    name,
    w,
    h,
    orientation,
  }: { name: string; w: number; h: number; orientation?: string }
) {
  const model = {
    id: 'frame',
    name,
    orientation,
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

const atPoint = (
  view: ReturnType<typeof behaviourFrame>,
  p: { x: number; y: number }
): boolean => view.includesPoint(p.x, p.y, PICK as never, null as never);

describe('where a UML partition answers the pointer', () => {
  const W = UML_PARTITION_BOX.w;
  const H = UML_PARTITION_BOX.h;

  const column = () =>
    behaviourFrame(UmlPartitionView, {
      name: 'Vendeur',
      w: W,
      h: H,
      orientation: 'vertical',
    });

  const row = () =>
    behaviourFrame(UmlPartitionView, {
      name: 'Vendeur',
      w: H,
      h: W,
      orientation: 'horizontal',
    });

  it('answers over the WHOLE header band of a column, words or no words', () => {
    // The band is what the model picks, so the click that selects the lane and
    // the click that renames it are the same click. It matters more here than
    // on the sheet: a partition is transparent, so the header is the only wide
    // part of it a user can take hold of.
    expect(atPoint(column(), { x: W / 2, y: 4 })).toBe(true);
    expect(atPoint(column(), { x: W / 2, y: UML_PARTITION_BAND - 1 })).toBe(
      true
    );
    expect(
      umlInPartitionBand(
        { deserializedXYWH: [0, 0, W, H], orientation: 'vertical' },
        [W / 2, UML_PARTITION_BAND - 1]
      )
    ).toBe(true);
  });

  it('lets the lane go below its header, so the actions in it get the click', () => {
    expect(atPoint(column(), { x: W / 2, y: UML_PARTITION_BAND + 20 })).toBe(
      false
    );
    expect(atPoint(column(), { x: W / 2, y: H / 2 })).toBe(false);
    // …and still answers on its border, straight from the model.
    expect(atPoint(column(), { x: 4, y: H / 2 })).toBe(true);
  });

  /**
   * A ROW wears its header down the left edge instead — the one thing
   * `orientation` changes, and the case that proves the view asks the same
   * function the renderer does rather than assuming a top band.
   */
  it('moves the row’s rename zone to the left edge', () => {
    expect(atPoint(row(), { x: 4, y: W / 2 })).toBe(true);
    expect(atPoint(row(), { x: UML_PARTITION_BAND - 1, y: W / 2 })).toBe(true);
    expect(atPoint(row(), { x: UML_PARTITION_BAND + 20, y: W / 2 })).toBe(
      false
    );
    // Across the top, where a COLUMN wears its band and a row wears nothing —
    // well clear of the border band, which would answer for another reason.
    expect(atPoint(row(), { x: H / 2, y: 20 })).toBe(false);
  });

  it('reads the band off the declaration, and clamps a degenerate lane', () => {
    const band = umlPartitionBand({
      deserializedXYWH: [0, 0, W, H],
      orientation: 'vertical',
    })!;
    // The band IS the deep margin, full width — one number, the model's.
    expect(band).toEqual({ x: 0, y: 0, w: W, h: UML_PARTITION_BAND });

    // A row's band is the same thickness, turned onto the other edge.
    const left = umlPartitionBand({
      deserializedXYWH: [0, 0, H, W],
      orientation: 'horizontal',
    })!;
    expect(left).toEqual({ x: 0, y: 0, w: UML_PARTITION_BAND, h: W });

    // Dragged shorter than its own header: clamped to what there is, the way
    // the renderer clamps.
    expect(
      umlPartitionBand({
        deserializedXYWH: [0, 0, W, 20],
        orientation: 'vertical',
      })!.h
    ).toBe(20);

    // Nothing at all is not a band.
    expect(umlPartitionBand({ deserializedXYWH: [0, 0, 0, 0] })).toBeNull();
  });
});

describe('where a UML composite state answers the pointer', () => {
  const W = UML_REGION_BOX.w;
  const H = UML_REGION_BOX.h;

  const region = () =>
    behaviourFrame(UmlRegionView, { name: 'Commande', w: W, h: H });

  it('answers over its whole name band, and nowhere else inside', () => {
    expect(atPoint(region(), { x: W / 2, y: 4 })).toBe(true);
    expect(atPoint(region(), { x: W / 2, y: UML_REGION_BAND - 1 })).toBe(true);
    // Below the band the sub-machine keeps its clicks.
    expect(atPoint(region(), { x: W / 2, y: UML_REGION_BAND + 20 })).toBe(
      false
    );
    expect(atPoint(region(), { x: W / 2, y: H / 2 })).toBe(false);
    // The border still answers.
    expect(atPoint(region(), { x: 4, y: H / 2 })).toBe(true);
  });

  it('reads the band off the declaration, and clamps a degenerate frame', () => {
    expect(umlRegionBand({ deserializedXYWH: [0, 0, W, H] })).toEqual({
      x: 0,
      y: 0,
      w: W,
      h: UML_REGION_BAND,
    });
    expect(umlRegionBand({ deserializedXYWH: [0, 0, W, 20] })!.h).toBe(20);
    expect(umlRegionBand({ deserializedXYWH: [0, 0, 0, 0] })).toBeNull();
    expect(
      umlInRegionBand({ deserializedXYWH: [0, 0, W, H] }, [W / 2, 10])
    ).toBe(true);
  });
});

/* ── The combined fragment's operand guards ────────────────────────────── */

/**
 * A guard lives INSIDE `operands`, so its rename cannot be the shared editor's
 * flat `{ [prop]: value }` patch: the fragment hands the base a label with its
 * own `commit`, and that is what writes the array back — trimmed, and with the
 * key dropped when the guard is cleared.
 */
describe('renaming a UML combined fragment operand guard', () => {
  const FW = UML_FRAGMENT_BOX.w;
  const FH = UML_FRAGMENT_BOX.h;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function fragment() {
    const operands = [
      { id: 'a', name: '[stock > 0]', size: 1 },
      { id: 'b', name: '[else]', size: 1 },
    ];
    const model = {
      id: 'frag',
      operator: 'alt',
      operands,
      deserializedXYWH: [0, 0, FW, FH],
      rotate: 0,
      isLocked: () => false,
      includesPoint: () => false,
    };
    const updateElement = vi.fn((_id: string, _patch: unknown) => {});
    const captureSync = vi.fn();
    const gfx = {
      viewport: { toModelCoord: (x: number, y: number) => [x, y] },
      selection: { set: vi.fn(), selectedIds: [] },
      cursor$: { value: 'default' },
      std: {
        store: { captureSync, readonly: false },
        get: () => ({ updateElement }),
        getOptional: () => null,
      },
    };
    const view = new UmlFragmentView(model as never, gfx as never);
    view.onCreated();

    // The second operand's guard corner, read off the same geometry the
    // renderer lays the bands out from.
    const { plot, bands } = umlFragmentOperands(model)!;
    const onGuard = { x: plot.x0 + 10, y: bands[1].top + 6 };

    const dblclick = (at: { x: number; y: number }) =>
      view.dispatch('dblclick', {
        ...at,
        raw: { clientX: at.x, clientY: at.y },
      } as never);
    const editor = () => document.querySelector('input');

    return { view, dblclick, editor, onGuard, updateElement, captureSync };
  }

  it('answers the pointer over the guard, and opens on that guard', () => {
    const { view, dblclick, editor, onGuard } = fragment();
    expect(
      view.includesPoint(onGuard.x, onGuard.y, PICK as never, null as never)
    ).toBe(true);

    dblclick(onGuard);
    expect(editor()?.value).toBe('[else]');
  });

  it('writes the trimmed guard into its operand, and nothing else', () => {
    const { dblclick, editor, onGuard, updateElement, captureSync } =
      fragment();

    dblclick(onGuard);
    const input = editor()!;
    input.value = '  [stock = 0]  ';
    input.dispatchEvent(new Event('blur'));

    expect(captureSync).toHaveBeenCalledTimes(1);
    expect(updateElement).toHaveBeenCalledTimes(1);
    expect(updateElement).toHaveBeenCalledWith('frag', {
      operands: [
        { id: 'a', name: '[stock > 0]', size: 1 },
        { id: 'b', name: '[stock = 0]', size: 1 },
      ],
    });
  });

  it('drops the key when the guard is cleared', () => {
    const { dblclick, editor, onGuard, updateElement } = fragment();

    dblclick(onGuard);
    const input = editor()!;
    input.value = '   ';
    input.dispatchEvent(new Event('blur'));

    expect(updateElement).toHaveBeenCalledTimes(1);
    const patch = updateElement.mock.calls[0][1] as {
      operands: Record<string, unknown>[];
    };
    expect(patch.operands[1]).toEqual({ id: 'b', size: 1 });
    expect('name' in patch.operands[1]).toBe(false);
  });
});
