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

  test('new element created inside a frame renders above existing frame children', async () => {
    const surface = service.surface;

    const aId = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    await wait();

    const a = surface.getElementById(aId)!;
    const frame = service.frame.createFrameOnBound(new Bound(-50, -50, 300, 250));
    await wait();
    expect(a.group).toBe(frame);

    // mimic the shape tool: a new element created inside the frame's bounds
    // is auto-adopted by the frame one microtask later
    const bId = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[40,30,100,100]',
    });
    await wait();

    const b = surface.getElementById(bId)!;
    expect(b.group).toBe(frame);
    // strict inequality: an index tie makes the render order depend on map
    // iteration order, which flips on layer rebuilds (the original bug)
    expect(b.index > a.index).toBe(true);
    expect(service.layer.compare(a, b)).toBeLessThan(0);
  });

  test('framing existing elements preserves their relative z-order', async () => {
    const surface = service.surface;

    const bottomId = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    const topId = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[50,50,100,100]',
    });
    await wait();

    const bottom = surface.getElementById(bottomId)!;
    const top = surface.getElementById(topId)!;
    const bottomIndex = bottom.index;
    const topIndex = top.index;

    service.frame.createFrameOnBound(new Bound(-50, -50, 300, 300));
    await wait();

    expect(bottom.index).toBe(bottomIndex);
    expect(top.index).toBe(topIndex);
    expect(service.layer.compare(bottom, top)).toBeLessThan(0);
  });

  test('a frame drawn on top of an enclosing background is not swallowed by it', async () => {
    const surface = service.surface;

    // A Wardley map background is a large canvas element. Creating it and a
    // frame drawn inside it in the same tick makes the background's adoption
    // microtask run once the frame already exists: getFrameFromPoint matches
    // because the background's center falls inside the frame.
    const bgId = surface.addElement({
      type: 'wardley',
      xywh: '[0,0,1600,900]',
    });
    // frame fully inside the background, and containing its center [800,450]
    const frame = service.frame.createFrameOnBound(
      new Bound(700, 350, 400, 300)
    );
    await wait();

    const bg = surface.getElementById(bgId)!;

    // The background must NOT be adopted as the frame's child: a frame renders
    // behind everything it owns, so swallowing its own backdrop would bury the
    // frame with no way to raise it.
    expect(bg.group).toBeNull();
    expect(frame.childElements).toHaveLength(0);
  });

  test('a frame drawn on top of an enclosing background stays raisable above it', async () => {
    const surface = service.surface;

    const bgId = surface.addElement({
      type: 'wardley',
      xywh: '[0,0,1600,900]',
    });
    const frame = service.frame.createFrameOnBound(
      new Bound(700, 350, 400, 300)
    );
    await wait();

    const bg = surface.getElementById(bgId)!;

    // "Bring to front" must be able to raise the frame above the background.
    service.reorderElement(frame, 'front');
    await wait();

    expect(service.layer.compare(frame, bg)).toBeGreaterThan(0);
  });

  test('a frame taller than the background is not swallowed either', async () => {
    const surface = service.surface;

    // The adversarial probe of the geometric rule: this frame contains the
    // background's center — so adoption matches — but the background does NOT
    // fully enclose it. A purely geometric "encloses the frame" guard lets
    // this one through; the semantic rule (a framework background is never
    // frame content) must not.
    const bgId = surface.addElement({
      type: 'wardley',
      xywh: '[0,0,1600,900]',
    });
    const frame = service.frame.createFrameOnBound(
      new Bound(700, -200, 200, 1300)
    );
    await wait();

    const bg = surface.getElementById(bgId)!;

    expect(bg.group).toBeNull();
    expect(frame.childElements).toHaveLength(0);
  });

  test('undo of a deleted frame child restores its z-order untouched', async () => {
    const surface = service.surface;

    surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    await wait();
    service.frame.createFrameOnBound(new Bound(-50, -50, 300, 250));
    await wait();

    // a gfx BLOCK inside the frame (the blockUpdated adoption path)
    const noteId = service.doc.addBlock(
      'affine:note',
      { xywh: '[20,20,60,60]' },
      service.doc.root!.id
    );
    await wait();

    const note = service.doc.getBlock(noteId)!.model as FrameBlockModel;
    const restoredIndex = note.props.index;

    service.doc.captureSync();
    service.doc.deleteBlock(note);
    service.doc.captureSync();
    await wait();

    service.doc.undo();
    await wait();

    // the re-added child keeps its restored index — no hoist to the top
    const reAdded = service.doc.getBlock(noteId)!.model as FrameBlockModel;
    expect(reAdded.props.index).toBe(restoredIndex);
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
