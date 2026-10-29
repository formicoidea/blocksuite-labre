/**
 * GUARD — a host may lock a source's properties and its new rows (ADR 0035
 * amendment of 2026-10-29): `DataSourcePickerService.sourcePolicy`.
 *
 * Labre lists every source of every base in a workspace setting, with a
 * switch for "properties locked" and one for "adding pages blocked". The
 * library refuses the locked writes at the view layer (`SingleViewBase`,
 * `PropertyBase`), the one path every menu, header, panel and shortcut of
 * every preset takes to the data source, and hides the controls.
 *
 * What it would have caught:
 * - a host without `sourcePolicy`, without a picker, or a native database
 *   seeing anything locked (1.1 hosts must be unchanged);
 * - a locked property still renamed, retyped, duplicated, deleted, or a
 *   property still added, by a caller that skips the menus;
 * - a locked source still taking a row (`rowAdd`, the table's own override
 *   with a filter's default values);
 * - a lock spilling over what stays allowed: cell values, hiding a
 *   property in a view, deleting rows, adding rows when only properties are
 *   locked, and the reverse;
 * - a lock that needs a reload: the host flips its signal, or the view
 *   switches to another source, and the views follow;
 * - a host that throws breaking the view instead of reading as unlocked.
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
  type DataSourcePickerSourcePolicy,
  FeatureFlagService,
} from '@labre/affine-shared/services';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { describe, expect, test, vi } from 'vitest';

import { DatabaseBlockDataSource } from '../data-source.js';

function database(externalSourceId: string | null = 'host:plan'): {
  store: Store;
  model: DatabaseBlockModel;
} {
  const collection = new TestWorkspace({ id: 'source-policy' });
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
    {
      title: new Text('Plan'),
      ...(externalSourceId ? { externalSourceId } : {}),
    },
    noteId
  );
  const model = store.getModelById(databaseId) as DatabaseBlockModel;
  return { store, model };
}

const UNLOCKED: DataSourcePickerSourcePolicy = {
  propertiesLocked: false,
  rowsLocked: false,
};

/** A host whose sources `s1` and `s2` each have their own switches. */
function host() {
  const policies = {
    s1: signal<DataSourcePickerSourcePolicy>(UNLOCKED),
    s2: signal<DataSourcePickerSourcePolicy>(UNLOCKED),
  };
  const asked = vi.fn();
  const picker: DataSourcePickerService = {
    list: () => signal([]),
    sourcePolicy: (databaseId, sourceId) => {
      asked(databaseId, sourceId);
      return policies[sourceId as 's1' | 's2'];
    },
  };
  return { picker, policies, asked };
}

/**
 * Two table views of the block, on sources `s1` and `s2`, a number property
 * and one row, written before anything is locked.
 */
function setup(
  picker: DataSourcePickerService | null,
  externalSourceId: string | null = 'host:plan'
) {
  const { store, model } = database(externalSourceId);
  const ds = new DatabaseBlockDataSource(model, source => {
    if (picker) source.serviceSet(DataSourcePickerProvider, picker);
  });
  const v1 = ds.viewManager.viewAdd('table');
  const v2 = ds.viewManager.viewAdd('table');
  ds.viewDataUpdate(v1, () => ({ sourceId: 's1' }) as never);
  ds.viewDataUpdate(v2, () => ({ sourceId: 's2' }) as never);
  ds.viewManager.setCurrentView(v1);
  const propertyId = ds.propertyAdd('end', { type: 'number', name: 'Score' })!;
  const rowId = ds.rowAdd('end');
  const view = ds.viewManager.viewGet(v1)!;
  return { store, model, ds, v1, v2, view, propertyId, rowId };
}

