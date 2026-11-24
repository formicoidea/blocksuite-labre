/**
 * Guard for issue #742 (upstream toeverything/AFFiNE#15865, dc2b221):
 * "title/rich-text cells with doc references export and stringify without
 * the linked doc title".
 *
 * A linked-doc reference is stored as one placeholder character
 * (`REFERENCE_NODE`, a space) carrying a `reference` attribute; the editor
 * paints the doc's title (or the reference's alias) in its place. The cell's
 * string (`rawValue.toString`, read by `CellBase.stringValue$`) is what the
 * view search, the table's copy (`text/plain` and `text/html`) and
 * `Property.stringValueGet` use. Before #742 the title's `toString` returned
 * `Text.toString()`, so it held the placeholder and never the title:
 * searching the view for the linked doc's title missed the row. `toJson`
 * resolved the reference, but by the doc's stored meta title, ignoring the
 * alias the reference displays. Both now go through
 * `getTextWithResolvedReferences` (`utils/title-doc.ts`).
 *
 * The title is read from the workspace meta, never through
 * `DocDisplayMetaService.title`, which builds the linked doc's store: a
 * 1 000-row table linking 1 000 docs built 1 000 stores, never released
 * (ADR 0057). The spec pins that no store is asked for, and that a rename is
 * still followed.
 *
 * The host is a stub `EditorHost` read through `EditorHostKey`, as the
 * database block sets it. Its `std.get` throws: the database package reads
 * the host's services with `getOptional` (CLAUDE.md, seams). It has no
 * translation provider, so the wordings read their English fallbacks.
 */
