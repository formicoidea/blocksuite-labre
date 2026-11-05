import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import {
  GfxBlockElementModel,
  gfxGroupCompatibleSymbol,
  GfxGroupLikeElementModel,
  type GfxModel,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import {
  type BlockSvgPainter,
  renderSelectionSvg,
  selectionSvgModels,
} from '../extensions/export-svg/render.js';
import { CanvasRenderer } from '../renderer/canvas-renderer.js';

/**
 * "Export selection as SVG" (`selection.export.svg`): what the selection
 * export keeps of a selection, and the frame it draws it in.
 *
 * Would have caught: a selected GROUP exported as an empty file (its children
 * are not in the selection, only the group is); a shape this viewer hid
 * reappearing in the file (ADR 0031); a note — a DOM block with no painter —
 * breaking the replay or widening the picture; a shape selected along with its
 * group painted twice; the file framed on something other than what it draws;
 * and an empty file downloaded when nothing selected can be drawn.
 *
 * Stubs grafted on the real prototypes (the arrangement of
 * `export-svg.unit.spec.ts`), a fake `std` that answers the gfx controller and
 * the painter lookup, and a `CanvasRenderer` whose replay draws one rectangle
 * per element: the paint itself is the integration suite's
 * (`canvas-svg-export.spec.ts`), this pins the selection.
 */

/** `fields` as own values on a bare instance of `proto`, shadowing its getters. */
function graft<T>(proto: object, fields: Record<PropertyKey, unknown>): T {
  return Object.defineProperties(
    Object.create(proto),
    Object.fromEntries(
      Reflect.ownKeys(fields).map(key => [key, { value: fields[key] }])
    )
  ) as T;
}

/** What `boardSvgMarkers` reads off a canvas element, all absent. */
const NO_LINKS = {
  role: undefined,
  group: null,
  source: undefined,
  target: undefined,
};

function primitive(id: string, xywh: string): GfxPrimitiveElementModel {
  return graft(GfxPrimitiveElementModel.prototype, {
    id,
    xywh,
    type: 'shape',
    ...NO_LINKS,
  });
}

function group(id: string, descendants: GfxModel[]): GfxModel {
  const bound = descendants
    .map(child => Bound.deserialize(child.xywh))
    .reduce((all, one) => all.unite(one));
  return graft(GfxGroupLikeElementModel.prototype, {
    id,
    xywh: bound.serialize(),
    type: 'group',
    ...NO_LINKS,
    descendantElements: descendants,
    [gfxGroupCompatibleSymbol]: true,
  });
}

function block(id: string, flavour: string, xywh: string): GfxModel {
  const bound = Bound.deserialize(xywh);
  return graft(GfxBlockElementModel.prototype, {
    id,
    flavour,
    xywh,
    x: bound.x,
    y: bound.y,
    group: null,
  });
}

/** One rectangle per element, so the file has something in each group. */
function fakeRenderer(): CanvasRenderer {
  const renderer = Object.create(CanvasRenderer.prototype);
  Object.defineProperty(renderer, 'withColorScheme', {
    value: <T>(_scheme: unknown, paint: () => T) => paint(),
  });
  Object.defineProperty(renderer, 'renderBoundTo', {
    value: (
      ctx: CanvasRenderingContext2D,
      _rc: unknown,
      frame: Bound,
      [element]: { xywh: string }[]
    ) => {
      const own = Bound.deserialize(element.xywh);
      ctx.fillRect(own.x - frame.x, own.y - frame.y, own.w, own.h);
    },
  });
  return renderer as CanvasRenderer;
}

const PAINTED_FLAVOUR = 'affine:edgeless-text';

function fakeStd(options: {
  zOrder: GfxModel[];
  hidden?: GfxModel[];
  renderer?: CanvasRenderer | null;
}): BlockStdScope {
  const hidden = new Set(options.hidden ?? []);
  const painter: BlockSvgPainter = (_model, ctx) => ctx.fillRect(0, 0, 1, 1);
  const gfx = {
    layer: {
      compare: (a: GfxModel, b: GfxModel) =>
        options.zOrder.indexOf(a) - options.zOrder.indexOf(b),
    },
    localVisibility: { isHidden: (model: GfxModel) => hidden.has(model) },
    surfaceComponent: {
      renderer:
        options.renderer === undefined ? fakeRenderer() : options.renderer,
    },
  };
  return {
    get: () => gfx,
    getOptional: (identifier: { identifierName: string; variant: string }) =>
      identifier.identifierName === 'block-svg-painter' &&
      identifier.variant === PAINTED_FLAVOUR
        ? painter
        : null,
  } as unknown as BlockStdScope;
}

const ids = (models: readonly { id: string }[]) => models.map(m => m.id);

describe('what the selection export keeps', () => {
  test('a selected group brings its descendants, in the canvas z-order', () => {
    const a = primitive('a', '[0,0,10,10]');
    const b = primitive('b', '[50,50,10,10]');
    const g = group('g', [b, a]);
    const std = fakeStd({ zOrder: [g, a, b] });

    const { elements, textBlocks } = selectionSvgModels(std, [g]);

    expect(ids(elements)).toEqual(['g', 'a', 'b']);
    expect(textBlocks).toEqual([]);
  });

  test('what this viewer hid is left out, inside a group too', () => {
    const kept = primitive('kept', '[0,0,10,10]');
    const hidden = primitive('hidden', '[50,0,10,10]');
    const inGroup = primitive('in-group', '[0,50,10,10]');
    const g = group('g', [inGroup]);
    const std = fakeStd({
      zOrder: [kept, hidden, g, inGroup],
      hidden: [hidden, inGroup],
    });

    const { elements } = selectionSvgModels(std, [kept, hidden, g]);

    expect(ids(elements)).toEqual(['kept', 'g']);
  });

  test('a block without a painter is set aside, one with a painter is kept', () => {
    const shape = primitive('shape', '[0,0,10,10]');
    const note = block('note', 'affine:note', '[0,0,500,500]');
    const text = block('text', PAINTED_FLAVOUR, '[20,0,30,10]');
    const std = fakeStd({ zOrder: [note, shape, text] });

    const { elements, textBlocks } = selectionSvgModels(std, [
      note,
      shape,
      text,
    ]);

    expect(ids(elements)).toEqual(['shape']);
    expect(ids(textBlocks)).toEqual(['text']);
  });

  test('a shape selected with its group is kept once', () => {
    const a = primitive('a', '[0,0,10,10]');
    const g = group('g', [a]);
    const std = fakeStd({ zOrder: [g, a] });

    expect(ids(selectionSvgModels(std, [a, g]).elements)).toEqual(['g', 'a']);
  });
});

/** Two shapes far apart, and the rectangle from a's corner to b's far one. */
const A_XYWH = '[100,100,50,50]';
const B_XYWH = '[300,200,100,40]';
const A_TO_B = '[100,100,300,140]';

describe('renderSelectionSvg', () => {
  test('frames the file on what it draws, a note excluded, with markers', () => {
    const a = primitive('a', A_XYWH);
    const b = primitive('b', B_XYWH);
    const note = block('note', 'affine:note', '[-1000,-1000,100,100]');
    const std = fakeStd({ zOrder: [note, a, b] });

    const rendered = renderSelectionSvg(std, [a, b, note]);

    expect(rendered).not.toBeNull();
    // From a's corner to b's far corner; the note, far away, widens nothing.
    expect(rendered!.bound.serialize()).toBe(A_TO_B);
    expect(rendered!.svg).toContain('viewBox="0 0 300 140"');
    expect(rendered!.svg).toContain('data-labre-id="a"');
    expect(rendered!.svg).toContain('data-labre-id="b"');
    expect(rendered!.svg).not.toContain('data-labre-id="note"');
  });

  test('null when nothing selected can be drawn, so no empty file', () => {
    const note = block('note', 'affine:note', '[0,0,100,100]');
    const hidden = primitive('hidden', '[0,0,10,10]');
    const std = fakeStd({ zOrder: [note, hidden], hidden: [hidden] });

    expect(renderSelectionSvg(std, [note, hidden])).toBeNull();
  });

  test('null without a CanvasRenderer to replay', () => {
    const a = primitive('a', '[0,0,10,10]');
    const std = fakeStd({ zOrder: [a], renderer: null });

    expect(renderSelectionSvg(std, [a])).toBeNull();
  });
});
