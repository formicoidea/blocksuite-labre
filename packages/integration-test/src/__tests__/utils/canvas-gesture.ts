import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { DefaultTool } from '@labre/affine/blocks/surface';
import type { GfxModel } from '@labre/std/gfx';
import { userEvent } from '@vitest/browser/context';
import { expect } from 'vitest';

import { wait } from './common.js';
import { pointerDown, pointerMoveTo, pointerUp } from './pointer.js';

/**
 * A real-mouse drag of one canvas model that does not depend on what ran
 * before it.
 *
 * The suite shares ONE page across every spec file (`isolate: false`), so a
 * gesture that presses "the middle of the canvas" presses wherever the page
 * left the canvas: below the 768px window once something sits above the
 * editor, on a docked panel, in the 20px auto-pan edge zone (#427). This
 * helper owns the camera instead: the default tool, zoom 1, the model's
 * centre moved under a point of the canvas that is on screen and clear of
 * the edges and of a pane docked on the left; then it checks that the canvas
 * really answers that model at that point before it presses, so a harness
 * miss fails as one, not as "the drag did nothing".
 */
export async function dragModel(
  edgeless: EdgelessRootBlockComponent,
  model: GfxModel,
  options: { alt?: boolean; dx?: number } = {}
) {
  const { alt = false, dx = 0.1 } = options;
  const gfx = edgeless.gfx;
  gfx.tool.setTool(DefaultTool);

  // A selector that names THIS editor's canvas, whatever else the page holds.
  edgeless.dataset.gestureCanvas = 'current';
  const selector = '[data-gesture-canvas="current"]';

  const root = edgeless.getBoundingClientRect();
  const top = Math.max(root.top, 0);
  const bottom = Math.min(root.bottom, window.innerHeight);
  const target = {
    x: root.left + root.width * 0.6,
    y: (top + bottom) / 2,
  };

  const [cx, cy] = model.elementBound.center;
  gfx.viewport.setZoom(1);
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

  const [mx, my] = gfx.viewport.toModelCoordFromClientCoord([
    target.x,
    target.y,
  ]);
  expect(
    gfx.getElementByPoint(mx, my, { all: false })?.id,
    'the press point is on the model'
  ).toBe(model.id);

  const fx = (target.x - root.left) / root.width;
  const fy = (target.y - root.top) / root.height;
  await pointerMoveTo(selector, fx, fy, 1);
  if (alt) await userEvent.keyboard('{Alt>}');
  try {
    await pointerDown();
    await pointerMoveTo(selector, fx + dx, fy, 8);
    await pointerUp();
  } finally {
    if (alt) await userEvent.keyboard('{/Alt}');
  }
  await edgeless.updateComplete;
  await wait(50);
}
