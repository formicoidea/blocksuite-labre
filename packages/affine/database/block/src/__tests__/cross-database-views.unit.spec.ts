/**
 * GUARD — a view may read a source of another database (ADR 0035 amendment
 * of 2026-10-30, labre « Base de données v3 »): the view's stored
 * `databaseId`, the host's `crossDatabaseViews`, and the "Database not
 * shared" answer of the resolver.
 *
 * What it would have caught:
 * - a 2.3 document changed by being read (anything written on load, a
 *   `databaseId` key appearing), or a 2.3 host's one-argument resolver no
 *   longer called, or called with anything but the view's `sourceId`;
 * - the resolver asked for the block's database when the view names
 *   another (or the reverse);
 * - a view naming another database resolved by a host that did not opt in
 *   (a host unaware of `databaseId` would look for its `sourceId` in the
 *   block's database);
 * - a throwing resolver breaking the view instead of reading as missing;
 * - an unreadable database read as "Source not found" (or "Connect a
 *   source") rather than as `'unshared'`;
 * - `sourcePolicy`, `deleteView` or the properties panel's request keyed by
 *   the block's database for a view that reads another one;
 * - `reconnectDatabaseView` rewriting the block's `externalSourceId` under
 *   a host that opted in, which moved the block's OTHER views to the picked
 *   database (the bug this amendment fixes).
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
  type DataSourcePickerViewDeletion,
  FeatureFlagService,
} from '@labre/affine-shared/services';
import type { InsertToPosition } from '@labre/affine-shared/utils';
import type {
  PropertyMetaConfig,
  TypeInstance,
} from '@labre/affine-database-engine';
import type { BlockStdScope } from '@labre/std';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { describe, expect, test, vi } from 'vitest';

import {
  HostedDataSourceBase,
  type HostedSource,
  type ResolveHostedSource,
} from '../external-data-source.js';
import { reconnectDatabaseView } from '../linked-view.js';
import { DatabaseDataSourceProvider } from '../service/index.js';
import { databasePropertiesPanelRequest } from '../service/properties-panel.js';

class Hosted extends HostedDataSourceBase {
  protected getRows(): string[] {
    return [];
  }
  protected getProperties(): string[] {
    return [];
  }
  protected getCellValue(): unknown {
    return undefined;
  }
  protected getPropertyType(): string | undefined {
    return undefined;
  }
  protected getPropertyName(): string {
    return '';
  }
  protected getPropertyData(): Record<string, unknown> {
    return {};
  }
  protected getPropertyDataType(): TypeInstance | undefined {
    return undefined;
  }
  protected getPropertyMetas(): PropertyMetaConfig[] {
    return [];
  }
  cellValueChange(): void {}
  rowAdd(_pos: InsertToPosition | number): string {
    return '';
  }
  rowDelete(): void {}
  rowMove(): void {}
  propertyAdd(): string | undefined {
    return undefined;
  }
  propertyDelete(): void {}
  propertyDuplicate(): string | undefined {
    return undefined;
  }
  propertyDataSet(): void {}
  propertyMetaGet(): PropertyMetaConfig | undefined {
    return undefined;
  }
  propertyNameSet(): void {}
  propertyTypeSet(): void {}
  protected getNormalPropertyAndIndex() {
    return undefined;
  }
}

/** Views as a 2.3 client stores them, plus one reading another database. */
const STORED_23 = [
  { id: 'v-1', name: 'Plan', mode: 'table', sourceId: 's-plan' },
  { id: 'v-2', name: 'Old', mode: 'table' },
];
const FOREIGN = {
  id: 'v-3',
  name: 'Team',
  mode: 'table',
  sourceId: 's-team',
  databaseId: 'host:people',
};

function database(views: unknown[]): {
  store: Store;
  model: DatabaseBlockModel;
} {
  const collection = new TestWorkspace({ id: 'cross-database-views' });
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
  const id = store.addBlock(
    'affine:database',
    {
      title: new Text('Plan'),
      externalSourceId: 'host:plan',
      views,
    } as never,
    noteId
  );
  return { store, model: store.getModelById(id) as DatabaseBlockModel };
}

