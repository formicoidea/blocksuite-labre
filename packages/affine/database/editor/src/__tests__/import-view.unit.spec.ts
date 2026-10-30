/**
 * The import verb's request and its `add` (ADR 0035 amendment of
 * 2026-10-14, labre PRD REQ-DB-2): the library hands the host where the copy
 * lands and adds it when the host has mapped its properties.
 *
 * What it would have caught:
 * - a copy written with the other database's `id` or `sourceId` (a link, or
 *   two views with one id), or with no `sourceId` on a source that is named;
 * - a copy added on a page that turned read-only while the dialog was open,
 *   or of a layout this database does not add (calendar views are no
 *   longer created, labre P3);
 * - the copy not shown once added, or reported as anything but an import;
 * - a request sent for an inline database, which no picker names;
 * - a template carrying the view's filters or sorts (REQ-DB-4);
 * - (ADR 0035 amendment of 2026-10-30) a request or a template naming the
 *   block's database for a view that reads another one, or the copy of
 *   such a view losing that database.
 */
import { HostedDataSourceBase } from '@labre/affine-database-block';
import type {
  DataSourcePickerImportRequest,
  DataSourcePickerService,
} from '@labre/affine-shared/services';
import { DataViewEventTraceKey } from '@labre/affine-database-engine';
import { signal } from '@preact/signals-core';
import { describe, expect, test, vi } from 'vitest';

import {
  addImportedView,
  currentViewTemplate,
  requestViewImport,
} from '../view-transfer/import-view.js';

function hostedSource(
  opts: { sourceId?: string; readonly?: boolean; databaseId?: string } = {}
) {
  const views: Record<string, unknown>[] = [
    {
      id: 'v-here',
      name: 'Table',
      mode: 'table',
      ...(opts.sourceId ? { sourceId: opts.sourceId } : {}),
      ...(opts.databaseId ? { databaseId: opts.databaseId } : {}),
      columns: [],
      filter: { type: 'group', op: 'and', conditions: [{ type: 'filter' }] },
      sort: { sortBy: [], manuallySort: [] },
    },
  ];
  const trace = vi.fn();
  const current = signal<string | undefined>('v-here');
  const source = Object.assign(
    Object.create(HostedDataSourceBase.prototype) as HostedDataSourceBase,
    {
      _model: { props: { externalSourceId: 'labre-base:b1' } },
      _resolveSource: () => null,
      readonly$: signal(opts.readonly ?? false),
      properties$: signal(['title', 'cost']),
      propertyNameGet: (id: string) => (id === 'title' ? 'Name' : 'Cost'),
      propertyTypeGet: (id: string) => (id === 'title' ? 'title' : 'number'),
      propertyDataGet: () => ({}),
      viewMetas: [{ type: 'table' }, { type: 'kanban' }],
      viewMetaGet: () => ({ model: { defaultName: 'Table' } }),
      viewManager: {
        currentViewId$: current,
        setCurrentView: (id: string) => (current.value = id),
      },
      viewDataGet: (id: string) => views.find(view => view.id === id),
      viewDataAdd: (view: Record<string, unknown>) => {
        views.push(view);
        return view.id;
      },
      serviceGet: (key: unknown) =>
        key === DataViewEventTraceKey ? trace : null,
    }
  );
  return { source, views, trace, current };
}

const theirs = {
  view: {
    id: 'v-there',
    name: 'Costs',
    mode: 'table',
    sourceId: 'their-source',
    columns: [{ id: 'their-cost', width: 120 }],
    filter: { type: 'group', op: 'and', conditions: [] },
  },
  properties: [{ id: 'their-cost', name: 'Cost', type: 'number' }],
  mapping: { 'their-cost': 'cost' },
};

