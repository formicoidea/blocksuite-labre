/**
 * GUARD — turning a table into a source (ADR 0035 amendment of 2026-10-29,
 * "Create Table" and "Move into a database" under `requireSource`): the
 * content handed to the host's `createDatabaseFrom`, and what is written
 * once it answers.
 *
 * What it would have caught:
 * - a row title losing its inline formatting (bold, links, mentions), a
 *   nested block lost or sent twice (a selected child counted as a row and
 *   inside its parent's body), a column, an option or a value left out, a
 *   rich text sent as an object the host cannot read;
 * - nested blocks sent to a host that keeps no page body (`rowBodies`)
 *   instead of a refusal, or the host asked anyway;
 * - anything written when the host answers `null` or rejects, when the
 *   document turned read-only or the content changed while it answered, or
 *   no notice then;
 * - the paragraphs left beside the new view, the conversion taking more
 *   than one undo step, or an undo not giving the paragraphs back;
 * - "Move into a database" keeping the native rows or schema, dropping a
 *   view, or not naming the new source on every view;
 * - "Create Table" offered under `requireSource` without the method.
 */
import {
  DatabaseBlockSchemaExtension,
  type DatabaseBlockModel,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  type DataSourcePickerContent,
  type DataSourcePickerDatabase,
  DataSourcePickerProvider,
  type DataSourcePickerService,
  FeatureFlagService,
  NotificationProvider,
} from '@labre/affine-shared/services';
import { propertyModelPresets } from '@labre/affine-database-engine/property-pure-presets';
import { viewPresets } from '@labre/affine-database-engine/view-presets';
import type { BlockStdScope } from '@labre/std';
import { type BlockModel, type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { describe, expect, test, vi } from 'vitest';

import { DatabaseBlockDataSource } from '../data-source.js';
import { canConvertToDatabase } from '../linked-view.js';
import { DatabaseDataSourceProvider } from '../service/index.js';
import {
  blocksContent,
  databaseContent,
  moveDatabaseRowsIntoSource,
  turnBlocksIntoSource,
} from '../turn-into-source.js';
import { addProperty } from '../utils/block-utils.js';

const FROM: DataSourcePickerDatabase = {
  id: 'host:from',
  title: 'From',
  sources: [{ id: 'src-from', title: 'Rows' }],
};

function page() {
  const collection = new TestWorkspace({ id: 'turn-into-source' });
  collection.meta.initialize();
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
  return { store, noteId };
}

/** Two paragraphs, the first bold and linked, the second with a child. */
function paragraphs() {
  const { store, noteId } = page();
  const bold = new Text([
    { insert: 'Ship ', attributes: { bold: true } },
    { insert: 'it', attributes: { link: 'https://example.com' } },
  ]);
  const a = store.addBlock('affine:paragraph', { text: bold }, noteId);
  const b = store.addBlock(
    'affine:paragraph',
    { text: new Text('Plan') },
    noteId
  );
  const child = store.addBlock(
    'affine:paragraph',
    { text: new Text('detail') },
    b
  );
  const model = (id: string) => store.getBlock(id)!.model as BlockModel;
  return { store, noteId, a: model(a), b: model(b), child: model(child) };
}

function stdOf(
  store: Store,
  picker: Partial<DataSourcePickerService> | null
): { std: BlockStdScope; toast: ReturnType<typeof vi.fn> } {
  const toast = vi.fn();
  const provider: DatabaseDataSourceProvider = {
    createDataSource: (model, init) => new DatabaseBlockDataSource(model, init),
  };
  const service = picker
    ? ({ list: () => signal([]), ...picker } as DataSourcePickerService)
    : null;
  const std = {
    store,
    getOptional: (id: unknown) => {
      if (id === DataSourcePickerProvider) return service;
      if (id === DatabaseDataSourceProvider) return provider;
      if (id === NotificationProvider) return { toast };
      return null;
    },
  } as unknown as BlockStdScope;
  return { std, toast };
}

const databases = (store: Store, noteId: string) =>
  store
    .getBlock(noteId)!
    .model.children.filter(
      child => child.flavour === 'affine:database'
    ) as DatabaseBlockModel[];

describe('the content handed to the host', () => {
  test('paragraphs: one row each, formatting kept, nested blocks as body', () => {
    const { store, a, b, child } = paragraphs();
    const { std } = stdOf(store, null);
    const content = blocksContent(std, [a, b]);
    expect(content.title).toBe('');
    expect(content.properties).toEqual([
      { id: 'title', name: '', type: 'title' },
    ]);
    expect(content.rows).toHaveLength(2);
    expect(content.rows[0]!.title).toEqual([
      { insert: 'Ship ', attributes: { bold: true } },
      { insert: 'it', attributes: { link: 'https://example.com' } },
    ]);
    expect(content.rows[0]!.body).toEqual([]);
    expect(content.rows[1]!.body).toHaveLength(1);
    expect(content.rows[1]!.body[0]!.id).toBe(child.id);
  });

  test('a database: its columns, options and values, rich text as a delta', () => {
    const { store, noteId } = page();
    const id = store.addBlock(
      'affine:database',
      { columns: [], title: new Text('Plan') },
      noteId
    );
    const model = store.getBlock(id)!.model as DatabaseBlockModel;
    const status = addProperty(
      model,
      'end',
      propertyModelPresets.selectPropertyModelConfig.create('Status', {
        options: [{ id: 'o-1', value: 'Open', color: 'red' }],
      })
    );
    const note = addProperty(
      model,
      'end',
      propertyModelPresets.textPropertyModelConfig.create('Note')
    );
    const native = new DatabaseBlockDataSource(model);
    const row = native.rowAdd('end');
    native.cellValueChange(row, status, 'o-1');
    native.cellValueChange(row, note, new Text('hello'));
    native.dispose();

    const content = databaseContent(stdOf(store, null).std, model);
    expect(content.title).toBe('Plan');
    expect(content.properties[0]!.type).toBe('title');
    expect(content.properties).toContainEqual({
      id: status,
      name: 'Status',
      type: 'select',
      options: [{ id: 'o-1', value: 'Open' }],
    });
    expect(content.rows).toHaveLength(1);
    expect(content.rows[0]!.values[status]).toBe('o-1');
    expect(content.rows[0]!.values[note]).toEqual([{ insert: 'hello' }]);
  });
});

describe('"Create Table" under requireSource', () => {
  test('is offered only with createDatabaseFrom', () => {
    const { store } = page();
    expect(canConvertToDatabase(stdOf(store, null).std)).toBe(true);
    expect(canConvertToDatabase(stdOf(store, {}).std)).toBe(true);
    expect(
      canConvertToDatabase(stdOf(store, { requireSource: true }).std)
    ).toBe(false);
    expect(
      canConvertToDatabase(
        stdOf(store, {
          requireSource: true,
          createDatabaseFrom: async () => FROM,
        }).std
      )
    ).toBe(true);
  });

  test('the paragraphs become a view of the new source, in one undo step', async () => {
    const { store, noteId, a, b } = paragraphs();
    const createDatabaseFrom = vi.fn(
      async (_content: DataSourcePickerContent) => FROM
    );
    const { std } = stdOf(store, {
      requireSource: true,
      rowBodies: true,
      createDatabaseFrom,
    });
    store.captureSync();
    expect(await turnBlocksIntoSource(std, [a, b], 'table')).toBe(true);

    expect(createDatabaseFrom).toHaveBeenCalledTimes(1);
    expect(createDatabaseFrom.mock.calls[0]![0].rows).toHaveLength(2);
    const [database] = databases(store, noteId);
    expect(database!.props.externalSourceId).toBe('host:from');
    expect(database!.props.views[0]).toMatchObject({ sourceId: 'src-from' });
    expect(store.getBlock(a.id)).toBeUndefined();
    expect(store.getBlock(b.id)).toBeUndefined();

    store.undo();
    expect(databases(store, noteId)).toHaveLength(0);
    expect(store.getBlock(a.id)).toBeDefined();
    expect(store.getBlock(b.id)).toBeDefined();
  });

  test('a selected child rides in its parent body, not as a row', async () => {
    const { store, a, b, child } = paragraphs();
    const createDatabaseFrom = vi.fn(
      async (_content: DataSourcePickerContent) => FROM
    );
    const { std } = stdOf(store, {
      requireSource: true,
      rowBodies: true,
      createDatabaseFrom,
    });
    await turnBlocksIntoSource(std, [a, b, child], 'table');
    expect(createDatabaseFrom.mock.calls[0]![0].rows).toHaveLength(2);
  });

  test('nested blocks without rowBodies: refused, the host never asked', async () => {
    const { store, a, b } = paragraphs();
    const createDatabaseFrom = vi.fn(async () => FROM);
    const { std, toast } = stdOf(store, {
      requireSource: true,
      createDatabaseFrom,
    });
    expect(await turnBlocksIntoSource(std, [a, b], 'table')).toBe(false);
    expect(createDatabaseFrom).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
    expect(store.getBlock(b.id)).toBeDefined();
  });

  test('a refusal, a rejection, read-only or edited content write nothing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const answers: (() => Promise<DataSourcePickerDatabase | null>)[] = [
      async () => null,
      async () => {
        throw new Error('refused');
      },
    ];
    for (const answer of answers) {
      const { store, noteId, a } = paragraphs();
      const { std, toast } = stdOf(store, {
        requireSource: true,
        createDatabaseFrom: answer,
      });
      expect(await turnBlocksIntoSource(std, [a], 'table')).toBe(false);
      expect(databases(store, noteId)).toHaveLength(0);
      expect(toast).toHaveBeenCalledTimes(1);
    }

    const late = paragraphs();
    const readonlyStd = stdOf(late.store, {
      requireSource: true,
      createDatabaseFrom: async () => {
        late.store.readonly = true;
        return FROM;
      },
    });
    expect(await turnBlocksIntoSource(readonlyStd.std, [late.a], 'table')).toBe(
      false
    );
    late.store.readonly = false;
    expect(databases(late.store, late.noteId)).toHaveLength(0);

    const edited = paragraphs();
    const editedStd = stdOf(edited.store, {
      requireSource: true,
      createDatabaseFrom: async () => {
        edited.a.text!.insert('!', 0);
        return FROM;
      },
    });
    expect(await turnBlocksIntoSource(editedStd.std, [edited.a], 'table')).toBe(
      false
    );
    expect(databases(edited.store, edited.noteId)).toHaveLength(0);
    expect(edited.store.getBlock(edited.a.id)).toBeDefined();
    error.mockRestore();
  });
});

