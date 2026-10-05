import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { DefaultTool } from '@labre/affine/blocks/surface';
import type { ShapeElementModel } from '@labre/affine/model';
import type { GfxController } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import {
  click,
  pointerdown,
  pointermove,
  pointerup,
  wait,
} from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Dragging elements towards the edge of the canvas pans the viewport, the way
 * the selection rectangle already does (`DefaultTool`, `calPanDelta`: 20 px
 * edge zone, 30 px per tick). Without it an element can only travel as far as
 * the visible viewport, and the user has to drop, pan and pick it up again.
 *
 * What is held here, through real pointer input on the host:
 * - holding the pointer in the edge zone keeps panning the viewport;
 * - the dragged element stays under the pointer in model coordinates while
 *   the viewport pans under a still pointer — `InteractivityManager` re-applies
 *   the move on `viewportMoved`, and once replayed the drag START event, which
 *   snapped the element back to where the gesture began;
 * - the pan stops with the drag, and the whole gesture stays one undo step;
 * - nothing pans when the move is refused (readonly store, locked element).
 */

const SHAPE_XYWH = '[0,0,100,100]';
// Grab point inside the shape, in model coordinates.
const GRAB = { x: 50, y: 50 };
// Pointer distance from the right edge: inside the 20 px edge zone.
const EDGE_INSET = 5;

describe('auto-pan while dragging elements', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let gfx!: GfxController;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    gfx = edgeless.gfx;
    gfx.tool.setTool(DefaultTool);
    return cleanup;
  });

  async function addShape() {
    const id = gfx.surface!.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: SHAPE_XYWH,
    });
    await wait();
    gfx.viewport.setViewport(1, [
      gfx.viewport.width / 2,
      gfx.viewport.height / 2,
    ]);
    await wait();
    return gfx.getElementById(id) as ShapeElementModel;
  }

  /** Model point → position relative to the host, what the helpers take. */
  function toHost(modelX: number, modelY: number) {
    const [vx, vy] = gfx.viewport.toViewCoord(modelX, modelY);
    const host = edgeless.host.getBoundingClientRect();
    return {
      x: gfx.viewport.left + vx - host.x,
      y: gfx.viewport.top + vy - host.y,
    };
  }

  /** A point in the right edge zone, vertically level with `from`. */
  function rightEdge(from: { x: number; y: number }) {
    const host = edgeless.host.getBoundingClientRect();
    return {
      x: gfx.viewport.left + gfx.viewport.width - EDGE_INSET - host.x,
      y: from.y,
    };
  }

  function pointerModel(at: { x: number; y: number }) {
    const host = edgeless.host.getBoundingClientRect();
    return gfx.viewport.toModelCoordFromClientCoord([
      host.x + at.x,
      host.y + at.y,
    ]);
  }

  /** Grabs the shape and walks the pointer into the right edge zone. */
  function dragToEdge(start: { x: number; y: number }) {
    const end = rightEdge(start);
    pointerdown(edgeless.host, start);
    pointermove(edgeless.host, start);
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      pointermove(edgeless.host, {
        x: start.x + ((end.x - start.x) * i) / steps,
        y: start.y,
      });
    }
    return end;
  }

  function hold(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  test('pans while held at the edge, the element follows, one undo restores it', async () => {
    const shape = await addShape();
    const start = toHost(GRAB.x, GRAB.y);
    click(edgeless.host, start);
    expect(gfx.selection.selectedIds).toEqual([shape.id]);

    const centerBefore = gfx.viewport.centerX;
    const end = dragToEdge(start);
    await hold(300);

    // (1) the viewport kept panning towards the edge.
    const centerDuringHold = gfx.viewport.centerX;
    expect(centerDuringHold).toBeGreaterThan(centerBefore + 50);

    // (2) the element is still under the pointer, in model coordinates.
    const [pointerX, pointerY] = pointerModel(end);
    expect(shape.x).toBeCloseTo(pointerX - GRAB.x, 0);
    expect(shape.y).toBeCloseTo(pointerY - GRAB.y, 0);

    pointermove(edgeless.host, end);
    pointerup(edgeless.host, end);
    await wait();

    // The drop lands where the pointer was released.
    const [dropX] = pointerModel(end);
    expect(shape.x).toBeCloseTo(dropX - GRAB.x, 0);

    // (4) nothing pans once the drag is over.
    const centerAtRelease = gfx.viewport.centerX;
    await hold(150);
    expect(gfx.viewport.centerX).toBe(centerAtRelease);

    // (3) the whole gesture, panning included, is one undo step.
    window.doc.undo();
    await wait();
    expect(shape.xywh).toBe(SHAPE_XYWH);
  });

  test('a readonly board does not pan on an element drag', async () => {
    const shape = await addShape();
    const start = toHost(GRAB.x, GRAB.y);
    click(edgeless.host, start);
    expect(gfx.selection.selectedIds).toEqual([shape.id]);
    edgeless.std.store.readonly = true;

    const centerBefore = gfx.viewport.centerX;
    const end = dragToEdge(start);
    await hold(150);
    pointerup(edgeless.host, end);
    await wait();

    expect(gfx.viewport.centerX).toBe(centerBefore);
    expect(shape.xywh).toBe(SHAPE_XYWH);
  });

  test('a locked element refuses the drag and does not pan', async () => {
    const shape = await addShape();
    shape.lock();
    await wait();
    const start = toHost(GRAB.x, GRAB.y);
    click(edgeless.host, start);

    const centerBefore = gfx.viewport.centerX;
    const end = dragToEdge(start);
    await hold(150);
    pointerup(edgeless.host, end);
    await wait();

    expect(gfx.viewport.centerX).toBe(centerBefore);
    expect(shape.xywh).toBe(SHAPE_XYWH);
  });
});
