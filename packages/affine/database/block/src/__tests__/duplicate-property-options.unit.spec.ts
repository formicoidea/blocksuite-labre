/**
 * "Duplicate property" gives the copy of a select or multi-select column its
 * own options (`DatabaseBlockDataSource.propertyDuplicate`).
 *
 * The copy took `data.options` with the SAME option ids, and its cells the
 * same ids, so two columns shared one option identity: anything keyed by an
 * option id (a host duplicating or merging bases, a filter or a group carried
 * from one column to the other, a reader indexing tags by id) took one tag
 * for the other. The copy now gets fresh option ids and its duplicated cells
 * are remapped to them, select and multi-select alike.
 *
 * What it would have caught:
 * - an option id shared between the source column and its copy;
 * - a remap that loses a label (a duplicated cell no longer reading as the
 *   same text) or touches the source column and its cells;
 * - an option edited in one column showing in the other;
 * - the duplicate splitting into several undo steps (Ctrl+Z leaving a column
 *   without its cells, or cells pointing at options that are gone);
 * - a duplicate written by a reader on a read-only document.
 */
import {
  DatabaseBlockSchemaExtension,
  type DatabaseBlockModel,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { FeatureFlagService } from '@labre/affine-shared/services';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test } from 'vitest';

import { DatabaseBlockDataSource } from '../data-source.js';

type Tag = { id: string; value: string; color: string };

const OPTIONS: Tag[] = [
  { id: 'opt-a', value: 'Alpha', color: 'red' },
  { id: 'opt-b', value: 'Beta', color: 'blue' },
];

function databaseWithSelects() {
  const workspace = new TestWorkspace({ id: 'duplicate-property-options' });
  workspace.meta.initialize();
  const store = workspace.createDoc('doc0').getStore({
    extensions: [
      RootBlockSchemaExtension,
      NoteBlockSchemaExtension,
      ParagraphBlockSchemaExtension,
      DatabaseBlockSchemaExtension,
      FeatureFlagService,
    ],
  });
  let databaseId = '';
  const rows: string[] = [];
  // `store.load` runs the history's `loaded` hook: without it no undo.
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('page') });
    const noteId = store.addBlock('affine:note', {}, rootId);
    databaseId = store.addBlock(
      'affine:database',
      {
        title: new Text('Plan'),
        columns: [
          {
            id: 'status',
            type: 'select',
            name: 'Status',
            data: { options: OPTIONS },
          },
          {
            id: 'tags',
            type: 'multi-select',
            name: 'Tags',
            data: { options: OPTIONS },
          },
        ] as never,
      },
      noteId
    );
    rows.push(
      ...['one', 'two', 'three'].map(text =>
        store.addBlock('affine:paragraph', { text: new Text(text) }, databaseId)
      )
    );
  });
  const model = store.getModelById(databaseId) as DatabaseBlockModel;
  const [one, two] = rows as [string, string, string];
  store.transact(() => {
    model.props.cells = {
      [one]: {
        status: { columnId: 'status', value: 'opt-a' },
        tags: { columnId: 'tags', value: ['opt-a', 'opt-b'] },
      },
      [two]: {
        status: { columnId: 'status', value: 'opt-b' },
        tags: { columnId: 'tags', value: ['opt-b'] },
      },
      // The third row has no cells: an empty row stays empty.
    };
  });
  store.resetHistory();
  const source = new DatabaseBlockDataSource(model);
  return { store, model, source, rows };
}

const optionsOf = (source: DatabaseBlockDataSource, id: string) =>
  (source.propertyDataGet(id) as { options: Tag[] }).options;

const labelsOf = (
  source: DatabaseBlockDataSource,
  id: string,
  rows: string[]
) => {
  const options = optionsOf(source, id);
  const label = (optionId: unknown) =>
    options.find(option => option.id === optionId)?.value;
  return rows.map(rowId => {
    const value = source.cellValueGet(rowId, id);
    return Array.isArray(value) ? value.map(label) : label(value);
  });
};

