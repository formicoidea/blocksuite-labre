/**
 * A surface-ref note portal disposes of its preview store (#746, ADR 0057,
 * part 3).
 *
 * The portal renders its note from a readonly query store of the document.
 * On disconnect it removed that store from the document's container and
 * never disposed of it: the store, with every Yjs observer it attached,
 * stayed for the workspace's life. The portals of a document share that
 * store (their query is the same, see the note below), so each portal now
 * holds it and the last one to go disposes of it.
 *
 * Not fixed here, reported (ADR 0057, Context 5): the portal fills
 * `this.ancestors` but builds its query from a local set that stays empty,
 * so the query matches no block by id and every portal asks for the same
 * store.
 */
import {
  NoteBlockModel,
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { type Store } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { nothing } from 'lit';
import { afterEach, describe, expect, test } from 'vitest';

import { SurfaceRefNotePortal } from '../portal/note.js';

/** The real lifecycle, without the preview's mini editor. */
class LifecycleOnlyPortal extends SurfaceRefNotePortal {
  override render(): typeof nothing {
    return nothing;
  }

  override updated() {}
}
const TAG = 'test-surface-ref-note-portal';
if (!customElements.get(TAG)) customElements.define(TAG, LifecycleOnlyPortal);

const endOfTask = () => new Promise<void>(resolve => queueMicrotask(resolve));

const isDisposed = (store: Store) => {
  try {
    store.transact(() => {});
    return false;
  } catch {
    return true;
  }
};

function openNote() {
  const workspace = new TestWorkspace({
    id: 'note-portal-release',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
  ];
  workspace.meta.initialize();
  const store = workspace.createDoc('doc').getStore();
  let noteId = '';
  store.load(() => {
    const page = store.addBlock('affine:page', {});
    noteId = store.addBlock('affine:note', {}, page);
  });
  const note = store.getModelById(noteId);
  if (!(note instanceof NoteBlockModel)) throw new Error('no note');
  return { workspace, store, note };
}

function connectPortal(note: NoteBlockModel) {
  const portal = new LifecycleOnlyPortal();
  portal.model = note;
  document.body.append(portal);
  return portal;
}

const previewStoreOf = (portal: SurfaceRefNotePortal, store: Store) =>
  store.doc.getStore({ query: portal.query!, readonly: true });

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the surface-ref note preview store (ADR 0057 part 3)', () => {
  test('the last portal to go disposes of the shared store', async () => {
    const { workspace, store, note } = openNote();
    try {
      const first = connectPortal(note);
      const second = connectPortal(note);
      const shared = previewStoreOf(first, store);
      expect(shared).not.toBe(store);
      expect(previewStoreOf(second, store)).toBe(shared);

      first.remove();
      await endOfTask();
      expect(isDisposed(shared)).toBe(false);

      second.remove();
      await endOfTask();
      expect(isDisposed(shared)).toBe(true);
      expect(isDisposed(store)).toBe(false);
    } finally {
      workspace.dispose();
    }
  });
});
