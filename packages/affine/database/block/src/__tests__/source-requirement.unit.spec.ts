/**
 * GUARD — `sourceRequirement` and `reconnectDatabaseView` (ADR 0035
 * amendment of 2026-10-29, product owner's decision of the same day): what a
 * host that sets `requireSource` shows of a database, and how a hosted view
 * whose source is gone is connected again.
 *
 * What it would have caught:
 * - a host that does not set it (absent, `false`, no picker) seeing anything
 *   but the 1.0 database;
 * - the row count deciding editability: a hosted database with no row drawn
 *   as anything but an ordinary table, or a native database editable because
 *   it has rows (it shows them READ-ONLY), or a native database with no row
 *   not offered a source;
 * - a hosted source the host no longer resolves kept as "Source not found"
 *   instead of offering "Connect a source";
 * - the native data source left writable under such a host (`locked$`);
 * - a reconnection rewriting the other views, losing the view's id, name or
 *   mode, writing on a read-only document or a block with no source, or
 *   taking more than one undo step.
 */
import {
  DatabaseBlockSchemaExtension,
  type DatabaseBlockModel,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  DataSourcePickerProvider,
  type DataSourcePickerService,
  FeatureFlagService,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { describe, expect, test } from 'vitest';

import { DatabaseBlockDataSource } from '../data-source.js';
import { reconnectDatabaseView, sourceRequirement } from '../linked-view.js';
import { DatabaseDataSourceProvider } from '../service/index.js';

function emptyDatabase(): { store: Store; model: DatabaseBlockModel } {
  const collection = new TestWorkspace({ id: 'source-requirement' });
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
  const databaseId = store.addBlock('affine:database', {}, noteId);
  const model = store.getBlock(databaseId)!.model as DatabaseBlockModel;
  return { store, model };
}

const picker = (requireSource?: boolean): DataSourcePickerService => ({
  list: () => signal([]),
  requireSource,
});

function stdWith(
  store: Store,
  service: DataSourcePickerService | null
): BlockStdScope {
  const provider: DatabaseDataSourceProvider = {
    createDataSource: (model, init) => new DatabaseBlockDataSource(model, init),
  };
  return {
    store,
    getOptional: (id: unknown) =>
      id === DataSourcePickerProvider
        ? service
        : id === DatabaseDataSourceProvider
          ? provider
          : null,
  } as unknown as BlockStdScope;
}

describe('sourceRequirement', () => {
  test('a host that does not require a source sees the 1.0 database', () => {
    const { store, model } = emptyDatabase();
    for (const service of [picker(), picker(false), null]) {
      expect(sourceRequirement(stdWith(store, service), model)).toBe('none');
      expect(sourceRequirement(stdWith(store, service), model, true)).toBe(
        'none'
      );
    }
  });

  test('no source and no row: connect a source', () => {
    const { store, model } = emptyDatabase();
    expect(sourceRequirement(stdWith(store, picker(true)), model)).toBe(
      'connect'
    );
  });

  test('no source but native rows: shown read-only', () => {
    const { store, model } = emptyDatabase();
    store.addBlock('affine:paragraph', {}, model.id);
    expect(sourceRequirement(stdWith(store, picker(true)), model)).toBe(
      'read-only'
    );
  });

  test('a hosted database is an ordinary table, rows or none', () => {
    const { store, model } = emptyDatabase();
    store.updateBlock(model, { externalSourceId: 'host:plan' });
    expect(model.children).toHaveLength(0);
    expect(sourceRequirement(stdWith(store, picker(true)), model)).toBe('none');
  });

  test('a hosted source the host no longer resolves: connect a source', () => {
    const { store, model } = emptyDatabase();
    store.updateBlock(model, { externalSourceId: 'host:gone' });
    expect(sourceRequirement(stdWith(store, picker(true)), model, true)).toBe(
      'connect'
    );
  });

  test('the native data source refuses edits through locked$', () => {
    const { model } = emptyDatabase();
    const native = new DatabaseBlockDataSource(model);
    expect(native.readonly$.value).toBe(false);
    native.locked$.value = true;
    expect(native.readonly$.value).toBe(true);
    native.dispose();
  });
});

describe('reconnectDatabaseView', () => {
  function hostedWithTwoViews() {
    const { store, model } = emptyDatabase();
    store.updateBlock(model, {
      externalSourceId: 'host:gone',
      views: [
        { id: 'v-1', name: 'Board', mode: 'kanban', sourceId: 'src-gone' },
        { id: 'v-2', name: 'Other', mode: 'table', sourceId: 'src-other' },
      ] as never,
    });
    return { store, model };
  }

  test('re-points the view and the block, and leaves the other views', () => {
    const { store, model } = hostedWithTwoViews();
    const other = JSON.stringify(model.props.views[1]);
    store.captureSync();
    expect(
      reconnectDatabaseView(stdWith(store, picker(true)), model, {
        database: { id: 'host:fresh' },
        sourceId: 'src-new',
        viewId: 'v-1',
      })
    ).toBe(true);
    expect(model.props.externalSourceId).toBe('host:fresh');
    expect(model.props.views[0]).toMatchObject({
      id: 'v-1',
      name: 'Board',
      sourceId: 'src-new',
    });
    expect(JSON.stringify(model.props.views[1])).toBe(other);

    store.undo();
    expect(model.props.externalSourceId).toBe('host:gone');
    expect(model.props.views[0]).toMatchObject({ sourceId: 'src-gone' });
  });

  test('writes nothing read-only, on a block with no source, or for no such view', () => {
    const { store, model } = hostedWithTwoViews();
    const before = JSON.stringify(model.props.views);
    const std = stdWith(store, picker(true));
    const choice = { database: { id: 'host:fresh' }, sourceId: 'src-new' };
    expect(
      reconnectDatabaseView(std, model, { ...choice, viewId: 'v-none' })
    ).toBe(false);
    store.readonly = true;
    expect(
      reconnectDatabaseView(std, model, { ...choice, viewId: 'v-1' })
    ).toBe(false);
    store.readonly = false;
    expect(JSON.stringify(model.props.views)).toBe(before);

    const { store: nativeStore, model: native } = emptyDatabase();
    expect(
      reconnectDatabaseView(stdWith(nativeStore, picker(true)), native, {
        ...choice,
        viewId: 'v-1',
      })
    ).toBe(false);
  });
});
