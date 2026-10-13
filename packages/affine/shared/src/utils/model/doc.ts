import {
  DEFAULT_PAGE_BLOCK_HEIGHT,
  DEFAULT_PAGE_BLOCK_WIDTH,
} from '@labre/affine-model';
import type { Store, Workspace } from '@labre/store';
import { Text } from '@labre/store';

export function createDefaultDoc(
  collection: Workspace,
  options: { id?: string; title?: string } = {}
) {
  const doc = collection.createDoc(options.id);
  doc.load();

  const store = doc.getStore();
  const title = options.title ?? '';
  writeDefaultDocBlocks(store, title);
  collection.meta.setDocMeta(doc.id, {
    title,
  });

  // To make sure the content of new doc would not be clear
  // By undo operation for the first time
  store.resetHistory();

  return store;
}

/**
 * The blocks of a blank page, written into an empty store: the page with its
 * title, its surface, and one note holding an empty paragraph. Shared by
 * `createDefaultDoc` and by the creation paths that receive their store from
 * the host (`LinkedDocCreationProvider`), so a page opens the same whoever
 * made it.
 */
export function writeDefaultDocBlocks(store: Store, title = ''): void {
  const rootId = store.addBlock('affine:page', {
    title: new Text(title),
  });
  store.addBlock('affine:surface', {}, rootId);
  const noteId = store.addBlock(
    'affine:note',
    {
      xywh: `[0, 0, ${DEFAULT_PAGE_BLOCK_WIDTH}, ${DEFAULT_PAGE_BLOCK_HEIGHT}]`,
    },
    rootId
  );
  store.addBlock('affine:paragraph', {}, noteId);
}