describe('requestViewImport', () => {
  test('hands the host this database, its source, properties and layouts', () => {
    const { source } = hostedSource({ sourceId: 's2' });
    const importView = vi.fn();
    requestViewImport(
      { importView } as unknown as DataSourcePickerService,
      source
    );
    const request = importView.mock
      .calls[0]![0] as DataSourcePickerImportRequest;
    expect(request.databaseId).toBe('labre-base:b1');
    expect(request.sourceId).toBe('s2');
    expect(request.layouts).toEqual(['table', 'kanban']);
    expect(request.properties).toEqual([
      { id: 'title', name: 'Name', type: 'title' },
      { id: 'cost', name: 'Cost', type: 'number' },
    ]);
  });

  test("names the view's database when it reads another one, and the copy keeps it", () => {
    const { source, views } = hostedSource({
      sourceId: 's-team',
      databaseId: 'labre-base:people',
    });
    const importView = vi.fn();
    requestViewImport(
      { importView } as unknown as DataSourcePickerService,
      source
    );
    const request = importView.mock
      .calls[0]![0] as DataSourcePickerImportRequest;
    expect(request.databaseId).toBe('labre-base:people');
    expect(request.sourceId).toBe('s-team');
    const id = request.add(theirs);
    expect(views.find(view => view.id === id)).toMatchObject({
      sourceId: 's-team',
      databaseId: 'labre-base:people',
    });
    expect(currentViewTemplate(source)?.databaseId).toBe('labre-base:people');
  });

  test('sends nothing on a read-only page', () => {
    const { source } = hostedSource({ readonly: true });
    const importView = vi.fn();
    requestViewImport(
      { importView } as unknown as DataSourcePickerService,
      source
    );
    expect(importView).not.toHaveBeenCalled();
  });
});

describe('addImportedView', () => {
  test('adds a copy on this source, shows it and reports an import', () => {
    const { source, views, trace, current } = hostedSource({ sourceId: 's2' });
    const id = addImportedView(source, 's2', theirs);
    expect(id).toBeTruthy();
    expect(id).not.toBe('v-there');
    const added = views.find(view => view.id === id)!;
    expect(added).toMatchObject({
      name: 'Costs',
      mode: 'table',
      sourceId: 's2',
      columns: [{ id: 'cost', width: 120 }],
    });
    expect(current.value).toBe(id);
    expect(trace).toHaveBeenCalledWith('DatabaseViewAdded', {
      viewType: 'table',
      source: 'import',
    });
  });

  test('writes the colour rules remapped, those on an ignored property gone', () => {
    const { source, views } = hostedSource();
    const on = (name: string) => ({
      type: 'group',
      op: 'and',
      conditions: [
        {
          type: 'filter',
          left: { type: 'ref', name },
          function: 'greatThan',
          args: [{ type: 'literal', value: 10 }],
        },
      ],
    });
    const id = addImportedView(source, undefined, {
      ...theirs,
      view: {
        ...theirs.view,
        colorRules: [
          {
            id: 'c1',
            color: 'var(--affine-v2-chip-label-red)',
            filter: on('their-cost'),
          },
          {
            id: 'c2',
            color: 'var(--affine-v2-chip-label-red)',
            filter: on('their-gone'),
          },
        ],
      },
    });
    expect(views.find(view => view.id === id)!.colorRules).toEqual([
      {
        id: 'c1',
        color: 'var(--affine-v2-chip-label-red)',
        filter: on('cost'),
      },
    ]);
  });

  test('stores no sourceId on the implicit source', () => {
    const { source, views } = hostedSource();
    const id = addImportedView(source, undefined, theirs);
    expect('sourceId' in views.find(view => view.id === id)!).toBe(false);
  });

  test('refuses a read-only page and a layout this database does not add', () => {
    expect(
      addImportedView(
        hostedSource({ readonly: true }).source,
        undefined,
        theirs
      )
    ).toBe(null);
    expect(
      addImportedView(hostedSource().source, undefined, {
        ...theirs,
        view: { ...theirs.view, mode: 'calendar' },
      })
    ).toBe(null);
  });
});

describe('currentViewTemplate', () => {
  test('the current view without its filters and sorts, with its colour rules', () => {
    const { source, views } = hostedSource({ sourceId: 's2' });
    const colorRules = [
      {
        id: 'c1',
        color: 'var(--affine-v2-chip-label-red)',
        filter: { type: 'group', op: 'and', conditions: [{ type: 'filter' }] },
      },
    ];
    views[0]!.colorRules = colorRules;
    const template = currentViewTemplate(source)!;
    expect(template.databaseId).toBe('labre-base:b1');
    expect(template.sourceId).toBe('s2');
    expect(template.name).toBe('Table');
    expect(template.view.sort).toBeUndefined();
    expect(template.view.filter).toEqual({
      type: 'group',
      op: 'and',
      conditions: [],
    });
    expect(template.view.colorRules).toEqual(colorRules);
  });
});
