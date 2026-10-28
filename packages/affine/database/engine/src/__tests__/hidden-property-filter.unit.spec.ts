import { describe, expect, it } from 'vitest';

import type { FilterGroup } from '../core/filter/types.js';
import { KanbanSingleView } from '../view-presets/kanban/kanban-view-manager.js';
import { TableSingleView } from '../view-presets/table/table-view-manager.js';

const filter: FilterGroup = {
  type: 'group',
  op: 'and',
  conditions: [
    {
      type: 'filter',
      left: {
        type: 'ref',
        name: 'status',
      },
      function: 'is',
      args: [{ type: 'literal', value: 'Done' }],
    },
  ],
};

const titleProperty = {
  id: 'title',
  cellGetOrCreate: () => ({
    jsonValue$: {
      value: 'Task 1',
    },
  }),
};

const statusProperty = (value: string) => ({
  id: 'status',
  cellGetOrCreate: () => ({
    jsonValue$: {
      value,
    },
  }),
});

/** `status` is filtered on but hidden from the view. */
const createView = (statusValue: string) => {
  const status = statusProperty(statusValue);
  return {
    filter$: { value: filter },
    properties$: { value: [titleProperty] },
    propertiesRaw$: { value: [titleProperty, status] },
  };
};

describe('filtering on a hidden property', () => {
  it('table keeps evaluating a filter whose column is hidden', () => {
    const view = createView('Done') as unknown as TableSingleView;
    expect(TableSingleView.prototype.isShow.call(view, 'row-1')).toBe(true);
  });

  it('table hides a row that fails a hidden column filter', () => {
    const view = createView('In Progress') as unknown as TableSingleView;
    expect(TableSingleView.prototype.isShow.call(view, 'row-1')).toBe(false);
  });

  it('kanban keeps evaluating a filter whose column is hidden', () => {
    const view = createView('Done') as unknown as KanbanSingleView;
    expect(KanbanSingleView.prototype.isShow.call(view, 'row-1')).toBe(true);
  });

  it('kanban hides a card that fails a hidden column filter', () => {
    const view = createView('In Progress') as unknown as KanbanSingleView;
    expect(KanbanSingleView.prototype.isShow.call(view, 'row-1')).toBe(false);
  });
});
