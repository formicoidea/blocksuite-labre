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

  test('leaves id, name, sourceId and databaseId to the caller and keeps the rest', () => {
    // A view of another database (ADR 0035 amendment of 2026-10-30): the
    // copy names the source it reads where it lands, never the original's.
    const foreign = remapView(
      { ...stored, databaseId: 'host:people' },
      from,
      to,
      mapping
    ).data;
    expect('databaseId' in foreign).toBe(false);
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
    expect(
      'databaseId' in viewTemplateData({ ...stored, databaseId: 'host:x' })
    ).toBe(false);
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

/**
 * Conditional colours (ADR 0036): a template carries them (REQ-DB-4), an
 * import rewrites them through the mapping, and a rule that loses any
 * condition is removed whole and counted apart from the filter's losses,
 * so the host's dialog can say "1 colour rule removed".
 */
describe('colour rules', () => {
  const red = 'var(--affine-v2-chip-label-red)';
  const coloured = {
    ...stored,
    filter: { type: 'group', op: 'and', conditions: [] },
    colorRules: [
      {
        id: 'r-done',
        color: red,
        filter: {
          type: 'group',
          op: 'and',
          conditions: [condition('s-status', ['o-done'])],
        },
      },
      {
        id: 'r-owner',
        color: red,
        filter: {
          type: 'group',
          op: 'and',
          conditions: [condition('s-cost', 3), condition('s-owner', 'Ana')],
        },
      },
      {
        id: 'r-lost',
        color: red,
        filter: {
          type: 'group',
          op: 'or',
          conditions: [condition('s-status', 'o-lost')],
        },
      },
    ],
  };

  test('are rewritten through the mapping, options by name', () => {
    const { data, dropped } = remapView(coloured, from, to, mapping);
    expect(data.colorRules).toEqual([
      {
        id: 'r-done',
        color: red,
        filter: {
          type: 'group',
          op: 'and',
          conditions: [condition('t-state', ['x-done'])],
        },
      },
    ]);
    // A rule on an ignored property, a rule on an option this database
    // lacks: both removed whole, neither counted as a filter.
    expect(dropped.colorRules).toBe(2);
    expect(dropped.filters).toBe(0);
  });

  test('a view without rules gains none, and counts none', () => {
    const { data, dropped } = remapView(stored, from, to, mapping);
    expect('colorRules' in data).toBe(false);
    expect(dropped.colorRules).toBe(0);
  });

  test('a template keeps them, conditions included', () => {
    const template = viewTemplateData(coloured);
    expect(template.colorRules).toEqual(coloured.colorRules);
    expect(template.filter).toEqual({
      type: 'group',
      op: 'and',
      conditions: [],
    });
  });
});

/**
 * A host may hand the store's live view, a reactive `Proxy` over the
 * block's props: `structuredClone` refused it with a `DataCloneError` and
 * the import crashed in labre. Any JSON-shaped input must work.
 */
describe('a live (proxied) view', () => {
  // The structured clone algorithm refuses every `Proxy`, as it refuses
  // the store's; a `get` trap stands for its reactive reads.
  const live = <T extends object>(data: T): T =>
    new Proxy(data, { get: (target, key) => Reflect.get(target, key) });
  const proxied = live({
    ...stored,
    columns: stored.columns.map(column => live(column)),
  });

  test('the stand-in is refused by structuredClone, as the store proxy is', () => {
    expect(() => structuredClone(proxied)).toThrow();
  });

  test('remapView copies it and remaps as the plain view', () => {
    const fromPlain = remapView(stored, from, to, mapping);
    const fromLive = remapView(proxied, from, to, mapping);
    expect(fromLive).toEqual(fromPlain);
    expect(fromLive.data.columns).not.toBe(proxied.columns);
  });

  test('viewTemplateData copies it as the plain view', () => {
    expect(viewTemplateData(proxied)).toEqual(viewTemplateData(stored));
  });
});
