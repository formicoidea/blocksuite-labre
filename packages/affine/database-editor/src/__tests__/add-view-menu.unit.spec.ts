/**
 * "+ view" of the `core-database` bundle (ADR 0035 §1, §7, §9c, B11; labre
 * ADR-0046 §5): which sources it offers, what it draws, and what a view added
 * on a source stores.
 *
 * What it would have caught:
 * - a source listed twice because one view names it and an older one (no
 *   `sourceId`) reads it as the host's first source;
 * - a source that no longer resolves offered as a place to add a view;
 * - "With a new source" drawn without the picker's `createSource` (the
 *   host's kill switch on creating sources, labre ADR-0046 §10);
 * - a view added on another source keeping default data derived from the
 *   current one (a board grouped by a property its source does not have);
 * - an own `sourceId: undefined` key written into the stored view;
 * - the tooling extension no longer registering the menu for the bar;
 * - the inline database (one implicit source) losing its plain presets list.
 */
import {
  ExternalDataSourceBase,
  type HostedDataSourceBase,
} from '@labre/affine-block-database';
import type { DatabaseBlockModel } from '@labre/affine-model';
import {
  type AddViewMenuContext,
  AddViewMenuIdentifier,
  type DataViewDataType,
} from '@labre/data-view';
import { signal } from '@preact/signals-core';
import { describe, expect, test, vi } from 'vitest';

import {
  addViewMenuShape,
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

  test("the picker's sources no view reads come after, deduplicated", () => {
    expect(
      existingSources({
        viewSourceIds: ['s1'],
        resolve,
        extraSourceIds: ['s1', 's2'],
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

  test('several sources: "On an existing source", no "With a new source"', () => {
    expect(addViewMenuShape(two, false)).toEqual({
      kind: 'entries',
      existing: two,
      newSource: false,
    });
  });

  test('createSource given: "With a new source" even beside one source', () => {
    expect(addViewMenuShape(one, true)).toEqual({
      kind: 'entries',
      existing: one,
      newSource: true,
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
    registered.forEach(ext => ext.setup({ override }));
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
