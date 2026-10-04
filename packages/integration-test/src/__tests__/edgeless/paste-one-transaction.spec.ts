/**
 * One paste, one Yjs update, one undo step.
 *
 * Duplicating N canvas elements wrote each element in its own transaction and
 * then re-indexed each one in another, so a peer received about 2N updates (2N
 * realtime broadcasts) for one gesture, and the undo stack depended on timing:
 * the paste merged into the gesture before it whenever that one ended less than
 * the undo manager's capture window earlier. The paste now writes its canvas
 * elements and their final indexes in one transaction, after a `captureSync`.
 *
 * Asserted on the observable effect: the `update` events of the document's
 * Y.Doc, a second Y.Doc that receives only those updates (what a remote peer
 * gets), and one real Ctrl+Z.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { createGroupFromSelectedCommand } from '@labre/affine/gfx/group';
import { type FrameBlockModel, ShapeType } from '@labre/affine/model';
import type { BlockStdScope } from '@labre/std';
import type { GfxModel } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const pressMod = (key: string) =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
  );

const N = 50;

describe('a paste is one transaction', () => {
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

  const addShapes = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      service.crud.addElement('shape', {
        shapeType: ShapeType.Rect,
        xywh: `[${(i % 10) * 120},${Math.floor(i / 10) * 120},100,100]`,
      })
    ) as string[];

  /** Surface element ids as a Y.Doc holds them, read without any model. */
  const surfaceElementIds = (doc: Y.Doc) => {
    const surface = doc
      .getMap('blocks')
      .get(service.surface.id) as Y.Map<unknown>;
    const elements = surface.get('prop:elements') as Y.Map<unknown>;
    return [...(elements.get('value') as Y.Map<unknown>).keys()].sort();
  };

  /**
   * Duplicate `ids` with Mod+D and return the updates the document emitted,
   * plus a peer that received exactly those on top of the state before.
   */
  async function duplicateAndCapture(ids: string[]) {
    const spaceDoc = std.store.spaceDoc;
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(spaceDoc));

    const updates: Uint8Array[] = [];
    const onUpdate = (update: Uint8Array) => updates.push(update);
    spaceDoc.on('update', onUpdate);

    service.gfx.selection.set({ elements: ids, editing: false });
    pressMod('d');
    await wait(200);
    spaceDoc.off('update', onUpdate);

    updates.forEach(update => Y.applyUpdate(peer, update));
    return { updates, peer, spaceDoc };
  }

  test(`duplicating ${N} shapes emits one update, and a peer gets them all`, async () => {
    const ids = addShapes(N);
    await wait();

    const { updates, peer, spaceDoc } = await duplicateAndCapture(ids);

    expect(shapes().length).toBe(2 * N);
    expect(updates.length).toBe(1);
    expect(surfaceElementIds(peer)).toEqual(surfaceElementIds(spaceDoc));
    expect(surfaceElementIds(peer).length).toBe(2 * N);
  });

  test(`inside a frame, the ${N} adoptions travel in one more update`, async () => {
    // The frame adopts what lands inside it a microtask after the paste (a
    // connector's bound is only known then), so the adoption cannot share the
    // paste's transaction — but the N adoptions share one of their own.
    const frameId = service.crud.addBlock(
      'affine:frame',
      { xywh: '[-50,-50,4000,2000]' },
      service.surface.id
    )!;
    await wait();
    const ids = addShapes(N);
    await wait();

    const { updates, peer, spaceDoc } = await duplicateAndCapture(ids);

    expect(shapes().length).toBe(2 * N);
    expect(updates.length).toBe(2);
    expect(surfaceElementIds(peer)).toEqual(surfaceElementIds(spaceDoc));

    const frame = window.doc.getBlock(frameId)!.model as FrameBlockModel;
    expect(shapes().every(shape => frame.hasChild(shape))).toBe(true);
    const peerFrame = (
      peer.getMap('blocks').get(frameId) as Y.Map<unknown>
    ).get('prop:childElementIds') as Y.Map<unknown>;
    expect(peerFrame.size).toBe(2 * N);
  });

  test('one Ctrl+Z removes the whole duplicate, and only it', async () => {
    const ids = addShapes(4);
    const textId = service.crud.addBlock(
      'affine:edgeless-text',
      { xywh: '[0,500,100,50]' },
      service.surface.id
    )!;
    await wait();
    service.gfx.selection.set({ elements: [ids[0], textId], editing: false });
    std.command.exec(createGroupFromSelectedCommand);
    await wait();

    const before = surfaceElementIds(std.store.spaceDoc);
    const textsBefore = window.doc.getModelsByFlavour('affine:edgeless-text');
    expect(textsBefore.length).toBe(1);

    // No pause: the duplicate follows the grouping within the undo manager's
    // capture window, so only an explicit capture keeps the two apart.
    service.gfx.selection.set({
      elements: [
        ...service.gfx.selection.selectedElements.map(e => e.id),
        ...ids.slice(1),
      ],
      editing: false,
    });
    pressMod('d');
    await wait(200);
    expect(surfaceElementIds(std.store.spaceDoc).length).toBe(
      2 * before.length
    );
    expect(window.doc.getModelsByFlavour('affine:edgeless-text').length).toBe(
      2
    );

    pressMod('z');
    await wait(100);

    expect(surfaceElementIds(std.store.spaceDoc)).toEqual(before);
    expect(window.doc.getModelsByFlavour('affine:edgeless-text').length).toBe(
      1
    );
  });

  /**
   * Guard for the index pass, which now runs inside the paste's transaction
   * and reads the parentage from the pasted data (a group created in that
   * transaction registers its children only when it ends): the copies stack
   * exactly as their sources do, group and loose elements interleaved.
   */
  test('the copies keep the stacking order of their sources', async () => {
    const ids = addShapes(6);
    const textId = service.crud.addBlock(
      'affine:edgeless-text',
      { xywh: '[0,500,100,50]' },
      service.surface.id
    )!;
    await wait();
    // A group in the middle of the stack, holding a shape and the text.
    service.gfx.selection.set({ elements: [ids[2], textId], editing: false });
    std.command.exec(createGroupFromSelectedCommand);
    await wait();

    const sources = [
      ...service.gfx.layer.canvasElements,
      ...service.gfx.layer.blocks,
    ];
    const signature = (elements: GfxModel[]) => {
      const left = Math.min(...elements.map(e => e.elementBound.x));
      return [...elements]
        .sort((a, b) => service.gfx.layer.compare(a, b))
        .map(e => {
          const { x, y, w, h } = e.elementBound;
          const kind = 'flavour' in e ? e.flavour : e.type;
          const at = [x - left, y, w, h].map(Math.round).join(',');
          return `${kind}@${at}`;
        });
    };
    const expected = signature(sources);

    service.gfx.selection.set({
      elements: sources.filter(e => e.group === null).map(e => e.id),
      editing: false,
    });
    pressMod('d');
    await wait(200);

    const copies = [
      ...service.gfx.layer.canvasElements,
      ...service.gfx.layer.blocks,
    ].filter(e => !sources.includes(e));
    expect(copies.length).toBe(sources.length);
    expect(signature(copies)).toEqual(expected);
  });
});
