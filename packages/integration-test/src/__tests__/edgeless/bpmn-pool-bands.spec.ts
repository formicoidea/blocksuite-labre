import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
// Straight off the framework package, as the bpmn spec already reaches for its
// own: `@labre/affine` re-exports the blocks, not the framework modules.
import { BPMN_ROLE } from '@labre/affine-gfx-bpmn';
import {
  type BpmnPoolElementModel,
  POOL_BAND_WIDTH,
  POOL_LANE_BAND_WIDTH,
} from '@labre/affine/model';
import { beforeEach, describe, expect, test } from 'vitest';

import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * A BPMN pool is SELECTED on its title bands as wide as they are painted, from
 * the moment it exists.
 *
 * The bands grow with their names (`fit: 'wrap'`, PO 2026-10-27), and picking
 * (`gfx.getElementByPoint`) asks the MODEL, which cannot measure text: it
 * selects by the `@local()` cache `paintedBands`. The renderer fills that cache
 * after a paint — but a hidden tab never paints, and the first click can come
 * before the first frame, so the pool's VIEW measures and writes it on
 * creation and whenever a name, the lanes or the box change.
 *
 * This would catch: a click on the widened part of the participant band or of
 * a lane band selecting nothing until the canvas happens to repaint; the flow
 * area just past the painted bands being swallowed by the pool; and a band that
 * keeps its old width after a lane is renamed short. Every check runs with NO
 * wait for a frame between the write and the pick.
 */
describe('a BPMN pool is picked on its bands as painted', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const X = 100;
  const Y = 100;
  const W = 560;
  const H = 200;

  const pick = (x: number, y: number) => edgeless.gfx.getElementByPoint(x, y);

  test('selects on the widened bands before any paint, and follows a rename', () => {
    const surface = getSurface(window.doc, window.editor).model;
    const id = surface.addElement({
      type: 'bpmnPool',
      role: BPMN_ROLE.pool,
      name: 'Group procurement and supplier onboarding office',
      xywh: `[${X},${Y},${W},${H}]`,
      lanes: [
        { id: 'a', name: 'Supplier onboarding and contracts', size: 1 },
        { id: 'b', name: 'Ops', size: 1 },
      ],
    });
    const pool = surface.getElementById(id) as BpmnPoolElementModel;

    // Measured by the view already: no frame has run since the add.
    const bands = pool.paintedBands!;
    expect(bands).toBeDefined();
    expect(bands.margin).toBeGreaterThan(POOL_BAND_WIDTH);
    expect(bands.zoneBandWidth).toBeGreaterThan(POOL_LANE_BAND_WIDTH);
    const laneEdge = bands.margin + bands.zoneBandWidth;

    // Inside the widened participant band, past the declared 28.
    expect(pick(X + bands.margin - 2, Y + H / 2)?.id).toBe(id);
    // Inside the widened strip of the SHORT-named lane, past 28 + 24.
    expect(laneEdge - 2).toBeGreaterThan(
      POOL_BAND_WIDTH + POOL_LANE_BAND_WIDTH
    );
    expect(pick(X + laneEdge - 2, Y + 150)?.id).toBe(id);
    // Just past the painted strip: the flow area, which is not the pool.
    expect(pick(X + laneEdge + 8, Y + 150)).toBeNull();

    // Rename the long lane short: every strip shrinks back to the declared
    // width, and the point that used to hit now misses — still no frame.
    surface.updateElement(id, {
      lanes: [
        { id: 'a', name: 'Sales', size: 1 },
        { id: 'b', name: 'Ops', size: 1 },
      ],
    });
    expect(pool.paintedBands?.zoneBandWidth).toBe(POOL_LANE_BAND_WIDTH);
    expect(pick(X + laneEdge - 2, Y + 150)).toBeNull();
    expect(pick(X + bands.margin + POOL_LANE_BAND_WIDTH - 2, Y + 150)?.id).toBe(
      id
    );
  });
});