const snapshot = (model: DatabaseBlockModel) =>
  JSON.parse(
    JSON.stringify({ columns: model.props.columns, cells: model.props.cells })
  );

describe('duplicating a column with options', () => {
  test.each(['status', 'tags'])(
    'the copy of %s shares no option id with its source',
    id => {
      const { source } = databaseWithSelects();
      const copy = source.propertyDuplicate(id)!;

      const sourceIds = optionsOf(source, id).map(option => option.id);
      const copyIds = optionsOf(source, copy).map(option => option.id);
      expect(copyIds).toHaveLength(sourceIds.length);
      expect(copyIds.filter(optionId => sourceIds.includes(optionId))).toEqual(
        []
      );
      expect(new Set(copyIds).size).toBe(copyIds.length);
    }
  );

  test.each(['status', 'tags'])(
    'the duplicated %s cells show the same labels, colours kept',
    id => {
      const { source, rows } = databaseWithSelects();
      const copy = source.propertyDuplicate(id)!;

      expect(labelsOf(source, copy, rows)).toEqual(labelsOf(source, id, rows));
      expect(
        optionsOf(source, copy).map(({ value, color }) => [value, color])
      ).toEqual(OPTIONS.map(({ value, color }) => [value, color]));
    }
  );

  test('the source column and its cells do not move', () => {
    const { model, source } = databaseWithSelects();
    const before = snapshot(model);

    source.propertyDuplicate('status');
    source.propertyDuplicate('tags');

    const after = snapshot(model);
    const kept = (ids: string[], cells: Record<string, unknown>) =>
      ids.map(id => cells[id]);
    const sourceIds = before.columns.map((column: { id: string }) => column.id);
    expect(
      sourceIds.map((id: string) =>
        after.columns.find((column: { id: string }) => column.id === id)
      )
    ).toEqual(before.columns);
    expect(
      Object.keys(before.cells).map(rowId =>
        kept(Object.keys(before.cells[rowId]), after.cells[rowId])
      )
    ).toEqual(
      Object.keys(before.cells).map(rowId =>
        kept(Object.keys(before.cells[rowId]), before.cells[rowId])
      )
    );
  });

  test('an option renamed in the copy stays as it was in the source', () => {
    const { source, rows } = databaseWithSelects();
    const copy = source.propertyDuplicate('tags')!;
    const sourceLabels = labelsOf(source, 'tags', rows);

    source.propertyDataSet(copy, {
      options: optionsOf(source, copy).map(option => ({
        ...option,
        value: `${option.value} copy`,
      })),
    });

    expect(optionsOf(source, 'tags')).toEqual(OPTIONS);
    expect(labelsOf(source, 'tags', rows)).toEqual(sourceLabels);
    expect(labelsOf(source, copy, rows)).toEqual(
      sourceLabels.map(labels =>
        (labels as string[]).map(label => `${label} copy`)
      )
    );
  });

  test('one undo removes the copy and its cells together', () => {
    const { store, model, source } = databaseWithSelects();
    const before = snapshot(model);

    source.propertyDuplicate('tags');
    expect(store.canUndo).toBe(true);
    store.undo();

    expect(snapshot(model)).toEqual(before);
    expect(store.canUndo).toBe(false);
  });

  test('a read-only document writes nothing', () => {
    const { store, model, source } = databaseWithSelects();
    store.readonly = true;
    const updates: Uint8Array[] = [];
    const record = (update: Uint8Array) => updates.push(update);
    store.doc.spaceDoc.on('update', record);
    let copy: string | undefined;
    try {
      copy = source.propertyDuplicate('tags');
    } finally {
      store.doc.spaceDoc.off('update', record);
    }

    expect(copy).toBeUndefined();
    expect(updates).toEqual([]);
    expect(model.props.columns.map(column => column.id)).toEqual([
      'status',
      'tags',
    ]);
  });
});