/** A schema per (database, source); a resolver of two arguments. */
function schemas(model: DatabaseBlockModel) {
  const source = (): HostedSource => ({ schema: model, rows: signal([]) });
  const known: Record<string, HostedSource> = {
    'host:plan/s-plan': source(),
    'host:plan/undefined': source(),
    'host:people/s-team': source(),
  };
  return vi.fn<ResolveHostedSource>(
    (sourceId, databaseId) => known[`${databaseId}/${sourceId}`] ?? null
  );
}

function build(
  model: DatabaseBlockModel,
  resolve: ResolveHostedSource,
  picker: DataSourcePickerService | null
) {
  const hosted = new Hosted(model, resolve);
  if (picker) hosted.serviceSet(DataSourcePickerProvider, picker);
  return hosted;
}

const optedIn = (
  extra: Partial<DataSourcePickerService> = {}
): DataSourcePickerService => ({
  list: () => signal([]),
  crossDatabaseViews: true,
  ...extra,
});

describe('reading a 2.3 document', () => {
  test('nothing is written, no databaseId appears, deep-equal after reading', () => {
    const { store, model } = database(STORED_23);
    const before = JSON.parse(JSON.stringify(model.props.views));
    const updated = vi.fn();
    const subscription = store.slots.blockUpdated.subscribe(updated);
    const hosted = build(model, schemas(model), optedIn());
    for (const view of ['v-1', 'v-2']) {
      hosted.viewManager.setCurrentView(view);
      expect(hosted.sourceMissing$.value).toBe(false);
      expect(hosted.currentDatabaseId$.value).toBe('host:plan');
    }
    subscription.unsubscribe();
    expect(updated).not.toHaveBeenCalled();
    expect(JSON.parse(JSON.stringify(model.props.views))).toEqual(before);
    expect(model.props.views.some(view => 'databaseId' in view)).toBe(false);
  });

  test("a one-argument resolver keeps reading the block's database", () => {
    const { model } = database(STORED_23);
    const legacy = vi.fn((sourceId: string | undefined) =>
      sourceId === 's-plan' ? { schema: model, rows: signal(['r']) } : null
    );
    const hosted = build(model, legacy, null);
    expect(hosted.rows$.value).toEqual(['r']);
    expect(legacy).toHaveBeenLastCalledWith('s-plan', 'host:plan');
  });
});

describe('a view of another database', () => {
  test("the resolver receives the view's database, else the block's", () => {
    const { model } = database([...STORED_23, FOREIGN]);
    const resolve = schemas(model);
    const hosted = build(model, resolve, optedIn());
    hosted.viewManager.setCurrentView('v-3');
    expect(hosted.sourceMissing$.value).toBe(false);
    expect(hosted.currentDatabaseId$.value).toBe('host:people');
    expect(resolve).toHaveBeenLastCalledWith('s-team', 'host:people');
    hosted.viewManager.setCurrentView('v-2');
    expect(hosted.sourceMissing$.value).toBe(false);
    expect(resolve).toHaveBeenLastCalledWith(undefined, 'host:plan');
    expect(hosted.sourceOf('s-team', 'host:people')).not.toBeNull();
    expect(hosted.sourceOf('s-team')).toBeNull();
  });

  test('a host that did not opt in is never asked: the view reads as missing', () => {
    const { model } = database([FOREIGN]);
    for (const picker of [null, { list: () => signal([]) }]) {
      const resolve = schemas(model);
      const hosted = build(model, resolve, picker);
      expect(hosted.sourceMissing$.value).toBe(true);
      expect(hosted.sourceUnavailable$.value).toBeNull();
      expect(resolve).not.toHaveBeenCalled();
    }
  });

  test('a throwing resolver reads as missing and is logged', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { model } = database([FOREIGN]);
    const hosted = build(
      model,
      () => {
        throw new Error('host failure');
      },
      optedIn()
    );
    expect(hosted.sourceMissing$.value).toBe(true);
    expect(hosted.sourceOf('s-team', 'host:people')).toBeNull();
    expect(error).toHaveBeenCalled();
  });

  test("an unreadable database is 'unshared', never a missing source", () => {
    const { model } = database([FOREIGN]);
    const hosted = build(model, () => ({ unavailable: 'unshared' }), optedIn());
    expect(hosted.sourceUnavailable$.value).toBe('unshared');
    expect(hosted.sourceMissing$.value).toBe(true);
    expect(hosted.source$.value).toBeNull();
    expect(hosted.rows$.value).toEqual([]);
  });

  test("sourcePolicy is asked for the view's database", () => {
    const { model } = database([...STORED_23, FOREIGN]);
    const asked = vi.fn();
    const locked: DataSourcePickerSourcePolicy = {
      propertiesLocked: true,
      rowsLocked: true,
    };
    const hosted = build(
      model,
      schemas(model),
      optedIn({
        sourcePolicy: (databaseId, sourceId) => {
          asked(databaseId, sourceId);
          return signal(
            databaseId === 'host:people'
              ? locked
              : { propertiesLocked: false, rowsLocked: false }
          );
        },
      })
    );
    expect(hosted.rowsLocked$.value).toBe(false);
    expect(asked).toHaveBeenLastCalledWith('host:plan', 's-plan');
    hosted.viewManager.setCurrentView('v-3');
    expect(hosted.rowsLocked$.value).toBe(true);
    expect(asked).toHaveBeenLastCalledWith('host:people', 's-team');
  });

  test("deleteView names the view's database", () => {
    const { model } = database([...STORED_23, FOREIGN]);
    const requests: DataSourcePickerViewDeletion[] = [];
    const hosted = build(
      model,
      schemas(model),
      optedIn({ deleteView: request => requests.push(request) })
    );
    hosted.viewDataDelete('v-3');
    hosted.viewDataDelete('v-1');
    expect(requests.map(r => [r.viewId, r.databaseId])).toEqual([
      ['v-3', 'host:people'],
      ['v-1', 'host:plan'],
    ]);
  });

  test("the properties panel's request names another database only", () => {
    const { model } = database([...STORED_23, FOREIGN]);
    expect(databasePropertiesPanelRequest(model, 'v-3')).toMatchObject({
      sourceId: 's-team',
      databaseId: 'host:people',
    });
    expect('databaseId' in databasePropertiesPanelRequest(model, 'v-1')).toBe(
      false
    );
  });
});

