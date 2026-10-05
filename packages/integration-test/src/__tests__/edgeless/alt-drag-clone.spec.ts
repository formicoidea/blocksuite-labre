/**
 * Alt+drag clones the selection and drags the copy: ONE gesture, so ONE undo
 * step takes it all back.
 *
 * `DefaultTool.dragStart` used to create the copy first, then enter the move
 * branch, whose `captureSync()` closed the undo step right after the clone.
 * The gesture was two steps: the first Ctrl+Z only moved the copy back onto
 * its source — on screen nothing seemed to happen, the copy looked as if it
 * had survived — and the second removed it. A plain drag keeps its own step,
 * exactly as before; it is pinned here so a fix for the clone cannot fold the
 * move into whatever came before it.
 *
 * Real mouse and keyboard (Playwright), no synthetic events: the bug lives in
 * the order the default tool runs things in.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { type ShapeElementModel, ShapeType } from '@labre/affine/model';
import { beforeEach, describe, expect, test } from 'vitest';

import { dragModel } from '../utils/canvas-gesture.js';
import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('alt+drag clone is one undo step', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    return cleanup;
  });

  const shapes = () =>
    edgeless.service.surface.getElementsByType('shape') as ShapeElementModel[];

  const settle = async () => {
    await edgeless.updateComplete;
    await wait(50);
  };

  /** A shape, its creation closed in the history. */
  const newShape = async () => {
    const id = edgeless.service.crud.addElement('shape', {
      shapeType: ShapeType.Rect,
      xywh: '[0,0,100,100]',
    })!;
    window.doc.captureSync();
    await settle();
    return shapes().find(shape => shape.id === id)!;
  };

  /**
   * Press on the shape, drag it to the right, release — real mouse and keys,
   * through `dragModel`, which sets its own camera: the suite shares one
   * page, and a press on "the middle of the canvas" missed the shape once
   * other specs had run (CI, PR #455).
   */
  const drag = (shape: ShapeElementModel, alt: boolean) =>
    dragModel(edgeless, shape, { alt });

  test('one undo removes the copy and leaves the source untouched', async () => {
    const source = await newShape();
    const sourceXYWH = source.xywh;

    await drag(source, true);
    const copies = shapes().filter(shape => shape.id !== source.id);
    expect(copies, 'the drag made one copy').toHaveLength(1);
    expect(copies[0].xywh, 'the copy was dragged away').not.toBe(sourceXYWH);
    expect(source.xywh, 'the source stays put').toBe(sourceXYWH);

    window.doc.undo();
    await settle();

    expect(
      shapes().map(shape => [shape.id === source.id, shape.xywh]),
      'one undo: only the source is left, where it was'
    ).toEqual([[true, sourceXYWH]]);
  });

  test('a plain drag is still its own undo step', async () => {
    const source = await newShape();
    const sourceXYWH = source.xywh;

    await drag(source, false);
    expect(source.xywh, 'the drag moved the shape').not.toBe(sourceXYWH);

    window.doc.undo();
    await settle();

    expect(shapes().map(shape => shape.xywh)).toEqual([sourceXYWH]);
  });
});
