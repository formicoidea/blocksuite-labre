import {
  addProperty,
  copyCellsByProperty,
  databaseBlockProperties,
  DatabaseBlockDataSource,
  deleteColumn,
  getCell,
  getProperty,
  updateCell,
} from '@labre/affine-database-block';
import {
  type CellDataType,
  type ColumnDataType,
  type DatabaseBlockModel,
  DatabaseBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { propertyModelPresets } from '@labre/affine-database-engine/property-pure-presets';
import type {
  TableSingleView,
  TableViewData,
} from '@labre/affine-database-engine/view-presets';
import type { BlockModel, Store } from '@labre/store';
import { Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { beforeEach, describe, expect, test } from 'vitest';

const extensions = [
  RootBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  DatabaseBlockSchemaExtension,
];

function createTestOptions() {
  const idGenerator = createAutoIncrementIdGenerator();
  return { id: 'test-collection', idGenerator };
}

function createTestDoc(docId = 'doc0') {
  const options = createTestOptions();
  const collection = new TestWorkspace(options);
  collection.meta.initialize();
  const doc = collection.createDoc(docId);
  doc.load();
  return doc.getStore({ extensions });
}

describe('DatabaseManager', () => {
  let doc: Store;
  let db: DatabaseBlockModel;

  let rootId: BlockModel['id'];
  let noteBlockId: BlockModel['id'];
  let databaseBlockId: BlockModel['id'];
  let p1: BlockModel['id'];
  let p2: BlockModel['id'];
  let col1: ColumnDataType['id'];
  let col2: ColumnDataType['id'];
  let col3: ColumnDataType['id'];

  const selection = [
    { id: '1', value: 'Done', color: 'var(--affine-tag-white)' },
    { id: '2', value: 'TODO', color: 'var(--affine-tag-pink)' },
    { id: '3', value: 'WIP', color: 'var(--affine-tag-blue)' },
  ];

  beforeEach(() => {
    doc = createTestDoc();

    rootId = doc.addBlock('affine:page', {
      title: new Text('database test'),
    });
    noteBlockId = doc.addBlock('affine:note', {}, rootId);

    databaseBlockId = doc.addBlock(
      'affine:database',
      {
        columns: [],
        titleColumn: 'Title',
      },
      noteBlockId
    );

    const databaseModel = doc.getModelById(
      databaseBlockId
    ) as DatabaseBlockModel;
    db = databaseModel;

    col1 = addProperty(
      db,
      'end',
      databaseBlockProperties.numberColumnConfig.create('Number')
    );
    col2 = addProperty(
      db,
      'end',
      propertyModelPresets.selectPropertyModelConfig.create('Single Select', {
        options: selection,
      })
    );
    col3 = addProperty(
      db,
      'end',
      databaseBlockProperties.richTextColumnConfig.create('Rich Text')
    );

    doc.updateBlock(databaseModel, {
      columns: [col1, col2, col3],
    });

    p1 = doc.addBlock(
      'affine:paragraph',
      {
        text: new Text('text1'),
      },
      databaseBlockId
    );
    p2 = doc.addBlock(
      'affine:paragraph',
      {
        text: new Text('text2'),
      },
      databaseBlockId
    );

    updateCell(db, p1, {
      columnId: col1,
      value: 0.1,
    });
    updateCell(db, p2, {
      columnId: col2,
      value: [selection[1]],
    });
  });

  test('getColumn', () => {
    const column = {
      ...databaseBlockProperties.numberColumnConfig.create('testColumnId'),
      id: 'testColumnId',
    };
    addProperty(db, 'end', column);

    const result = getProperty(db, column.id);
    expect(result).toEqual(column);
  });

  test('addColumn', () => {
    const column =
      databaseBlockProperties.numberColumnConfig.create('Test Column');
    const id = addProperty(db, 'end', column);
    const result = getProperty(db, id);

    expect(result).toMatchObject(column);
    expect(result).toHaveProperty('id');
  });

  test('deleteColumn', () => {
    const column = {
      ...databaseBlockProperties.numberColumnConfig.create('Test Column'),
      id: 'testColumnId',
    };
    addProperty(db, 'end', column);
    expect(getProperty(db, column.id)).toEqual(column);

    deleteColumn(db, column.id);
    expect(getProperty(db, column.id)).toBeUndefined();
  });

  test('getCell', () => {
    const modelId = doc.addBlock(
      'affine:paragraph',
      {
        text: new Text('paragraph'),
      },
      noteBlockId
    );
    const column = {
      ...databaseBlockProperties.numberColumnConfig.create('Test Column'),
      id: 'testColumnId',
    };
    const cell: CellDataType = {
      columnId: column.id,
      value: 42,
    };

    addProperty(db, 'end', column);
    updateCell(db, modelId, cell);

    const model = doc.getModelById(modelId);

    expect(model).not.toBeNull();

    const result = getCell(db, model!.id, column.id);
    expect(result).toEqual(cell);
  });

  test('updateCell', () => {
    const newRowId = doc.addBlock(
      'affine:paragraph',
      {
        text: new Text('text3'),
      },
      databaseBlockId
    );

    updateCell(db, newRowId, {
      columnId: col2,
      value: [selection[2]],
    });

    const cell = getCell(db, newRowId, col2);
    expect(cell).toEqual({
      columnId: col2,
      value: [selection[2]],
    });
  });

  test('copyCellsByColumn', () => {
    const newColId = addProperty(
      db,
      'end',
      propertyModelPresets.selectPropertyModelConfig.create('Copied Select', {
        options: selection,
      })
    );

    copyCellsByProperty(db, col2, newColId);

    const cell = getCell(db, p2, newColId);
    expect(cell).toEqual({
      columnId: newColId,
      value: [selection[1]],
    });
  });
});

/**
 * Regression guard for #249 ("a new date property never shows up in the table
 * view"). The reported symptom was not reproducible, so this pins the whole
 * chain instead: `SingleViewBase.propertyAdd` → `DatabaseBlockDataSource`
 * → `addProperty` on the model → `TableSingleView.propertiesRaw$` →
 * `TableProperty.move()` writing the column into the view data. Both entry
 * points are covered: the typed add (property menu), and the untyped add the
 * classic "+" button does — a multi-select whose type the header menu changes
 * afterwards.
 */
describe('a property added from the table view shows up in it', () => {
  const addablePropertyTypes = [
    'date',
    'number',
    'checkbox',
    'progress',
    'select',
    'multi-select',
    'link',
    'rich-text',
    'created-time',
  ] as const;

  function createTableView() {
    const doc = createTestDoc('doc-property-add');
    const rootId = doc.addBlock('affine:page', {
      title: new Text('property add'),
    });
    const noteBlockId = doc.addBlock('affine:note', {}, rootId);
    const databaseBlockId = doc.addBlock(
      'affine:database',
      { columns: [], titleColumn: 'Title' },
      noteBlockId
    );
    const model = doc.getModelById(databaseBlockId) as DatabaseBlockModel;
    const dataSource = new DatabaseBlockDataSource(model);
    dataSource.rowAdd('end');
    const viewId = dataSource.viewManager.viewAdd('table');
    const view = dataSource.viewManager.viewGet(viewId) as
      | TableSingleView
      | undefined;
    if (!view) {
      throw new Error('the table view was not created');
    }
    return { dataSource, view };
  }

  function expectVisibleInTable(
    dataSource: DatabaseBlockDataSource,
    view: TableSingleView,
    propertyId: string,
    type: string
  ) {
    // the data source knows the property, with the expected type
    expect(dataSource.properties$.value).toContain(propertyId);
    expect(dataSource.propertyTypeGet(propertyId)).toBe(type);
    expect(view.propertyMetas$.value.map(meta => meta.type)).toContain(type);

    // the view lists it, raw and visible
    expect(view.propertiesRaw$.value.map(property => property.id)).toContain(
      propertyId
    );
    expect(view.propertyIds$.value).toContain(propertyId);

    // and it is persisted in the view data as a shown column with a width
    const property = view.propertyGetOrCreate(propertyId);
    expect(property.hide$.value).toBe(false);
    expect(property.width$.value).toBeGreaterThan(0);

    const columns = (view.data$.value as TableViewData | undefined)?.columns;
    expect(columns?.map(column => column.id)).toContain(propertyId);
    expect(columns?.find(column => column.id === propertyId)?.hide).toBe(false);
  }

  test.each(addablePropertyTypes)(
    'adds a %s property with its type picked up front',
    type => {
      const { dataSource, view } = createTableView();

      const propertyId = view.propertyAdd('end', { type, name: 'New Column' });

      expect(propertyId).toBeTruthy();
      expectVisibleInTable(dataSource, view, propertyId!, type);
    }
  );

  test.each(addablePropertyTypes)(
    'adds an untyped property then switches it to %s',
    type => {
      const { dataSource, view } = createTableView();

      // what the classic table "+" button does: a multi-select column…
      const propertyId = view.propertyAdd('end');
      expect(propertyId).toBeTruthy();
      expect(dataSource.propertyTypeGet(propertyId!)).toBe('multi-select');

      // …whose type the header menu changes afterwards
      view.propertyGetOrCreate(propertyId!).typeSet?.(type);

      expectVisibleInTable(dataSource, view, propertyId!, type);
    }
  );
});
