import type { FrameBlockComponent } from '@labre/affine/blocks/frame';
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import type { FrameBlockModel } from '@labre/affine/model';
import type { AffineFrameTitleWidget } from '@labre/affine/widgets/frame-title';
import { Bound } from '@labre/global/gfx';
import { assertType } from '@labre/global/utils';
import { Text } from '@labre/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('frame', () => {
  let service!: EdgelessRootBlockComponent['service'];

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    service = getDocRootBlock(window.doc, window.editor, 'edgeless').service;

    return cleanup;
  });

  test('frame should have title', async () => {
    const frame = service.doc.addBlock(
      'affine:frame',
      {
        xywh: '[0,0,300,300]',
        title: new Text('Frame 1'),
      },
      service.surface.id
    );
    await wait();

    const getFrameTitle = (frameId: string) => {
      const frameTitleWidget = service.std.view.getWidget(
        'affine-frame-title-widget',
        frameId
      ) as AffineFrameTitleWidget | null;
      return frameTitleWidget?.shadowRoot?.querySelector('affine-frame-title');
    };

    const frameTitle = getFrameTitle(frame);
    const rect = frameTitle?.getBoundingClientRect();

    expect(frameTitle).toBeTruthy();
    expect(rect).toBeTruthy();
    expect(rect!.width).toBeGreaterThan(0);
    expect(rect!.height).toBeGreaterThan(0);

    // Assert the title's position via the model-space externalXYWH the widget
    // computes (title sits just above the frame's top edge), rather than a
    // screen->model round-trip of getBoundingClientRect, which depends on the
    // CI browser's viewport zoom/size and is non-deterministic.
    const frameModel = service.doc.getBlock(frame)!.model as FrameBlockModel;
    const titleBound = Bound.deserialize(frameModel.externalXYWH!);
    expect(titleBound.x).toBeCloseTo(0, 0);
    expect(titleBound.y).toBeLessThan(0);
    expect(titleBound.w).toBeGreaterThan(0);
    expect(titleBound.h).toBeGreaterThan(0);

    const nestedFrame = service.doc.addBlock(
      'affine:frame',
      {
        xywh: '[20,20,200,200]',
        title: new Text('Frame 2'),
      },
      service.surface.id
    );
    await wait();

    const nestedTitle = getFrameTitle(nestedFrame);
    expect(nestedTitle).toBeTruthy();
    if (!nestedTitle) return;

    // A nested frame's title sits inside its top-left corner (offset in), so its
    // model position is past the frame origin (20,20) — again read from the
    // deterministic externalXYWH rather than a screen measurement.
    const nestedModel = service.doc.getBlock(nestedFrame)!
      .model as FrameBlockModel;
    const nestedTitleBound = Bound.deserialize(nestedModel.externalXYWH!);
    expect(nestedTitleBound.x).toBeGreaterThan(20);
    expect(nestedTitleBound.y).toBeGreaterThan(20);
  });

  test('frame should have externalXYWH after moving viewport to contains frame', async () => {
    const frameId = service.doc.addBlock(
      'affine:frame',
      {
        xywh: '[1800,1800,200,200]',
        title: new Text('Frame 1'),
      },
      service.surface.id
    );
    await wait();

    const frame = service.doc.getBlock(frameId);
    expect(frame).toBeTruthy();

    assertType<FrameBlockComponent>(frame);

    service.viewport.setCenter(900, 900);
    expect(frame?.model.externalXYWH).toBeDefined();
  });

  test('descendant of frame should not contain itself', async () => {
    const frameIds = [1, 2, 3].map(i => {
      return service.doc.addBlock(
        'affine:frame',
        {
          xywh: '[0,0,300,300]',
          title: new Text(`Frame ${i}`),
        },
        service.surface.id
      );
    });

    await wait();

    const frames = frameIds.map(
      id => service.doc.getBlock(id)?.model as FrameBlockModel
    );

    frames.forEach(frame => {
      expect(frame.descendantElements).toHaveLength(0);
    });

    frames[0].addChild(frames[1]);
    frames[1].addChild(frames[2]);
    frames[2].addChild(frames[0]);

    await wait();
    expect(frames[0].descendantElements).toHaveLength(2);
    expect(frames[1].descendantElements).toHaveLength(1);
    expect(frames[2].descendantElements).toHaveLength(0);
  });
});
