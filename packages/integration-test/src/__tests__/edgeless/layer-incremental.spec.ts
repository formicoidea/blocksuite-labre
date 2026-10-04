/**
 * The layer manager places a new element by bisection since a paste of N
 * elements inside a frame cost N² comparisons (`_insertIntoLayer` compared the
 * newcomer with every element of the layer it landed in, and the frame
 * re-inserted each of its children).
 *
 * The oracle is the manager itself: `_reset` builds the layers from scratch by
 * sorting everything. Whatever was inserted one element at a time — at the
 * top, in the middle of a canvas layer, between two notes (which splits a
 * block layer in two) — must give exactly the layers a rebuild gives.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { ShapeType } from '@labre/affine/model';
import { generateKeyBetween, type GfxModel } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/** A deterministic pseudo-random sequence, so a failure replays. */
function random(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

describe('incremental layer insertion', () => {
  let service!: EdgelessRootBlockComponent['service'];

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    service = getDocRootBlock(window.doc, window.editor, 'edgeless').service;
    return cleanup;
  });

  const layout = () =>
    service.gfx.layer.layers.map(
      layer =>
        `${layer.type}:${(layer.elements as GfxModel[]).map(e => e.id).join(',')}`
    );

  const addShape = (index?: string) =>
    service.crud.addElement('shape', {
      shapeType: ShapeType.Rect,
      xywh: '[0,0,50,50]',
      ...(index ? { index } : {}),
    })!;

  test('builds the layers a rebuild would', async () => {
    const next = random(7);

    // canvas, then four notes in a row (one block layer), then canvas again
    for (let i = 0; i < 10; i++) addShape();
    for (let i = 0; i < 4; i++) {
      addNote(window.doc, { index: service.gfx.layer.generateIndex() });
    }
    for (let i = 0; i < 10; i++) addShape();
    await wait();
    expect(service.gfx.layer.layers.map(layer => layer.type)).toEqual([
      'canvas',
      'block',
      'canvas',
    ]);

    // Then shapes slipped between two neighbours anywhere in the stack: in
    // the middle of a canvas layer, or between two notes.
    for (let i = 0; i < 40; i++) {
      const stack = [
        ...service.gfx.layer.canvasElements,
        ...service.gfx.layer.blocks,
      ].sort((a, b) => service.gfx.layer.compare(a, b));
      const at = Math.floor(next() * (stack.length - 1));
      addShape(generateKeyBetween(stack[at].index, stack[at + 1].index));
    }
    await wait();

    const incremental = layout();
    expect(incremental.length).toBeGreaterThan(3);

    (service.gfx.layer as unknown as { _reset(): void })._reset();
    expect(layout()).toEqual(incremental);
  });
});
