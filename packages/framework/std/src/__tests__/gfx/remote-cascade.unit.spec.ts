import { serializeXYWH } from '@labre/global/gfx';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';

import { effects } from '../../effects.js';
import type { GfxGroupLikeElementModel } from '../../gfx/index.js';
import type { TestGroupElement } from '../test-gfx-element.js';
import {
  RootBlockSchemaExtension,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
  TestGfxBlockSchemaExtension,
} from '../test-schema.js';

effects();

const extensions = [
  RootBlockSchemaExtension,
  SurfaceBlockSchemaExtension,
  TestGfxBlockSchemaExtension,
];

/**
 * Two peers on one document, wired by hand the way a sync provider does it:
 * `author` writes, `viewer` only ever RECEIVES. The author's updates are
 * queued one per transaction and replayed in order, so each lands on the
 * viewer as its own non-local transaction (`transaction.local === false`),
 * exactly like a collaboration message or a share-link stream. Replaying them
 * MERGED would hide the defect: Yjs emits no event for a type whose container
 * was deleted in the same transaction, so "group emptied" and "group deleted"
 * folded into one update never reach the group watcher.
 *
 * `localWrites` counts the transactions the viewer opens ON ITS OWN while
 * receiving. A cascade that reacts to a remote change with a local write
 * (delete the group a remote peer just emptied, drop a remote-deleted block
 * from its group…) shows up here — and, on a readonly viewer, as the
 * production exception `Cannot remove element in readonly mode`.
 */
const twoPeers = () => {
  const options = {
    id: 'test-collection',
    idGenerator: createAutoIncrementIdGenerator(),
  };
  const authorWorkspace = new TestWorkspace(options);
  authorWorkspace.meta.initialize();
  const authorDoc = authorWorkspace.createDoc('home');
  const queue: Uint8Array[] = [];
  authorDoc.spaceDoc.on('update', (update: Uint8Array) => queue.push(update));
  const author = authorDoc.getStore({ extensions });
  authorDoc.load();

  const rootId = author.addBlock('test:page');
  const surfaceId = author.addBlock('test:surface', {}, rootId);

  const viewerWorkspace = new TestWorkspace(options);
  // The root update creates the subdoc on the viewer; the space then follows
  // transaction by transaction.
  applyUpdate(viewerWorkspace.doc, encodeStateAsUpdate(authorWorkspace.doc));
  const viewerDoc = viewerWorkspace.getDoc('home')!;
  const sync = () => {
    for (const update of queue.splice(0)) {
      // Named origin, as every sync provider passes one: the store reads an
      // ORIGIN-LESS transaction as local (`Store._handleYEvent`).
      applyUpdate(viewerDoc.spaceDoc, update, 'remote-peer');
    }
  };
  sync();
  const viewer = viewerDoc.getStore({ extensions });
  viewerDoc.load();

  const viewerSurface = viewer.getBlock(surfaceId)!.model as SurfaceBlockModel;

  // Two counters, because a readonly viewer THROWS before it transacts: the
  // attempt shows on the spy, a completed write on the transaction count.
  let localWrites = 0;
  viewerDoc.spaceDoc.on('afterTransaction', transaction => {
    if (transaction.local) localWrites++;
  });
  const deleteElement = vi.spyOn(viewerSurface, 'deleteElement');

  return {
    surfaceId,
    authorDoc,
    author,
    authorSurface: author.getBlock(surfaceId)!.model as SurfaceBlockModel,
    viewer,
    viewerSurface,
    sync,
    localWrites: () => localWrites + deleteElement.mock.calls.length,
  };
};

describe('a remote change never triggers a local cascade', () => {
  test.each([{ readonly: true }, { readonly: false }])(
    'a group emptied by a remote peer is not deleted a second time locally (viewer readonly: $readonly)',
    ({ readonly }) => {
      const { authorSurface, viewer, viewerSurface, sync, localWrites } =
        twoPeers();

      const childId = authorSurface.addElement({
        type: 'testShape',
        xywh: serializeXYWH(0, 0, 100, 100),
      });
      const groupId = authorSurface.addElement({
        type: 'testGroup',
        children: { [childId]: true },
      });
      sync();
      expect(viewerSurface.getElementById(groupId)).not.toBeNull();

      viewer.readonly = readonly;

      // The author's own watcher removes the emptied group: the deletion is
      // part of what the viewer receives.
      authorSurface.deleteElement(childId);
      expect(authorSurface.getElementById(groupId)).toBeNull();

      expect(sync).not.toThrow();
      expect(viewerSurface.getElementById(groupId)).toBeNull();
      expect(localWrites()).toBe(0);
    }
  );

  test.each([{ readonly: true }, { readonly: false }])(
    'a block deleted by a remote peer is not dropped from its group a second time locally (viewer readonly: $readonly)',
    ({ readonly }) => {
      const {
        surfaceId,
        author,
        authorSurface,
        viewer,
        viewerSurface,
        sync,
        localWrites,
      } = twoPeers();

      const blockId = author.addBlock(
        'test:gfx-block',
        { xywh: serializeXYWH(0, 0, 100, 100) },
        surfaceId
      );
      const groupId = authorSurface.addElement({
        type: 'testGroup',
        children: { [blockId]: true },
      });
      sync();
      expect(
        (viewerSurface.getElementById(groupId) as GfxGroupLikeElementModel)
          .childIds
      ).toEqual([blockId]);

      viewer.readonly = readonly;

      author.deleteBlock(author.getBlock(blockId)!.model);
      expect(authorSurface.getElementById(groupId)).toBeNull();

      expect(sync).not.toThrow();
      expect(viewer.getBlock(blockId)).toBeUndefined();
      expect(viewerSurface.getElementById(groupId)).toBeNull();
      expect(localWrites()).toBe(0);
    }
  );
});