describe('reconnectDatabaseView across databases', () => {
  function stdWith(store: Store, picker: DataSourcePickerService) {
    const provider: DatabaseDataSourceProvider = {
      createDataSource: (model, init) => {
        const hosted = new Hosted(model, schemas(model));
        init?.(hosted);
        return hosted;
      },
    };
    return {
      store,
      getOptional: (id: unknown) =>
        id === DataSourcePickerProvider
          ? picker
          : id === DatabaseDataSourceProvider
            ? provider
            : null,
    } as unknown as BlockStdScope;
  }
  const choice = {
    database: { id: 'host:people' },
    sourceId: 's-team',
    viewId: 'v-1',
  };

  test('opted in: only the view names the picked database, the rest untouched', () => {
    const { store, model } = database(STORED_23);
    const other = JSON.stringify(model.props.views[1]);
    store.captureSync();
    expect(
      reconnectDatabaseView(stdWith(store, optedIn()), model, choice)
    ).toBe(true);
    expect(model.props.externalSourceId).toBe('host:plan');
    expect(model.props.views[0]).toMatchObject({
      id: 'v-1',
      name: 'Plan',
      sourceId: 's-team',
      databaseId: 'host:people',
    });
    expect(JSON.stringify(model.props.views[1])).toBe(other);
    store.undo();
    expect(model.props.views[0]).toEqual(STORED_23[0]);
  });

  test("picking the block's own database clears the view's databaseId", () => {
    const { store, model } = database([FOREIGN, ...STORED_23]);
    reconnectDatabaseView(stdWith(store, optedIn()), model, {
      database: { id: 'host:plan' },
      sourceId: 's-plan',
      viewId: 'v-3',
    });
    expect(model.props.views[0]?.sourceId).toBe('s-plan');
    expect('databaseId' in model.props.views[0]!).toBe(false);
  });

  test('a block with this one view moves to the picked database', () => {
    const { store, model } = database([STORED_23[0]]);
    reconnectDatabaseView(stdWith(store, optedIn()), model, choice);
    expect(model.props.externalSourceId).toBe('host:people');
    expect(model.props.views[0]?.sourceId).toBe('s-team');
    expect('databaseId' in model.props.views[0]!).toBe(false);
  });

  test('without the opt-in the block moves, as in 2.3', () => {
    const { store, model } = database(STORED_23);
    reconnectDatabaseView(
      stdWith(store, { list: () => signal([]) }),
      model,
      choice
    );
    expect(model.props.externalSourceId).toBe('host:people');
    expect('databaseId' in model.props.views[0]!).toBe(false);
  });
});
