/**
 * GUARD — `connectDatabaseToSource` (ADR 0035 §5, amendment of 2026-10-28):
 * the creation popover turns the native database a slash entry just
 * inserted into a view of the host source the reader picked.
 *
 * What it would have caught:
 * - the block still showing its native schema or rows once connected (the
 *   native columns kept beside the host's, the 0 to 3 native rows left as
 *   children a hosted source never reads);
 * - the view losing its id or name, keeping the native view's data (columns
 *   of properties the source does not have), or not naming its `sourceId`;
 * - the connection taking more than one undo step (an undo leaving a block
 *   with an `externalSourceId` and no view of it), or one undo not giving
 *   the native database back whole, rows included;
 * - a write on a read-only document, over a block already connected (a
 *   second pick re-pointing a database the reader already uses), or without
 *   a host data source to read the source through;
 * - a title the reader typed overwritten by the database's.
 */
import {
  DatabaseBlockSchemaExtension,
  type DatabaseBlockModel,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { FeatureFlagService } from '@labre/affine-shared/services';
import { propertyModelPresets } from '@labre/data-view/property-pure-presets';
import { viewPresets } from '@labre/data-view/view-presets';
import type { BlockStdScope } from '@labre/std';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';

import { DatabaseBlockDataSource } from '../data-source.js';
import { connectDatabaseToSource } from '../linked-view.js';
import { DatabaseDataSourceProvider } from '../service/index.js';
import { addProperty } from '../utils/block-utils.js';

const PLAN = { id: 'host:plan', title: 'Plan' };

/** A native database as "Table View" leaves it, with a property and rows. */
function nativeDatabase(rows = 2) {
  const collection = new TestWorkspace({ id: 'connect-to-source' });
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
  const databaseId = store.addBlock(
    'affine:database',
    { columns: [], title: new Text('') },
    noteId
  );
  const model = store.getModelById(databaseId) as DatabaseBlockModel;
  const status = addProperty(
    model,
    'end',
    propertyModelPresets.selectPropertyModelConfig.create('Status', {
      options: [],
    })
  );
  const native = new DatabaseBlockDataSource(model);
  for (let i = 0; i < rows; i++) native.rowAdd('end');
  const viewId = native.viewManager.viewAdd(
    viewPresets.tableViewMeta.type,
    'Table'
  );
  native.dispose();
  // The reader may arrange the native table while the popover is open.
  store.updateBlock(model, {
    views: model.props.views.map(view => ({
      ...view,
      columns: [{ id: status, width: 180, hide: false }],
    })),
  });
  return { store, model, status, viewId };
}

/**
 * The host's data source, reading the block it is given: what the
 * integration suite's `hostSources` does. Every source created is recorded,
 * to check the temporary one is disposed.
 */
function stdOf(store: Store, options: { provider?: boolean } = {}) {
  const created: DatabaseBlockDataSource[] = [];
  const provider: DatabaseDataSourceProvider = {
    createDataSource: (model, init) => {
      const source = new DatabaseBlockDataSource(model, init);
      vi.spyOn(source, 'dispose');
      created.push(source);
      return source;
    },
  };
  const std = {
    store,
    getOptional: (id: unknown) =>
      id === DatabaseDataSourceProvider && options.provider !== false
        ? provider
        : null,
  } as unknown as BlockStdScope;
  return { std, created };
}

const snapshot = (model: DatabaseBlockModel) =>
  JSON.stringify({
    externalSourceId: model.props.externalSourceId ?? null,
    title: model.props.title.toString(),
    columns: model.props.columns,
    views: model.props.views,
    children: model.children.map(child => child.id),
  });

describe('connecting a native database to a host source', () => {
  test('writes the source, the title, an empty schema and a re-derived view, and drops the rows', () => {
    const { store, model, status, viewId } = nativeDatabase();
    const { std, created } = stdOf(store);
    expect(model.children).toHaveLength(2);
    expect(JSON.stringify(model.props.views)).toContain(status);

    expect(
      connectDatabaseToSource(std, model, { database: PLAN, sourceId: 'src-2' })
    ).toBe(true);

    expect(model.props.externalSourceId).toBe('host:plan');
    expect(model.props.title.toString()).toBe('Plan');
    expect(model.props.columns).toEqual([]);
    expect(model.children).toHaveLength(0);
    expect(model.props.views).toHaveLength(1);
    const [view] = model.props.views;
    expect(view).toMatchObject({
      id: viewId,
      name: 'Table',
      mode: 'table',
      sourceId: 'src-2',
      columns: [],
    });
    // Nothing of the native schema is left in the view's data.
    expect(JSON.stringify(view)).not.toContain(status);
    // The temporary source is disposed; the block builds its own.
    expect(created).toHaveLength(1);
    expect(created[0]!.dispose).toHaveBeenCalledTimes(1);
  });

  test('is one undo step: one undo gives the native database back, rows included', () => {
    const { store, model } = nativeDatabase(3);
    const { std } = stdOf(store);
    const before = snapshot(model);

    connectDatabaseToSource(std, model, { database: PLAN, sourceId: 'src-1' });
    expect(snapshot(model)).not.toBe(before);

    store.undo();
    const restored = store.getModelById(model.id) as DatabaseBlockModel;
    expect(snapshot(restored)).toBe(before);
    expect(restored.children).toHaveLength(3);
    expect(restored.props.externalSourceId).toBeUndefined();
  });

  test('keeps a title the reader typed', () => {
    const { store, model } = nativeDatabase();
    model.props.title.insert('Roadmap', 0);
    const { std } = stdOf(store);
    connectDatabaseToSource(std, model, { database: PLAN, sourceId: 'src-1' });
    expect(model.props.title.toString()).toBe('Roadmap');
  });

  test('writes nothing on a read-only document', () => {
    const { store, model } = nativeDatabase();
    const { std, created } = stdOf(store);
    const before = snapshot(model);
    store.readonly = true;
    expect(
      connectDatabaseToSource(std, model, { database: PLAN, sourceId: 'src-1' })
    ).toBe(false);
    expect(snapshot(model)).toBe(before);
    expect(created).toHaveLength(0);
  });

  test('writes nothing over a block already connected', () => {
    const { store, model } = nativeDatabase();
    const { std } = stdOf(store);
    connectDatabaseToSource(std, model, { database: PLAN, sourceId: 'src-1' });
    const connected = snapshot(model);
    expect(
      connectDatabaseToSource(std, model, {
        database: { id: 'host:other', title: 'Other' },
        sourceId: 'src-9',
      })
    ).toBe(false);
    expect(snapshot(model)).toBe(connected);
  });

  test('without a host data source, answers false and writes nothing', () => {
    const { store, model } = nativeDatabase();
    const { std } = stdOf(store, { provider: false });
    const before = snapshot(model);
    expect(
      connectDatabaseToSource(std, model, { database: PLAN, sourceId: 'src-1' })
    ).toBe(false);
    expect(snapshot(model)).toBe(before);
  });
});
