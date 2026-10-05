/**
 * Duplicating a group that sits inside a frame copied one of its children
 * twice (production, lib 0.43.1: a circle + free text group, duplicated, came
 * back with an extra orphan on top).
 *
 * The duplicate path creates the group's children BEFORE the group (post-order,
 * `sortEdgelessElements`), and the frame manager adopts every element created
 * inside a frame: a canvas element in a microtask, a block synchronously on
 * `blockUpdated`. So when the copy landed inside the frame, the frame adopted
 * the text block before the group that was about to claim it existed, and both
 * containers ended up listing it. The NEXT duplicate then walked that child
 * twice (once as a top element, since its `.group` reads the unselected frame,
 * and once through the group) and created it twice.
 *
 * The scene is the real one: a frame, a shape and an `affine:edgeless-text`
 * BLOCK (the free "Text" tool) grouped with the real group command, duplicated
 * with the real Mod+D. What is asserted is the observable invariant: each
 * source is copied exactly once, and no element is claimed by two containers.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { createGroupFromSelectedCommand } from '@labre/affine/gfx/group';
import {
  type FrameBlockModel,
  type GroupElementModel,
  ShapeType,
} from '@labre/affine/model';
import type { BlockStdScope } from '@labre/std';
import type { GfxModel } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const pressModD = () =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'd',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
  );

describe('duplicating a group inside a frame', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let std!: BlockStdScope;

  beforeEach(async () => {
    sessionStorage.removeItem('blocksuite:prop:record');
    const cleanup = await setupEditor('edgeless');
    const edgelessRoot = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = edgelessRoot.service;
    std = edgelessRoot.std;
    std.event.active = true;
    return cleanup;
  });

  const shapes = () => service.surface.getElementsByType('shape');
  const groups = () =>
    service.surface.getElementsByType('group') as GroupElementModel[];
  const texts = () =>
    window.doc.getModelsByFlavour('affine:edgeless-text') as GfxModel[];
  const frames = () =>
    window.doc.getModelsByFlavour('affine:frame') as FrameBlockModel[];

  /** How many containers (frames and groups) list `element` as a child. */
  const claimCount = (element: GfxModel) =>
    frames().filter(frame => frame.hasChild(element)).length +
    groups().filter(group => group.hasChild(element)).length;

  /** `kind:id` of every shape or text claimed by more than one container. */
  const doubleClaimed = () => [
    ...shapes()
      .filter(shape => claimCount(shape) > 1)
      .map(shape => `shape:${shape.id}`),
    ...texts()
      .filter(text => claimCount(text) > 1)
      .map(text => `text:${text.id}`),
  ];

  const expectEveryChildGrouped = () => {
    for (const element of [...shapes(), ...texts()]) {
      expect(groups().some(group => group.hasChild(element))).toBe(true);
    }
  };

  /** A frame, and inside it a shape and an edgeless-text grouped by the real command. */
  async function groupInFrame() {
    const surfaceId = service.surface.id;
    const frameId = service.crud.addBlock(
      'affine:frame',
      { xywh: '[0,0,4000,1000]' },
      surfaceId
    )!;
    await wait();

    const shapeId = service.crud.addElement('shape', {
      shapeType: ShapeType.Ellipse,
      xywh: '[100,100,100,100]',
    })!;
    const textId = service.crud.addBlock(
      'affine:edgeless-text',
      { xywh: '[250,100,100,50]' },
      surfaceId
    )!;
    await wait();

    // The real group command moves the children out of the frame and puts the
    // group in their place: the clean starting state.
    service.gfx.selection.set({ elements: [shapeId, textId], editing: false });
    std.command.exec(createGroupFromSelectedCommand);
    await wait();
    expect(groups().length).toBe(1);
    expect(doubleClaimed()).toEqual([]);

    return {
      frame: window.doc.getBlock(frameId)!.model as FrameBlockModel,
      group: groups()[0],
      text: window.doc.getBlock(textId)!.model as GfxModel,
    };
  }

  test('a duplicate pasted inside the frame is claimed by its group only', async () => {
    const { group } = await groupInFrame();

    service.gfx.selection.set({ elements: [group.id], editing: false });
    pressModD();
    await wait(200);

    expect(shapes().length).toBe(2);
    expect(texts().length).toBe(2);
    expect(groups().length).toBe(2);
    expect(doubleClaimed()).toEqual([]);

    // Second duplicate, of the selection the first one left (the new group and
    // its children): every source copied exactly once, nothing orphaned.
    pressModD();
    await wait(200);

    expect(shapes().length).toBe(3);
    expect(texts().length).toBe(3);
    expect(groups().length).toBe(3);
    expect(doubleClaimed()).toEqual([]);
    expectEveryChildGrouped();
  });

  test('a stored child claimed by the frame AND the group is copied once', async () => {
    // What the faulty paste left in documents: the frame lists the text too.
    // The clone path must copy it once, and must not rewrite the source.
    const { frame, group, text } = await groupInFrame();
    frame.addChild(text);
    expect(doubleClaimed()).toEqual([`text:${text.id}`]);

    service.gfx.selection.set({ elements: [group.id], editing: false });
    pressModD();
    await wait(200);

    expect(shapes().length).toBe(2);
    expect(texts().length).toBe(2);
    expect(groups().length).toBe(2);
    expectEveryChildGrouped();
    // The source stays as stored; only the copy is clean.
    expect(doubleClaimed()).toEqual([`text:${text.id}`]);
  });
});
