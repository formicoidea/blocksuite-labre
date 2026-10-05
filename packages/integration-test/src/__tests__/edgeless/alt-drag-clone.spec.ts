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
import { userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { pointerDown, pointerMoveTo, pointerUp } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

const CANVAS = 'affine-edgeless-root';

describe('alt+drag clone is one undo step', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    return cleanup;
  });

  const gfx = () => edgeless.service.gfx;
  const shapes = () =>
    edgeless.service.surface.getElementsByType('shape') as ShapeElementModel[];

  const settle = async () => {
    await edgeless.updateComplete;
    await wait(50);
  };

  /** A shape centred in the viewport, its creation closed in the history. */
  const shapeInView = async () => {
    const id = edgeless.service.crud.addElement('shape', {
      shapeType: ShapeType.Rect,
      xywh: '[0,0,100,100]',
    })!;
    gfx().viewport.setCenter(50, 50);
    window.doc.captureSync();
    await settle();
    return shapes().find(shape => shape.id === id)!;
  };

  /** Press on the centre of the canvas, drag to the right, release. */
  const drag = async (alt: boolean) => {
    await pointerMoveTo(CANVAS, 0.5, 0.5, 1);
    if (alt) await userEvent.keyboard('{Alt>}');
    try {
      await pointerDown();
      await pointerMoveTo(CANVAS, 0.65, 0.5, 8);
      await pointerUp();
    } finally {
      if (alt) await userEvent.keyboard('{/Alt}');
    }
    await settle();
  };

  test('one undo removes the copy and leaves the source untouched', async () => {
    const source = await shapeInView();
    const sourceXYWH = source.xywh;

    await drag(true);
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
    const source = await shapeInView();
    const sourceXYWH = source.xywh;

    await drag(false);
    expect(source.xywh, 'the drag moved the shape').not.toBe(sourceXYWH);

    window.doc.undo();
    await settle();

    expect(shapes().map(shape => shape.xywh)).toEqual([sourceXYWH]);
  });
});
