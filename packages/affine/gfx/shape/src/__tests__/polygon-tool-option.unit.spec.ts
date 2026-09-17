import type { PointerEventState } from '@labre/std';
import { describe, expect, it, vi } from 'vitest';

import { PolygonTool, type PolygonToolOption } from '../polygon-tool.js';

/**
 * The activation seam of the polygon tool.
 *
 * A framework arms this tool to draw ITS artefact — a Wardley zone, drawn
 * corner by corner instead of dropped as a prefabricated pentagon (#343) — so
 * the outline the author closes has to come out already typed. The seam is the
 * same shape as `ConnectorTool`'s `role` / `style` options: props stamped on
 * the element at creation, plus the one placement an element description cannot
 * express.
 *
 * What the plain tool draws must be untouched, which is the other half of every
 * case below.
 */

type Added = Record<string, unknown>;

/** A click at the given MODEL coordinates — the viewport fake is 1:1. */
const at = (x: number, y: number) =>
  ({ point: { x, y }, x, y }) as unknown as PointerEventState;

/**
 * Minimal GfxController stand-in: the members `_finishDrawing` actually
 * touches, and nothing else. No overlay is created (the tool is never
 * `activate`d), so the preview machinery stays out of the way.
 */
function fakeGfx() {
  const added: Added[] = [];

  const gfx = {
    surface: {
      addElement: (props: Added) => {
        added.push(props);
        return 'el-0';
      },
    },
    surfaceComponent: null,
    viewport: {
      zoom: 1,
      toModelCoord: (x: number, y: number) => [x, y],
    },
    getElementById: (id: string) => ({ id }),
    selection: { set: vi.fn() },
    tool: { setTool: vi.fn(), currentTool$: { peek: () => null } },
    doc: { captureSync: vi.fn() },
    std: {
      get: () => ({ lastProps$: { value: {} } }),
      getOptional: () => undefined,
    },
  };

  return { gfx: gfx as never, added };
}

/** Draw a closed triangle with the given activation, and report what was added. */
function draw(option: PolygonToolOption) {
  const { gfx, added } = fakeGfx();
  const tool = new PolygonTool(gfx);
  tool.activatedOption = option;

  tool.click(at(0, 0));
  tool.click(at(200, 0));
  tool.click(at(200, 120));
  // The gesture that finishes: a double-click on the last corner places nothing
  // new (too close to it) and closes the outline.
  tool.doubleClick(at(200, 120));

  return { gfx, added };
}

describe('what the activation stamps on the drawn polygon', () => {
  it('writes nothing of its own for the plain tool', () => {
    const { added } = draw({});

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ type: 'shape', shapeType: 'polygon' });
  });

  it('lets an activation retype the element and dress it', () => {
    const { added } = draw({
      props: { type: 'wardleyNode', kind: 'area', role: 'wardley:area' },
    });

    expect(added[0]).toMatchObject({
      type: 'wardleyNode',
      kind: 'area',
      role: 'wardley:area',
      shapeType: 'polygon',
    });
  });

  it('keeps the outline the author drew over the one the props carry', () => {
    // The trap this seam has to survive: a framework describes its artefact
    // with the box and the outline it would have been born with, and those are
    // exactly the two things the author just replaced by drawing.
    const { added } = draw({
      props: {
        xywh: '[900,900,200,200]',
        vertices: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0.5, 0.5],
        ],
      },
    });

    expect(added[0].xywh).toBe('[0,0,200,120]');
    expect(added[0].vertices).toHaveLength(3);
    expect(added[0].isClosed).toBe(true);
  });

  it('hands the new element to the activation, once it exists', () => {
    const onCreated = vi.fn();
    const { gfx } = draw({ onCreated });

    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith(gfx, 'el-0');
  });

  it('calls nothing back when the gesture draws no polygon', () => {
    // Escape, and a two-corner outline: the tool already refuses both, and a
    // hook that fired on them would have a framework dress an element that was
    // never created.
    const onCreated = vi.fn();
    const { gfx, added } = fakeGfx();
    const tool = new PolygonTool(gfx);
    tool.activatedOption = { onCreated };

    tool.click(at(0, 0));
    tool.click(at(200, 0));
    tool.doubleClick(at(200, 0));

    expect(added).toEqual([]);
    expect(onCreated).not.toHaveBeenCalled();
  });
});
