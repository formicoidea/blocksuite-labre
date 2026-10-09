import type { FrameBlockComponent } from '@labre/affine/blocks/frame';
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import type { FrameBlockModel } from '@labre/affine/model';
import { getRegisteredCommands, runCommand } from '@labre/affine/std';
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
    const frame = service.frame.createFrameOnBound(
      new Bound(-50, -50, 300, 250)
    );
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

  test('a frame drawn on a background renders above it without a reorder', async () => {
    const surface = service.surface;

    // The bug the PO hit: a frame's index is deliberately at the back of the
    // stack so it renders behind its own content — but a Wardley map is an
    // OPAQUE canvas element, so "behind everything" put the frame behind the
    // map and only the overhanging strip stayed visible.
    const bgId = surface.addElement({
      type: 'wardley',
      xywh: '[0,0,1600,900]',
    });
    await wait();

    const frame = service.frame.createFrameOnBound(
      new Bound(700, 350, 400, 300)
    );
    await wait();

    const bg = surface.getElementById(bgId)!;
    expect(service.layer.compare(frame, bg)).toBeGreaterThan(0);
  });

  test('a frame drawn on an EDGY board renders above it', async () => {
    const surface = service.surface;

    // The recette of 2026-09-08: an EDGY board declared itself a plain
    // primitive, so the frame guard never recognised it as a background and
    // the frame went under the board's white paint. Same gesture, same map,
    // same expectation as the Wardley case above — the model base class is
    // what makes them one behaviour.
    const boardId = surface.addElement({
      type: 'edgyBoard',
      xywh: '[0,0,1600,1000]',
    });
    await wait();

    const frame = service.frame.createFrameOnBound(
      new Bound(700, 350, 400, 300)
    );
    await wait();

    const board = surface.getElementById(boardId)!;
    expect(service.layer.compare(frame, board)).toBeGreaterThan(0);
  });

  test('a frame drawn on a background still renders behind its own content', async () => {
    const surface = service.surface;

    surface.addElement({ type: 'wardley', xywh: '[0,0,1600,900]' });
    await wait();

    const frame = service.frame.createFrameOnBound(
      new Bound(700, 350, 400, 300)
    );
    await wait();

    const shapeId = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[800,400,100,100]',
    });
    await wait();

    const shape = surface.getElementById(shapeId)!;
    expect(shape.group).toBe(frame);
    expect(service.layer.compare(shape, frame)).toBeGreaterThan(0);
  });

  test('a frame moved onto a background is raised above it', async () => {
    const surface = service.surface;

    // Drawn on bare canvas, far from the map: it legitimately gets the back of
    // the stack here.
    const frame = service.frame.createFrameOnBound(
      new Bound(3000, 3000, 400, 300)
    );
    await wait();

    const bgId = surface.addElement({
      type: 'wardley',
      xywh: '[0,0,1600,900]',
    });
    await wait();

    const bg = surface.getElementById(bgId)!;
    expect(service.layer.compare(frame, bg)).toBeLessThan(0);

    // ...and dropping it onto the map must raise it, exactly as drawing it
    // there would have.
    service.doc.updateBlock(frame, { xywh: '[700,350,400,300]' });
    await wait();

    expect(service.layer.compare(frame, bg)).toBeGreaterThan(0);
  });

  test('every framework background gets the same treatment', async () => {
    const surface = service.surface;

    // The fix keys on FrameworkBackgroundElementModel, not on Wardley: a C4
    // board and a BPMN pool are the same kind of opaque backdrop.
    const boardId = surface.addElement({
      type: 'c4Board',
      xywh: '[0,0,1600,900]',
    });
    const poolId = surface.addElement({
      type: 'bpmnPool',
      xywh: '[2000,0,1200,600]',
    });
    await wait();

    const onBoard = service.frame.createFrameOnBound(
      new Bound(700, 350, 400, 300)
    );
    const onPool = service.frame.createFrameOnBound(
      new Bound(2200, 100, 400, 300)
    );
    await wait();

    const board = surface.getElementById(boardId)!;
    const pool = surface.getElementById(poolId)!;
    expect(service.layer.compare(onBoard, board)).toBeGreaterThan(0);
    expect(service.layer.compare(onPool, pool)).toBeGreaterThan(0);
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

  /**
   * `canvas.frame.reorder` is the one write of the presentation order (ADR
   * 0034): the frame panel, the order menu and a host's slide panel all reach
   * it from the registry. Run for real, it must reorder the frames and come
   * back in ONE undo step — the panel used to take its `captureSync` after the
   * write, merging the reorder into the gesture before it.
   */
  test('canvas.frame.reorder from the registry moves frames and undoes in one step', async () => {
    // Explicit keys: the model's default `presentationIndex` is random per
    // frame, which would make the starting order arbitrary.
    const [a, b, c] = ['a0', 'a1', 'a2'].map((presentationIndex, i) =>
      service.doc.addBlock(
        'affine:frame',
        {
          xywh: `[${i * 400},0,300,300]`,
          title: new Text(`Frame ${i + 1}`),
          presentationIndex,
        },
        service.surface.id
      )
    );
    await wait();

    const order = () =>
      service.doc
        .getBlocksByFlavour('affine:frame')
        .map(block => block.model as FrameBlockModel)
        .sort((x, y) =>
          x.props.presentationIndex! < y.props.presentationIndex! ? -1 : 1
        )
        .map(frame => frame.id);
    expect(order()).toEqual([a, b, c]);

    const command = getRegisteredCommands(service.std).find(
      c => c.id === 'canvas.frame.reorder'
    );
    expect(command).toBeDefined();
    runCommand(
      service.std,
      command!,
      { surface: 'agent', source: 'ai' },
      { ids: [c, b], before: a }
    );
    await wait();
    // Two frames written, kept in their own relative order.
    expect(order()).toEqual([b, c, a]);

    service.doc.undo();
    await wait();
    expect(order()).toEqual([a, b, c]);
    // The undo took the reorder only, not the frames' creation.
    expect(service.doc.getBlocksByFlavour('affine:frame')).toHaveLength(3);
  });
});