describe('a readonly peer never runs the group cascade', () => {
  test('a group emptied by a LOCAL write is kept while the store is readonly, and collected again once it is writeable', () => {
    const { author, authorSurface } = twoPeers();
    const deleteElement = vi.spyOn(authorSurface, 'deleteElement');

    // One group holding one child, emptied by dropping the child straight
    // from the group's `Y.Map` so the transaction is LOCAL — the shape of the
    // update the production stack reported, where the host had flipped the
    // store to readonly under a still-running local edit.
    const emptiableGroup = () => {
      const childId = authorSurface.addElement({
        type: 'testShape',
        xywh: serializeXYWH(0, 0, 100, 100),
      });
      const groupId = authorSurface.addElement({
        type: 'testGroup',
        children: { [childId]: true },
      });
      return {
        groupId,
        empty: () => {
          const group = authorSurface.getElementById(
            groupId
          ) as TestGroupElement;
          author.transact(() => group.children.delete(childId));
        },
      };
    };

    const kept = emptiableGroup();
    author.readonly = true;
    expect(kept.empty).not.toThrow();
    expect(authorSurface.hasElementById(kept.groupId)).toBe(true);
    expect(deleteElement).not.toHaveBeenCalled();

    // The normal path is untouched: a writeable peer still collects the group
    // it just emptied.
    author.readonly = false;
    const cascaded = emptiableGroup();
    cascaded.empty();
    expect(authorSurface.hasElementById(cascaded.groupId)).toBe(false);
    expect(deleteElement).toHaveBeenCalledWith(cascaded.groupId);
  });

  test('a readonly store sharing the Y.Doc of a writeable one cascades nothing while the author edits', () => {
    const { authorDoc, author, authorSurface, surfaceId } = twoPeers();

    // The shape the production stack reported: two stores on ONE `Y.Doc`, one
    // writeable and one readonly, so every transaction the author opens also
    // reaches the readonly surface model as a LOCAL one — `readonly` is the
    // only thing that tells the two apart.
    const mirror = authorDoc.getStore({ readonly: true, extensions });
    const mirrorSurface = mirror.getBlock(surfaceId)!
      .model as SurfaceBlockModel;
    // Both write paths of the cascade, spied on the MIRROR's own models: the
    // author's transactions are indistinguishable from the mirror's on a
    // shared `Y.Doc`, so the attempt is what we can attribute.
    const deleteElement = vi.spyOn(mirrorSurface, 'deleteElement');

    // The author empties a group: its own watcher collects it, the mirror's
    // must not try to collect it a second time.
    const childId = authorSurface.addElement({
      type: 'testShape',
      xywh: serializeXYWH(0, 0, 100, 100),
    });
    const emptiedId = authorSurface.addElement({
      type: 'testGroup',
      children: { [childId]: true },
    });
    expect(() => authorSurface.deleteElement(childId)).not.toThrow();
    expect(authorSurface.hasElementById(emptiedId)).toBe(false);
    expect(deleteElement).not.toHaveBeenCalled();

    // The author deletes a grouped BLOCK. The group keeps a second child, so
    // it survives the author's own `removeChild` and is still there when the
    // mirror's subscriber runs — the mirror must leave it alone.
    const blockId = author.addBlock(
      'test:gfx-block',
      { xywh: serializeXYWH(0, 0, 100, 100) },
      surfaceId
    );
    const siblingId = authorSurface.addElement({
      type: 'testShape',
      xywh: serializeXYWH(0, 0, 100, 100),
    });
    const groupId = authorSurface.addElement({
      type: 'testGroup',
      children: { [blockId]: true, [siblingId]: true },
    });
    const mirrorGroup = mirrorSurface.getElementById(
      groupId
    ) as TestGroupElement;
    const removeChild = vi.spyOn(mirrorGroup, 'removeChild');

    expect(() =>
      author.deleteBlock(author.getBlock(blockId)!.model)
    ).not.toThrow();

    expect(removeChild).not.toHaveBeenCalled();
    expect(deleteElement).not.toHaveBeenCalled();
    expect(
      (authorSurface.getElementById(groupId) as GfxGroupLikeElementModel)
        .childIds
    ).toEqual([siblingId]);
  });
});
