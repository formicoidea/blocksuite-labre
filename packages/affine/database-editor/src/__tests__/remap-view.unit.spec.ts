/**
 * Importing a view of another database (ADR 0035 amendment of 2026-10-14,
 * labre PRD REQ-DB-2): the copy reads this database's properties, never the
 * other's, and loses what pointed at an ignored property.
 *
 * What it would have caught:
 * - a copied filter, sort, grouping or column still naming the other
 *   database's property id: the view would filter on nothing, or the data
 *   view would draw a column with no property;
 * - a select condition keeping the other database's option ids, which no
 *   option here has (the condition would match nothing, silently);
 * - a manual row order or a group's card order naming the other database's
 *   rows;
 * - the counts the host's dialog shows ("2 filters removed") not matching
 *   what the copy lost;
 * - a template keeping the filters and sorts REQ-DB-4 leaves to one view.
 */
import type { DataSourcePickerProperty } from '@labre/affine-shared/services';
import { describe, expect, test } from 'vitest';

import {
  defaultMapping,
  remapView,
  viewTemplateData,
} from '../view-transfer/remap-view.js';

const from: DataSourcePickerProperty[] = [
  { id: 'title', name: 'Name', type: 'title' },
  {
    id: 's-status',
    name: 'Status',
    type: 'select',
    options: [
      { id: 'o-todo', value: 'To do' },
      { id: 'o-done', value: 'Done' },
      { id: 'o-lost', value: 'Lost' },
    ],
  },
  { id: 's-cost', name: 'Cost', type: 'number' },
  { id: 's-owner', name: 'Owner', type: 'text' },
];

const to: DataSourcePickerProperty[] = [
  { id: 'title', name: 'Title', type: 'title' },
  {
    id: 't-state',
    name: 'State',
    type: 'select',
    options: [
      { id: 'x-done', value: 'Done' },
      { id: 'x-todo', value: 'To do' },
    ],
  },
  { id: 't-cost', name: 'cost ', type: 'number' },
];

const condition = (name: string, value: unknown) => ({
  type: 'filter',
  left: { type: 'ref', name },
  function: 'is',
  args: [{ type: 'literal', value }],
});

const stored = {
  id: 'v-1',
  name: 'Board',
  mode: 'kanban',
  sourceId: 'their-source',
  openIn: 'center',
  columns: [
    { id: 'title', hide: false },
    { id: 's-status', hide: false },
    { id: 's-owner', hide: true },
    { id: 's-cost', hide: false },
  ],
  filter: {
    type: 'group',
    op: 'and',
    conditions: [
      condition('s-status', ['o-todo', 'o-lost']),
      condition('s-status', 'o-lost'),
      condition('s-owner', 'Ana'),
      {
        type: 'group',
        op: 'or',
        conditions: [condition('s-owner', 'Bo')],
      },
      condition('s-cost', 3),
    ],
  },
  sort: {
    sortBy: [
      { ref: { type: 'ref', name: 's-owner' }, desc: false },
      { ref: { type: 'ref', name: 's-cost' }, desc: true },
    ],
    manuallySort: ['their-row-1'],
  },
  groupBy: { type: 'groupBy', columnId: 's-status', name: 'select' },
  groupProperties: [
    { key: 'o-done', hide: true, manuallyCardSort: ['their-row-2'] },
  ],
  header: { titleColumn: 'title', iconColumn: 'type', coverColumn: 's-owner' },
};

const mapping = {
  title: 'title',
  's-status': 't-state',
  's-cost': 't-cost',
  's-owner': null,
};

