import {
  addProperty,
  databaseBlockProperties,
  DatabaseBlockDataSource,
  databaseBlockViewConverts,
  databaseBlockViews,
} from '@labre/affine-block-database';
import {
  type DatabaseBlockModel,
  DatabaseBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { propertyModelPresets } from '@labre/data-view/property-pure-presets';
import {
  type FlatViewDataType,
  GallerySingleView,
  ListSingleView,
} from '@labre/data-view/view-presets';
import { Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test } from 'vitest';

/**
 * The gallery and list presets inside the `affine:database` block (ADR 0035
 * §1 and §8, issues B6 and B7), over the real inline source and a real store.
 *
 * What it would have caught:
 * - a preset the block does not register, so a stored `gallery` or `list`
 *   view meets the unknown-view path;
 * - a stored gallery or list view rewritten by being read: the block's
 *   `props.views` must be deep-equal and the Y.Doc emit no update while a
 *   view is resolved and its rows, properties and cells are read;
 * - a new view storing its visibility in another shape than the
 *   `columns[].hide` table and kanban use;
 * - a property added from a gallery staying hidden in it.
 */

const extensions = [
  RootBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  DatabaseBlockSchemaExtension,
];

function createDatabase(views: FlatViewDataType[] = []) {
  const collection = new TestWorkspace({
    id: 'test-collection',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  collection.meta.initialize();
  const yDoc = collection.createDoc('doc-gallery-list');
  yDoc.load();
  const doc = yDoc.getStore({ extensions });
  const rootId = doc.addBlock('affine:page', { title: new Text('views') });
  const noteId = doc.addBlock('affine:note', {}, rootId);
  const databaseId = doc.addBlock(
    'affine:database',
    { columns: [], titleColumn: 'Title' },
    noteId
  );
  const model = doc.getModelById(databaseId) as DatabaseBlockModel;
  const status = addProperty(
    model,
    'end',
    propertyModelPresets.selectPropertyModelConfig.create('Status', {
      options: [{ id: 'todo', value: 'Todo', color: 'var(--affine-tag-blue)' }],
    })
  );
  const notes = addProperty(
    model,
    'end',
    databaseBlockProperties.richTextColumnConfig.create('Notes')
  );
  doc.addBlock('affine:paragraph', { text: new Text('Alpha') }, databaseId);
  doc.addBlock('affine:paragraph', { text: new Text('Bravo') }, databaseId);
  if (views.length) doc.updateBlock(model, { views });
  return { doc, yDoc, model, status, notes };
}

describe('the gallery and list presets in the database block', () => {
  test('are registered with the block', () => {
    const types = databaseBlockViews.map(view => view.type);
    expect(types).toContain('gallery');
    expect(types).toContain('list');
  });

  test('a stored gallery and list view load without a write', () => {
    const { model, yDoc, status } = createDatabase();
    const storedViews: FlatViewDataType[] = [
      {
        id: 'gallery-1',
        name: 'Gallery',
        mode: 'gallery',
        columns: [{ id: status, hide: true }],
        filter: { type: 'group', op: 'and', conditions: [] },
      },
      {
        id: 'list-1',
        name: 'List',
        mode: 'list',
        columns: [],
        filter: { type: 'group', op: 'and', conditions: [] },
      },
    ];
    model.store.updateBlock(model, { views: storedViews });
    const before = JSON.parse(JSON.stringify(model.props.views));

    let updates = 0;
    const onUpdate = () => updates++;
    yDoc.spaceDoc.on('update', onUpdate);
    try {
      const dataSource = new DatabaseBlockDataSource(model);
      const gallery = dataSource.viewManager.viewGet('gallery-1');
      const list = dataSource.viewManager.viewGet('list-1');
      expect(gallery).toBeInstanceOf(GallerySingleView);
      expect(list).toBeInstanceOf(ListSingleView);
      for (const view of [gallery, list]) {
        if (!view) throw new Error('view not resolved');
        expect(view.rows$.value).toHaveLength(2);
        for (const row of view.rows$.value) {
          for (const property of view.propertiesRaw$.value) {
            void property.cellGetOrCreate(row.rowId).jsonValue$.value;
          }
        }
      }
      expect(
        gallery?.propertyGetOrCreate(status).hide$.value,
        'the stored hide is read'
      ).toBe(true);
      expect(list?.propertyGetOrCreate(status).hide$.value).toBe(false);
    } finally {
      yDoc.spaceDoc.off('update', onUpdate);
    }
    expect(updates).toBe(0);
    expect(model.props.views).toEqual(before);
  });

  test('a new gallery shows its title only, in the columns[].hide shape', () => {
    const { model, status, notes } = createDatabase();
    const dataSource = new DatabaseBlockDataSource(model);
    const id = dataSource.viewManager.viewAdd('gallery');
    const data = dataSource.viewDataGet(id) as FlatViewDataType;
    expect(data.mode).toBe('gallery');
    const titleId = dataSource.properties$.value.find(
      property => dataSource.propertyTypeGet(property) === 'title'
    );
    expect(data.columns).toEqual([
      { id: titleId, hide: false },
      { id: status, hide: true },
      { id: notes, hide: true },
    ]);
    const view = dataSource.viewManager.viewGet(id) as GallerySingleView;
    expect(view.bodyProperties$.value).toEqual([]);
    view.propertyGetOrCreate(status).hideSet(false);
    expect(view.bodyProperties$.value.map(property => property.id)).toEqual([
      status,
    ]);
  });

  test('a property added from a list shows in it', () => {
    const { model } = createDatabase();
    const dataSource = new DatabaseBlockDataSource(model);
    const id = dataSource.viewManager.viewAdd('list');
    const view = dataSource.viewManager.viewGet(id) as ListSingleView;
    const added = view.propertyAdd('end', { type: 'number', name: 'Score' });
    expect(added).toBeTruthy();
    expect(view.bodyProperties$.value.map(property => property.id)).toContain(
      added
    );
  });

  test('a table becomes a gallery with its filter and sort', () => {
    const { model, status } = createDatabase();
    const dataSource = new DatabaseBlockDataSource(model);
    const id = dataSource.viewManager.viewAdd('table');
    const filter = {
      type: 'group' as const,
      op: 'and' as const,
      conditions: [
        {
          type: 'filter' as const,
          left: { type: 'ref' as const, name: status },
          function: 'isNotEmpty',
          args: [],
        },
      ],
    };
    const sort = {
      manuallySort: [],
      sortBy: [{ ref: { type: 'ref' as const, name: status }, desc: true }],
    };
    dataSource.viewDataUpdate(
      id,
      () => ({ filter, sort }) as Partial<FlatViewDataType>
    );
    expect(
      databaseBlockViewConverts.some(
        c => c.from === 'table' && c.to === 'gallery'
      )
    ).toBe(true);
    dataSource.viewManager.viewChangeType(id, 'gallery');
    const data = dataSource.viewDataGet(id) as FlatViewDataType;
    expect(data.mode).toBe('gallery');
    expect(data.filter).toEqual(filter);
    expect(data.sort).toEqual(sort);
  });
});
