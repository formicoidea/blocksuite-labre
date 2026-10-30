/**
 * "+ view" of the `core-database` bundle (ADR 0035 §1, §7, §9c, B11; labre
 * ADR-0046 §5): which sources it offers, what it draws, and what a view added
 * on a source stores.
 *
 * What it would have caught:
 * - a source listed twice because one view names it and an older one (no
 *   `sourceId`) reads it as the host's first source;
 * - a source that no longer resolves offered as a place to add a view;
 * - "Create source" drawn without the picker's `createSource` (the host's
 *   kill switch on creating sources, labre ADR-0046 §10);
 * - a view added on another source keeping default data derived from the
 *   current one (a board grouped by a property its source does not have);
 * - an own `sourceId: undefined` key written into the stored view;
 * - the tooling extension no longer registering the menu for the bar;
 * - the inline database (one implicit source) losing its plain presets list;
 * - "+ view" reading another database's sources from the host's picker, or
 *   asking it for a source with no database id;
 * - (ADR 0035 amendment of 2026-10-30) another database's sources offered
 *   without the host's `crossDatabaseViews`, or with it but not labelled
 *   or not by name, or a view added on one without its `databaseId`.
 */
import {
  ExternalDataSourceBase,
  type HostedDataSourceBase,
} from '@labre/affine-database-block';
import type { DatabaseBlockModel } from '@labre/affine-model';
import {
  type AddViewMenuContext,
  AddViewMenuIdentifier,
  type DataViewDataType,
} from '@labre/affine-database-engine';
import { signal } from '@preact/signals-core';
import { describe, expect, test, vi } from 'vitest';

import {
  addViewMenuShape,
  addViewSourcePicker,
  databaseAddViewMenu,
} from '../view-bar/add-view-menu.js';
import { addViewOnSource } from '../view-bar/add-view-on-source.js';
import { existingSources } from '../view-bar/add-view-sources.js';
import { DatabaseEditorToolingViewExtension } from '../view.js';

const schemas: Record<string, { schemaId: string; title: string }> = {
  s1: { schemaId: 'block-s1', title: 'Clients' },
  s2: { schemaId: 'block-s2', title: '' },
};
// The host resolves a view with no `sourceId` to its first source.
const resolve = (sourceId: string | undefined) =>
  schemas[sourceId ?? 's1'] ?? null;

describe('existingSources', () => {
  test('one entry per schema, in the order of the views', () => {
    expect(
      existingSources({ viewSourceIds: ['s2', 's1', 's2'], resolve })
    ).toEqual([
      { sourceId: 's2', schemaId: 'block-s2', title: '' },
      { sourceId: 's1', schemaId: 'block-s1', title: 'Clients' },
    ]);
  });

  test('an older view and a named one on the same schema are one, named', () => {
    expect(
      existingSources({ viewSourceIds: [undefined, 's1'], resolve })
    ).toEqual([{ sourceId: 's1', schemaId: 'block-s1', title: 'Clients' }]);
  });

  test('a source that does not resolve is not offered', () => {
    expect(existingSources({ viewSourceIds: ['gone', 's1'], resolve })).toEqual(
      [{ sourceId: 's1', schemaId: 'block-s1', title: 'Clients' }]
    );
  });

  test("the picker's list comes first, in its order and under its titles", () => {
    expect(
      existingSources({
        viewSourceIds: ['s1', 's2'],
        resolve,
        listed: [
          { id: 's2', title: 'Risks' },
          { id: 's1', title: 'Clients' },
        ],
      })
    ).toEqual([
      { sourceId: 's2', schemaId: 'block-s2', title: 'Risks' },
      { sourceId: 's1', schemaId: 'block-s1', title: 'Clients' },
    ]);
  });

  test('a listed source whose schema is not loaded is still offered', () => {
    // labre recette of 2.3.1: no view reads "Bilan", so it does not resolve.
    expect(
      existingSources({
        viewSourceIds: ['s1'],
        resolve,
        listed: [
          { id: 's1', title: 'Clients' },
          { id: 's9', title: 'Bilan' },
        ],
      }).map(s => [s.sourceId, s.title])
    ).toEqual([
      ['s1', 'Clients'],
      ['s9', 'Bilan'],
    ]);
  });

  test('a source a view reads that the picker does not list comes after', () => {
    expect(
      existingSources({
        // The unnamed view reads s1's schema: it is s1, not one more.
        viewSourceIds: [undefined, 's2'],
        resolve,
        listed: [{ id: 's1', title: 'Clients' }],
      }).map(s => s.sourceId)
    ).toEqual(['s1', 's2']);
  });
});

