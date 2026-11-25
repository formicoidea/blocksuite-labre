/**
 * What a linked-doc card reads of the document it points at, and which
 * store it reads it from (#746, ADR 0057, amendment of 2026-11-25).
 *
 * The card read everything through `doc.getStore({ id })`, the default
 * store's key: after a host closed the document, any re-render of the card
 * or any document-list change in the workspace built that store again, and
 * nobody released it. Title, trash and existence now come from the document
 * and its meta; content from the default store while it is open, from a
 * counted store of the card's own when nobody has the document open, and
 * from nothing once the host closed it under the card.
 */
import {
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { type Doc, type Store, Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import {
  type BlockUpdate,
  LinkedDocSource,
} from '../common/linked-doc-source.js';

const endOfTask = () => new Promise<void>(resolve => queueMicrotask(resolve));

function openWorkspace() {
  const workspace = new TestWorkspace({
    id: 'linked-doc-source',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  const doc = workspace.createDoc('b');
  workspace.meta.setDocMeta('b', { title: 'B' });
  return { workspace, doc };
}

/**
 * B with a page and a note written by a peer, no store open on it here, and
 * `peerAdds(id)`: the peer adds a paragraph, which arrives remote.
 */
function withPeerContent() {
  const open = (id: string) => {
    const workspace = new TestWorkspace({
      id,
      idGenerator: createAutoIncrementIdGenerator(),
    });
    workspace.storeExtensions = [
      RootBlockSchemaExtension,
      NoteBlockSchemaExtension,
      ParagraphBlockSchemaExtension,
    ];
    workspace.meta.initialize();
    return workspace;
  };
  const peer = open('linked-doc-source-peer');
  const peerStore = peer.createDoc('b').getStore();
  let noteId = '';
  peerStore.load(() => {
    const page = peerStore.addBlock('affine:page', {});
    noteId = peerStore.addBlock('affine:note', {}, page);
  });
  const local = open('linked-doc-source-local');
  const doc = local.createDoc('b');
  const sync = () =>
    Y.applyUpdate(
      doc.spaceDoc,
      Y.encodeStateAsUpdate(
        peerStore.spaceDoc,
        Y.encodeStateVector(doc.spaceDoc)
      ),
      'remote'
    );
  sync();
  const peerAdds = (id: string) => {
    peerStore.addBlock('affine:paragraph', { id, text: new Text(id) }, noteId);
    sync();
  };
  const dispose = () => {
    local.dispose();
    peer.dispose();
  };
  return { dispose, doc, peerAdds };
}

/** Every store asked of `doc` from now on. */
function storesAskedOf(doc: Doc) {
  const asked: Array<Parameters<Doc['getStore']>[0]> = [];
  const getStore = doc.getStore.bind(doc);
  vi.spyOn(doc, 'getStore').mockImplementation(options => {
    asked.push(options);
    return getStore(options);
  });
  return asked;
}

describe('LinkedDocSource (ADR 0057)', () => {
  test('title and trash come from the document, with no store open and none built', () => {
    const { workspace, doc } = openWorkspace();
    try {
      doc.getStore().dispose();
      const asked = storesAskedOf(doc);
      const source = new LinkedDocSource(doc);

      expect(source.title).toBe('B');
      expect(source.trashed).toBe(false);
      workspace.meta.setDocMeta('b', { title: 'B renamed', trash: true });
      expect(source.title).toBe('B renamed');
      expect(source.trashed).toBe(true);
      expect(source.store).toBeNull();

      expect(asked).toEqual([]);
      expect(doc.defaultStore).toBeNull();
    } finally {
      workspace.dispose();
    }
  });

  test('content: the open default store; once its host closes it, none, and nothing built', () => {
    const { workspace, doc } = openWorkspace();
    try {
      const open = doc.getStore();
      const asked = storesAskedOf(doc);
      const source = new LinkedDocSource(doc);
      const followed: Store[] = [];
      const stop = source.follow(
        () => {},
        store => {
          followed.push(store);
        }
      );

      expect(source.contentStore()).toBe(open);
      open.dispose();
      expect(source.contentStore()).toBeNull();
      expect(source.store).toBeNull();
      expect(asked).toEqual([]);
      expect(doc.defaultStore).toBeNull();

      const reopened = doc.getStore();
      expect(followed).toEqual([open, reopened]);
      expect(source.contentStore()).toBe(reopened);

      stop();
      reopened.dispose();
    } finally {
      workspace.dispose();
    }
  });

  test('a document nobody has open: a readonly store of the card’s own, released with it', async () => {
    const { workspace, doc } = openWorkspace();
    try {
      const source = new LinkedDocSource(doc);
      const stop = source.follow(() => {});

      const own = source.contentStore()!;
      expect(own.readonly).toBe(true);
      expect(doc.defaultStore).toBeNull();
      // Asked again, the same one.
      expect(source.contentStore()).toBe(own);

      // The host opens the document: the card reads it, and lets its own go.
      const open = doc.getStore();
      expect(source.contentStore()).toBe(open);
      await endOfTask();
      expect(own.disposed).toBe(true);

      stop();
      source.release();
      open.dispose();
    } finally {
      workspace.dispose();
    }
  });

  test("nobody has it open: a peer's changes are heard on the card's own store, then once on the default one, then not at all", async () => {
    const { dispose, doc, peerAdds } = withPeerContent();
    try {
      const updates: BlockUpdate[] = [];
      const source = new LinkedDocSource(doc);
      const stop = source.follow(update => updates.push(update));
      const own = source.contentStore()!;
      own.load();
      const added = () =>
        updates.filter(u => u.type === 'add' && !u.init).map(u => u.id);

      peerAdds('p1');
      expect(added()).toEqual(['p1']);

      // The host opens the document: heard on its store alone.
      const open = doc.getStore();
      open.load();
      peerAdds('p2');
      expect(added()).toEqual(['p1', 'p2']);
      await endOfTask();
      expect(own.disposed).toBe(true);

      // The host closes it: nothing heard, nothing built.
      open.dispose();
      peerAdds('p3');
      expect(added()).toEqual(['p1', 'p2']);
      expect(source.contentStore()).toBeNull();
      expect(doc.defaultStore).toBeNull();

      stop();
      source.release();
    } finally {
      dispose();
    }
  });

  test('released with the card, the own store is disposed', async () => {
    const { workspace, doc } = openWorkspace();
    try {
      const source = new LinkedDocSource(doc);
      const own = source.contentStore()!;

      source.release();
      await endOfTask();

      expect(own.disposed).toBe(true);
      expect(source.store).toBeNull();
      expect(doc.defaultStore).toBeNull();
    } finally {
      workspace.dispose();
    }
  });
});