describe('a host policy on a source', () => {
  test('without sourcePolicy, without a picker, or on a native database, nothing is locked', () => {
    for (const { ds, view } of [
      setup({ list: () => signal([]) }),
      setup(null),
      setup(host().picker, null),
    ]) {
      expect(view.propertiesLocked$.value).toBe(false);
      expect(view.rowsLocked$.value).toBe(false);
      const before = ds.properties$.value.length;
      expect(view.propertyAdd('end')).toBeTruthy();
      expect(ds.properties$.value).toHaveLength(before + 1);
      expect(view.rowAdd('end')).toBeTruthy();
    }
  });

  test('a native database never asks the host', () => {
    const { picker, asked } = host();
    const { view } = setup(picker, null);
    expect(view.propertiesLocked$.value).toBe(false);
    expect(asked).not.toHaveBeenCalled();
  });

  test('locked properties refuse every schema write, and only those', () => {
    const { picker, policies, asked } = host();
    const { ds, view, propertyId, rowId } = setup(picker);
    policies.s1.value = { propertiesLocked: true, rowsLocked: false };

    expect(view.propertiesLocked$.value).toBe(true);
    expect(asked).toHaveBeenCalledWith('host:plan', 's1');
    const property = view.propertyGetOrCreate(propertyId);
    expect(property.nameCanSet).toBe(false);
    expect(property.typeCanSet).toBe(false);
    expect(property.canDuplicate).toBe(false);
    expect(property.canDelete).toBe(false);

    const properties = [...ds.properties$.value];
    expect(view.propertyAdd('end', { type: 'number' })).toBeUndefined();
    property.nameSet('Renamed');
    property.typeSet?.('rich-text');
    property.duplicate?.();
    property.delete?.();
    expect(ds.properties$.value).toEqual(properties);
    expect(ds.propertyNameGet(propertyId)).toBe('Score');
    expect(ds.propertyTypeGet(propertyId)).toBe('number');

    // What a view or a value does stays allowed.
    property.hideSet(true);
    expect(property.hide$.value).toBe(true);
    view.cellGetOrCreate(rowId, propertyId).valueSet(7);
    expect(ds.cellValueGet(rowId, propertyId)).toBe(7);
    expect(view.rowsLocked$.value).toBe(false);
    expect(view.rowAdd('end')).toBeTruthy();
  });

  test('locked rows refuse a new row, and only that', () => {
    const { picker, policies } = host();
    const { ds, view, propertyId, rowId } = setup(picker);
    policies.s1.value = { propertiesLocked: false, rowsLocked: true };

    expect(view.rowsLocked$.value).toBe(true);
    const rows = [...ds.rows$.value];
    expect(view.rowAdd('end')).toBe('');
    expect(view.rowAdd({ before: true, id: rowId })).toBe('');
    expect(ds.rows$.value).toEqual(rows);

    view.cellGetOrCreate(rowId, propertyId).valueSet(3);
    expect(ds.cellValueGet(rowId, propertyId)).toBe(3);
    expect(view.propertyAdd('end')).toBeTruthy();
    view.rowsDelete([rowId]);
    expect(ds.rows$.value).not.toContain(rowId);
  });

  test('the table refuses a row with a filter, writing no default value', () => {
    const { picker, policies } = host();
    const { ds, v1, view, propertyId } = setup(picker);
    const cellChange = vi.spyOn(ds, 'cellValueChange');
    ds.viewDataUpdate(
      v1,
      () =>
        ({
          filter: {
            type: 'group',
            op: 'and',
            conditions: [
              {
                type: 'filter',
                left: { type: 'ref', name: propertyId },
                function: 'equal',
                args: [{ type: 'literal', value: 5 }],
              },
            ],
          },
        }) as never
    );
    // Unlocked, the filter's default value is written into the new row.
    const added = view.rowAdd('end');
    expect(ds.cellValueGet(added, propertyId)).toBe(5);
    cellChange.mockClear();

    policies.s1.value = { propertiesLocked: false, rowsLocked: true };
    expect(view.rowAdd('end')).toBe('');
    expect(cellChange).not.toHaveBeenCalled();
  });

  test('the views follow the host signal and the source of the current view', () => {
    const { picker, policies } = host();
    const { ds, v2, view } = setup(picker);
    policies.s2.value = { propertiesLocked: true, rowsLocked: true };
    expect(view.rowsLocked$.value).toBe(false);

    policies.s1.value = { propertiesLocked: false, rowsLocked: true };
    expect(view.rowsLocked$.value).toBe(true);
    policies.s1.value = UNLOCKED;
    expect(view.rowsLocked$.value).toBe(false);

    ds.viewManager.setCurrentView(v2);
    expect(ds.rowsLocked$.value).toBe(true);
    expect(ds.propertiesLocked$.value).toBe(true);
  });

  test('a host that throws reads as nothing locked', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const picker: DataSourcePickerService = {
      list: () => signal([]),
      sourcePolicy: () => {
        throw new Error('host failure');
      },
    };
    const { view } = setup(picker);
    expect(view.propertiesLocked$.value).toBe(false);
    expect(view.rowAdd('end')).toBeTruthy();
    expect(error).toHaveBeenCalled();
  });
});
