/**
 * Please refer to integration-test/README.md for commands to run tests.
 */
import {
  ElementHighlightOverlay,
  OverlayIdentifier,
} from '@labre/affine/blocks/surface';
import {
  type GfxController,
  GfxControllerIdentifier,
} from '@labre/affine/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

describe('element highlight', () => {
  let gfx!: GfxController;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    gfx = editor.std.get(GfxControllerIdentifier);
    return cleanup;
  });

  test('the highlight overlay should be registered on edgeless', () => {
    const overlay = editor.std.getOptional(
      OverlayIdentifier('element-highlight')
    );

    expect(overlay).toBeInstanceOf(ElementHighlightOverlay);
  });

  test('should highlight real elements and clear after the given duration', async () => {
    const surface = doc.getModelsByFlavour('affine:surface')[0]!;
    const shapeId = gfx.surface!.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    const frameId = doc.addBlock(
      'affine:frame',
      { xywh: '[200,0,300,300]' },
      surface.id
    );
    await wait();

    gfx.highlightElements([shapeId, frameId, 'unknown-id'], { duration: 30 });

    expect(gfx.highlight.highlighted$.value).toEqual([shapeId, frameId]);
    expect(gfx.highlight.highlightedElements).toHaveLength(2);

    await wait(60);

    expect(gfx.highlight.highlighted$.value).toEqual([]);
  });

  test('should reframe the viewport when asked, without touching the selection', async () => {
    const shapeId = gfx.surface!.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[2000,2000,100,100]',
    });
    await wait();

    gfx.viewport.setViewport(1, [0, 0]);
    await wait();

    gfx.highlightElements([shapeId], {
      reframe: true,
      smooth: false,
      duration: 0,
    });
    await wait();

    expect(gfx.viewport.centerX).toBeCloseTo(2050, 0);
    expect(gfx.viewport.centerY).toBeCloseTo(2050, 0);
    expect(gfx.selection.surfaceSelections).toEqual([]);

    gfx.highlight.clear();
    expect(gfx.highlight.highlighted$.value).toEqual([]);
  });
});
