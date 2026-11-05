import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { DefaultTool } from '@labre/affine/blocks/surface';
import type { ShapeElementModel } from '@labre/affine/model';
import { SelectionPaneProvider } from '@labre/affine/shared/services';
import type { GfxController } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { pointerDown, pointerMoveTo, pointerUp } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Edge auto-pan with the selection pane open (issue #433), through
 * Playwright's real mouse.
 *
 * The pane is docked over the left of the canvas in overlay: it covers the
 * canvas without shrinking the editor. The 20 px band that pans left was
 * measured on the container rect, so with the pane open it sat under the
 * pane and an element could not be dragged off the visible left edge. The
 * pane now declares its width to the viewport (`setOccupiedInset`) and the
 * band is measured on `viewport.visibleRect`.
 *
 * What this would have caught:
 * - the pane opening without declaring its inset, or closing without
 *   withdrawing it;
 * - a drag to the pane's edge not panning while the pane is open;
 * - a drag to the container's left edge not panning once it is closed.
 */

const SHAPE_XYWH = '[0,0,100,100]';
// Inside the 20 px band, measured from the edge it is given.
const BAND = 8;

describe('auto-pan beside a docked panel', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let gfx!: GfxController;
  const selector = '[data-gesture-canvas="current"]';

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    edgeless.dataset.gestureCanvas = 'current';
    gfx = edgeless.gfx;
    gfx.tool.setTool(DefaultTool);
    return () => {
      edgeless.std.get(SelectionPaneProvider).close();
      cleanup();
    };
  });

  /** The shape's centre under a point of the canvas clear of every edge. */
  async function placeShape() {
    const id = gfx.surface!.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: SHAPE_XYWH,
    });
    await wait();
    const shape = gfx.getElementById(id) as ShapeElementModel;
    const root = edgeless.getBoundingClientRect();
    const target = {
      x: root.left + root.width * 0.7,
      y: (Math.max(root.top, 0) + Math.min(root.bottom, innerHeight)) / 2,
    };
    gfx.viewport.setZoom(1);
    const [cx, cy] = shape.elementBound.center;
    const [ux, uy] = gfx.viewport.toModelCoordFromClientCoord([
      target.x,
      target.y,
    ]);
    gfx.viewport.setCenter(
      gfx.viewport.centerX + cx - ux,
      gfx.viewport.centerY + cy - uy
    );
    await edgeless.updateComplete;
    await wait(50);
    return { shape, target };
  }

  /** Real mouse: press on `from`, walk to client x `toX`, hold, release. */
  async function dragAndHold(from: { x: number; y: number }, toX: number) {
    const root = edgeless.getBoundingClientRect();
    const fy = (from.y - root.top) / root.height;
    await pointerMoveTo(selector, (from.x - root.left) / root.width, fy, 1);
    await pointerDown();
    try {
      await pointerMoveTo(selector, (toX - root.left) / root.width, fy, 8);
      const before = gfx.viewport.centerX;
      await wait(300);
      return gfx.viewport.centerX - before;
    } finally {
      await pointerUp();
      await wait(50);
    }
  }

  test('with the pane open, a drag to its edge pans the canvas left', async () => {
    const { target } = await placeShape();
    edgeless.std.get(SelectionPaneProvider).open();
    await wait(50);

    const inset = gfx.viewport.occupiedInsets$.value.left;
    expect(inset, 'the open pane declares its width').toBeGreaterThan(100);
    const visibleLeft = gfx.viewport.visibleRect.left;
    expect(visibleLeft).toBeCloseTo(gfx.viewport.left + inset, 5);

    const panned = await dragAndHold(target, visibleLeft + BAND);
    expect(panned).toBeLessThan(-50);
  });

  test('with the pane closed, the inset is gone and the container edge pans', async () => {
    const { target } = await placeShape();
    const pane = edgeless.std.get(SelectionPaneProvider);
    pane.open();
    await wait(50);
    pane.close();
    await wait(50);

    expect(gfx.viewport.occupiedInsets$.value.left).toBe(0);
    expect(gfx.viewport.visibleRect.left).toBe(gfx.viewport.left);

    const panned = await dragAndHold(target, gfx.viewport.left + BAND);
    expect(panned).toBeLessThan(-50);
  });
});