describe('remapView', () => {
  const { data, dropped } = remapView(stored, from, to, mapping);

  test('leaves id, name and sourceId to the caller and keeps the rest', () => {
    expect(data.id).toBeUndefined();
    expect(data.name).toBeUndefined();
    expect(data.sourceId).toBeUndefined();
    expect(data.mode).toBe('kanban');
    expect(data.openIn).toBe('center');
  });

  test('renames the columns and drops the ignored ones', () => {
    expect(data.columns).toEqual([
      { id: 'title', hide: false },
      { id: 't-state', hide: false },
      { id: 't-cost', hide: false },
    ]);
    expect(dropped.properties).toBe(1);
  });

  test('keeps select conditions by option name, drops the rest', () => {
    const filter = data.filter as { conditions: unknown[] };
    expect(filter.conditions).toEqual([
      condition('t-state', ['x-todo']),
      condition('t-cost', 3),
    ]);
    // `o-lost` alone, Ana, and Bo (its group then left empty).
    expect(dropped.filters).toBe(3);
  });

  test('renames the sort, drops ignored keys and the manual order', () => {
    expect(data.sort).toEqual({
      sortBy: [{ ref: { type: 'ref', name: 't-cost' }, desc: true }],
      manuallySort: [],
    });
    expect(dropped.sorts).toBe(1);
  });

  test('regroups by the mapped property, its group settings reset', () => {
    expect(data.groupBy).toEqual({
      type: 'groupBy',
      columnId: 't-state',
      name: 'select',
    });
    expect(data.groupProperties).toBeUndefined();
    expect(dropped.group).toBe(false);
  });

  test('renames header properties, drops ignored ones, keeps pseudo columns', () => {
    expect(data.header).toEqual({ titleColumn: 'title', iconColumn: 'type' });
  });

  test('a grouping by an ignored property is undone and counted', () => {
    const result = remapView(stored, from, to, {
      ...mapping,
      's-status': null,
    });
    expect(result.data.groupBy).toBeUndefined();
    expect(result.data.groupProperties).toBeUndefined();
    expect(result.dropped.group).toBe(true);
  });

  test('a property that keeps its id keeps its groups, never their row order', () => {
    const same = remapView(stored, from, [...to, from[1]!], {
      ...mapping,
      's-status': 's-status',
    });
    expect(same.data.groupProperties).toEqual([
      { key: 'o-done', hide: true, manuallyCardSort: [] },
    ]);
  });

  test('a mapping onto a property this database lacks counts as ignored', () => {
    const result = remapView(stored, from, to, {
      ...mapping,
      's-cost': 'gone',
    });
    expect(result.dropped.sorts).toBe(2);
    expect(
      (result.data.columns as { id: string }[]).map(column => column.id)
    ).toEqual(['title', 't-state']);
  });

  test('never touches the stored view it reads', () => {
    expect(stored.columns).toHaveLength(4);
    expect(stored.sort.manuallySort).toEqual(['their-row-1']);
  });
});

describe('defaultMapping', () => {
  test('same id, else same name and type, else ignored', () => {
    expect(defaultMapping(from, to)).toEqual({
      title: 'title',
      's-status': null,
      's-cost': 't-cost',
      's-owner': null,
    });
  });

  test('never proposes one property twice', () => {
    const twice = defaultMapping(
      [
        { id: 'a', name: 'Cost', type: 'number' },
        { id: 'b', name: 'cost', type: 'number' },
      ],
      [{ id: 'c', name: 'Cost', type: 'number' }]
    );
    expect(twice).toEqual({ a: 'c', b: null });
  });
});

describe('viewTemplateData', () => {
  test('keeps layout, open in, columns and grouping, never filters or sorts', () => {
    const template = viewTemplateData(stored);
    expect(template.id).toBeUndefined();
    expect(template.sourceId).toBeUndefined();
    expect(template.sort).toBeUndefined();
    expect(template.filter).toEqual({
      type: 'group',
      op: 'and',
      conditions: [],
    });
    expect(template.groupBy).toEqual(stored.groupBy);
    expect(template.groupProperties).toEqual([
      { key: 'o-done', hide: true, manuallyCardSort: [] },
    ]);
    expect(template.openIn).toBe('center');
    expect(template.columns).toEqual(stored.columns);
  });
});