describe('addViewMenuShape', () => {
  const one = existingSources({ viewSourceIds: ['s1'], resolve });
  const two = existingSources({ viewSourceIds: ['s1', 's2'], resolve });

  test('one source and no way to create one: the presets are the menu', () => {
    expect(addViewMenuShape(one, false)).toEqual({
      kind: 'presets',
      source: one[0],
    });
  });

  test('several sources: the list, nothing to create', () => {
    expect(addViewMenuShape(two, false)).toEqual({
      kind: 'list',
      sources: two,
      create: false,
      importView: false,
    });
  });

  test('createSource given: the list, with its creation, even of one source', () => {
    expect(addViewMenuShape(one, true)).toEqual({
      kind: 'list',
      sources: one,
      create: true,
      importView: false,
    });
  });

  test('the picker imports: the list, with "Import a view", even of one source', () => {
    expect(addViewMenuShape(one, false, true)).toEqual({
      kind: 'list',
      sources: one,
      create: false,
      importView: true,
    });
  });
});

type View = DataViewDataType & { sourceId?: string; groupBy?: string };

/** The parts of a hosted source `addViewOnSource` reads, over plain views. */
function fakeSource(initial: View[]) {
  const views = signal<View[]>(initial);
  const current = signal<string | undefined>(initial[0]?.id);
  const schemaOf = (view: View | undefined) =>
    resolve(view?.sourceId)?.schemaId;
  const currentView = () => views.peek().find(v => v.id === current.peek());
  const dataSource = {
    schema$: {
      peek: () => {
        const id = schemaOf(currentView());
        return id ? { id } : null;
      },
    },
    viewDataUpdate: vi.fn(
      (id: string, update: (view: View) => Partial<View>) => {
        views.value = views
          .peek()
          .map(v => (v.id === id ? { ...v, ...update(v) } : v));
      }
    ),
    viewMetaGet: () => ({
      model: {
        // A board's default groups by a property of the CURRENT source.
        defaultData: () => ({ groupBy: `group-of-${schemaOf(currentView())}` }),
      },
    }),
  };
  let next = 0;
  const context = {
    addView: (type: string) => {
      const id = `new-${next++}`;
      views.value = [
        ...views.peek(),
        {
          id,
          name: 'Board',
          mode: type,
          groupBy: `group-of-${schemaOf(currentView())}`,
        },
      ];
      current.value = id;
      return id;
    },
  } as unknown as AddViewMenuContext;
  return {
    views,
    dataSource: dataSource as unknown as HostedDataSourceBase,
    spy: dataSource.viewDataUpdate,
    context,
  };
}