import {
  DatabaseBlockSchemaExtension,
  type DatabaseBlockModel,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { REFERENCE_NODE } from '@labre/affine-shared/consts';
import {
  CHROME_DELETED_DOC,
  CHROME_UNTITLED,
  FeatureFlagService,
} from '@labre/affine-shared/services';
import type { AffineTextAttributes } from '@labre/affine-shared/types';
import type { EditorHost } from '@labre/std';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { EditorHostKey } from '../context/host-context.js';
import { DatabaseBlockDataSource } from '../data-source.js';
import { getTextWithResolvedReferences } from '../utils/title-doc.js';

const LINKED_TITLE = 'Roadmap';
const RENAMED = 'Delivery plan';
const ALIAS = 'Plan B';

const reference = (title?: string, pageId = 'linked') => ({
  insert: REFERENCE_NODE,
  attributes: {
    reference: { type: 'LinkedPage' as const, pageId, title },
  },
});

/** An editor host over `collection`, with no service of its own. */
function stubHost(collection: TestWorkspace): EditorHost {
  const get = () => {
    throw new Error('std.get: the database reads its seams with getOptional');
  };
  return {
    std: { workspace: collection, get, getOptional: () => null },
  } as unknown as EditorHost;
}

/**
 * A database with one row whose title is "<ref> notes" and a rich-text
 * column holding the same text, plus a table view. The linked doc `linked`
 * is titled "Roadmap" and no store of it is ever asked for.
 */
function databaseWithLinkedTitle(alias?: string, withHost = true) {
  const collection = new TestWorkspace({ id: 'linked-doc-cell-text' });
  collection.meta.initialize();
  const linked = collection.createDoc('linked');
  collection.meta.setDocMeta('linked', { title: LINKED_TITLE });
  const doc = collection.createDoc('doc0');
  doc.load();
  const store = doc.getStore({
    extensions: [
      RootBlockSchemaExtension,
      NoteBlockSchemaExtension,
      ParagraphBlockSchemaExtension,
      DatabaseBlockSchemaExtension,
      FeatureFlagService,
    ],
  });
  const rootId = store.addBlock('affine:page', { title: new Text('page') });
  const noteId = store.addBlock('affine:note', {}, rootId);
  const databaseId = store.addBlock(
    'affine:database',
    {
      title: new Text('Plan'),
      columns: [
        { id: 'notes', type: 'rich-text', name: 'Notes', data: {} },
      ] as never,
    },
    noteId
  );
  const deltas = () => [reference(alias), { insert: ' notes' }];
  const rowId = store.addBlock(
    'affine:paragraph',
    { text: new Text<AffineTextAttributes>(deltas()) },
    databaseId
  );
  const model = store.getModelById(databaseId) as DatabaseBlockModel;
  store.updateBlock(model, {
    cells: {
      [rowId]: {
        notes: {
          columnId: 'notes',
          value: new Text<AffineTextAttributes>(deltas()),
        },
      },
    },
  });
  const source = new DatabaseBlockDataSource(model, ds => {
    if (withHost) ds.serviceSet(EditorHostKey, stubHost(collection));
  });
  const viewId = source.viewManager.viewAdd('table');
  const view = source.viewManager.viewGet(viewId)!;
  const titleId = source.properties$.value.find(
    id => source.propertyTypeGet(id) === 'title'
  )!;
  // `setSearch` is on the view class, not on the `SingleView` interface.
  const search = (text: string) => {
    (view as unknown as { setSearch(text: string): void }).setSearch(text);
    return view.rows$.value.map(row => row.rowId);
  };
  return { view, rowId, titleId, collection, linked, search };
}

/** A text attached to a Yjs doc, as a stored cell is. */
function attachedText(deltas: object[]) {
  const text = new Y.Doc().getText('cell');
  text.applyDelta(deltas);
  return text;
}

describe('a cell holding a linked-doc reference (#742)', () => {
  test('stringifies the title cell with the linked doc title', () => {
    const { view, rowId, titleId } = databaseWithLinkedTitle();
    expect(view.cellGetOrCreate(rowId, titleId).stringValue$.value).toBe(
      `${LINKED_TITLE} notes`
    );
  });

  test('is found by the view search under the linked doc title', () => {
    const { rowId, search } = databaseWithLinkedTitle();
    expect(search(LINKED_TITLE.toLowerCase())).toEqual([rowId]);
  });

  test('exports the title and rich-text cells as the reference reads, alias included', () => {
    const { view, rowId, titleId } = databaseWithLinkedTitle(ALIAS);
    expect(view.cellGetOrCreate(rowId, titleId).jsonValue$.value).toBe(
      `${ALIAS} notes`
    );
    expect(view.cellGetOrCreate(rowId, 'notes').jsonValue$.value).toBe(
      `${ALIAS} notes`
    );
  });

  test('exports without an alias as the linked doc title', () => {
    const { view, rowId, titleId } = databaseWithLinkedTitle();
    expect(view.cellGetOrCreate(rowId, titleId).jsonValue$.value).toBe(
      `${LINKED_TITLE} notes`
    );
  });

  test('follows a rename of the linked doc, in the cell and in the search', () => {
    const { view, rowId, titleId, collection, search } =
      databaseWithLinkedTitle();
    const cell = view.cellGetOrCreate(rowId, titleId);
    expect(cell.stringValue$.value).toBe(`${LINKED_TITLE} notes`);
    collection.meta.setDocMeta('linked', { title: RENAMED });
    expect(cell.stringValue$.value).toBe(`${RENAMED} notes`);
    expect(search(LINKED_TITLE.toLowerCase())).toEqual([]);
    expect(search(RENAMED.toLowerCase())).toEqual([rowId]);
  });

  test('asks no store of a linked doc to read its title', () => {
    const { view, rowId, titleId, collection, linked, search } =
      databaseWithLinkedTitle();
    // The instance the workspace hands out, which a store build would use.
    expect(collection.getDoc('linked')).toBe(linked);
    const getStore = vi.spyOn(linked, 'getStore');
    view.cellGetOrCreate(rowId, titleId).stringValue$.value;
    view.cellGetOrCreate(rowId, titleId).jsonValue$.value;
    view.cellGetOrCreate(rowId, 'notes').stringValue$.value;
    search(LINKED_TITLE.toLowerCase());
    expect(getStore).not.toHaveBeenCalled();
  });
});

describe('the fallbacks of a linked-doc reference in a cell (#742)', () => {
  test('names a deleted doc with the editor wording', () => {
    const { collection } = databaseWithLinkedTitle();
    const host = stubHost(collection);
    const text = attachedText([reference(undefined, 'gone'), { insert: '!' }]);
    expect(
      getTextWithResolvedReferences(text, { serviceGet: () => host } as never)
    ).toBe(`${CHROME_DELETED_DOC[1]}!`);
  });

  test('names an untitled doc with the editor wording, and keeps an alias over it', () => {
    const { collection } = databaseWithLinkedTitle();
    collection.createDoc('blank');
    const dataSource = { serviceGet: () => stubHost(collection) } as never;
    expect(
      getTextWithResolvedReferences(
        attachedText([reference(undefined, 'blank')]),
        dataSource
      )
    ).toBe(CHROME_UNTITLED[1]);
    expect(
      getTextWithResolvedReferences(
        attachedText([reference(ALIAS, 'blank')]),
        dataSource
      )
    ).toBe(ALIAS);
  });

  test('without an editor host, keeps the raw text', () => {
    const { view, rowId, titleId } = databaseWithLinkedTitle(undefined, false);
    expect(view.cellGetOrCreate(rowId, titleId).stringValue$.value).toBe(
      `${REFERENCE_NODE} notes`
    );
  });

  test('resolves a Y.Text cell and keeps a plain-string cell as it is', () => {
    const { collection } = databaseWithLinkedTitle();
    const dataSource = { serviceGet: () => stubHost(collection) } as never;
    expect(
      getTextWithResolvedReferences(
        attachedText([reference(), { insert: ' notes' }]),
        dataSource
      )
    ).toBe(`${LINKED_TITLE} notes`);
    const stored = 'stored as a string';
    expect(getTextWithResolvedReferences(stored, dataSource)).toBe(stored);
  });
});