describe('"Move into a database"', () => {
  test('connects every view to the new source and drops the native rows, in one undo step', async () => {
    const { store, noteId } = page();
    const id = store.addBlock(
      'affine:database',
      { columns: [], title: new Text('') },
      noteId
    );
    const model = store.getBlock(id)!.model as DatabaseBlockModel;
    const native = new DatabaseBlockDataSource(model);
    native.rowAdd('end');
    native.rowAdd('end');
    const table = native.viewManager.viewAdd(
      viewPresets.tableViewMeta.type,
      'Table'
    );
    const second = native.viewManager.viewAdd(
      viewPresets.tableViewMeta.type,
      'Second'
    );
    native.dispose();
    const createDatabaseFrom = vi.fn(
      async (_content: DataSourcePickerContent) => FROM
    );
    const { std } = stdOf(store, { requireSource: true, createDatabaseFrom });
    store.captureSync();
    expect(await moveDatabaseRowsIntoSource(std, model)).toBe(true);

    expect(createDatabaseFrom.mock.calls[0]![0].rows).toHaveLength(2);
    expect(model.props.externalSourceId).toBe('host:from');
    expect(model.props.title.toString()).toBe('From');
    expect(model.props.columns).toEqual([]);
    expect(model.children).toHaveLength(0);
    expect(model.props.views.map(view => [view.id, view.sourceId])).toEqual([
      [table, 'src-from'],
      [second, 'src-from'],
    ]);
    expect(databases(store, noteId)).toHaveLength(1);

    store.undo();
    expect(model.props.externalSourceId).toBeUndefined();
    expect(model.children).toHaveLength(2);
  });
});