describe('addViewOnSource', () => {
  test('on the current source: names it and keeps the derived defaults', () => {
    const { views, dataSource, context, spy } = fakeSource([
      { id: 'v1', name: 'All', mode: 'table', sourceId: 's1' },
    ]);
    const id = addViewOnSource(context, dataSource, 'kanban', 's1');
    expect(views.peek().find(v => v.id === id)).toEqual({
      id,
      name: 'Board',
      mode: 'kanban',
      sourceId: 's1',
      groupBy: 'group-of-block-s1',
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('on another source: the defaults are derived again from it', () => {
    const { views, dataSource, context } = fakeSource([
      { id: 'v1', name: 'All', mode: 'table', sourceId: 's1' },
    ]);
    const id = addViewOnSource(context, dataSource, 'kanban', 's2');
    expect(views.peek().find(v => v.id === id)).toMatchObject({
      sourceId: 's2',
      groupBy: 'group-of-block-s2',
    });
  });

  test('on the implicit source: no sourceId key at all', () => {
    const { views, dataSource, context, spy } = fakeSource([
      { id: 'v1', name: 'All', mode: 'table' },
    ]);
    const id = addViewOnSource(context, dataSource, 'table', undefined);
    const added = views.peek().find(v => v.id === id);
    expect(added && 'sourceId' in added).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  test("on another database's source: stores that database with the source", () => {
    const { views, dataSource, context } = fakeSource([
      { id: 'v1', name: 'All', mode: 'table', sourceId: 's1' },
    ]);
    const id = addViewOnSource(
      context,
      dataSource,
      'table',
      's2',
      'existing',
      'db-2'
    );
    expect(views.peek().find(v => v.id === id)).toMatchObject({
      sourceId: 's2',
      databaseId: 'db-2',
    });
    const home = addViewOnSource(context, dataSource, 'table', 's1');
    expect('databaseId' in views.peek().find(v => v.id === home)!).toBe(false);
  });

  test("asks the bar's addView once, saying whether the source is new (B17)", () => {
    const { dataSource, context } = fakeSource([
      { id: 'v1', name: 'All', mode: 'table', sourceId: 's1' },
    ]);
    const addView = vi.spyOn(context, 'addView');
    addViewOnSource(context, dataSource, 'kanban', 's1');
    addViewOnSource(context, dataSource, 'table', 's2', 'new');
    expect(addView.mock.calls).toEqual([
      ['kanban', 'existing'],
      ['table', 'new'],
    ]);
  });
});

describe('the "+ view" menu registration', () => {
  test('the tooling extension registers the menu the views bar reads', () => {
    const registered: { setup: (di: unknown) => void }[] = [];
    const context = {
      scope: 'page',
      register: (ext: unknown) => {
        registered.push(...(Array.isArray(ext) ? ext : [ext]));
        return context;
      },
    };
    new DatabaseEditorToolingViewExtension().setup(context as never);
    const override = vi.fn();
    registered.forEach(ext => ext.setup({ override, addImpl: vi.fn() }));
    expect(override).toHaveBeenCalledWith(
      AddViewMenuIdentifier,
      expect.any(Function)
    );
  });

  test('a source that resolves no sources keeps the presets list', () => {
    class Inline extends ExternalDataSourceBase {
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
      protected getPropertyDataType(): undefined {
        return undefined;
      }
      protected getPropertyMetas(): [] {
        return [];
      }
      cellValueChange(): void {}
      rowAdd(): string {
        return '';
      }
      rowDelete(): void {}
      rowMove(): void {}
      propertyAdd(): undefined {
        return undefined;
      }
      propertyDelete(): void {}
      propertyDuplicate(): undefined {
        return undefined;
      }
      propertyDataSet(): void {}
      propertyMetaGet(): undefined {
        return undefined;
      }
      propertyNameSet(): void {}
      propertyTypeSet(): void {}
      protected getNormalPropertyAndIndex() {
        return undefined;
      }
    }
    const model = {
      props: { views$: signal([]), views: [] },
    } as unknown as DatabaseBlockModel;
    const dataSource = new Inline(model);
    expect(dataSource.resolvesSources).toBe(false);
    const menu = databaseAddViewMenu(() => null);
    expect(
      menu.items({
        std: undefined,
        dataSource,
        viewManager: dataSource.viewManager,
        addView: () => '',
      })
    ).toBeUndefined();
  });
});

describe('addViewSourcePicker', () => {
  const onDatabase = (externalSourceId: string | undefined) =>
    ({ hostModel: { props: { externalSourceId } } }) as HostedDataSourceBase;
  const list = signal([
    { id: 'db-1', title: 'Clients', sources: [{ id: 's1', title: 'A' }] },
    { id: 'db-2', title: 'Other', sources: [{ id: 's9', title: 'Z' }] },
  ]);

  test("lists the sources of the block's own database only", () => {
    const picker = addViewSourcePicker({ list: () => list });
    expect(picker.sources?.(onDatabase('db-1'))).toEqual([
      { id: 's1', title: 'A' },
    ]);
    expect(picker.sources?.(onDatabase(undefined))).toEqual([]);
  });

  test('creates a source in that database, and none without createSource', async () => {
    expect(addViewSourcePicker({ list: () => list }).createSource).toBe(
      undefined
    );
    const createSource = vi.fn(async (databaseId: string) => ({
      id: `${databaseId}-new`,
      title: '',
    }));
    const picker = addViewSourcePicker({ list: () => list, createSource });
    expect(await picker.createSource?.(onDatabase('db-1'))).toBe('db-1-new');
    expect(await picker.createSource?.(onDatabase(undefined))).toBe(undefined);
    expect(createSource).toHaveBeenCalledTimes(1);
  });

  test("lists the other databases' sources only with crossDatabaseViews", () => {
    expect(
      addViewSourcePicker({ list: () => list }).otherSources
    ).toBeUndefined();
    const across = addViewSourcePicker({
      list: () => list,
      crossDatabaseViews: true,
    });
    expect(across.otherSources?.(onDatabase('db-1'))).toEqual([
      {
        sourceId: 's9',
        schemaId: 'db-2:s9',
        title: 'Z',
        databaseId: 'db-2',
        databaseTitle: 'Other',
      },
    ]);
    expect(across.sources?.(onDatabase('db-1'))).toEqual([
      { id: 's1', title: 'A' },
    ]);
  });
});
