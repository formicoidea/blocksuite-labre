import {
  addProperty,
  type DatabaseBlockComponent,
  databaseBlockProperties,
  updateCell,
} from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine-model';
import { Text } from '@labre/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Grouping on every layout inside a real `affine:database` block, in a real
 * editor (ADR 0035 §8, B8; PRD REQ-DB-13 and 16). The unit specs drive the
 * trait over a stand-in source; this one proves each layout of the block
 * draws its visible groups with the real cells and toolbar, lists a stored
 * hidden group at its end, and that showing it writes the stored shape.
 *
 * What it would have caught:
 * - a layout that ignores a stored `groupBy`, or draws a hidden group;
 * - a hidden group listed nowhere, or listed before the groups;
 * - a stored grouped view rewritten by being drawn, or by a fold;
 * - "Show group" writing anything but `groupProperties[].hide`.
 */

const options = [
  { id: 'todo', value: 'Todo', color: 'var(--affine-tag-blue)' },
  { id: 'done', value: 'Done', color: 'var(--affine-tag-green)' },
];

const settle = async () => {
  await wait(100);
  for (let i = 0; i < 4; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

const LAYOUTS = [
  {
    mode: 'table',
    group: 'affine-data-view-table-group',
    ui: 'dv-table-view-ui',
  },
  {
    mode: 'kanban',
    group: 'affine-data-view-kanban-group',
    ui: 'dv-kanban-view-ui',
  },
  {
    mode: 'gallery',
    group: '[data-testid="dv-flat-group"]',
    ui: 'dv-gallery-view-ui',
  },
  {
    mode: 'list',
    group: '[data-testid="dv-flat-group"]',
    ui: 'dv-list-view-ui',
  },
] as const;

describe('database grouping on every layout', () => {
  let model!: DatabaseBlockModel;
  let status!: string;

  const block = () => {
    const element = document.querySelector<DatabaseBlockComponent>(
      `affine-database[data-block-id="${model.id}"]`
    );
    if (!element) throw new Error('the database block is not rendered');
    return element;
  };

  const showView = async (viewId: string) => {
    block().dataSource.viewManager.setCurrentView(viewId);
    await settle();
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('page');
    const doc = window.doc;
    const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
    const databaseId = doc.addBlock(
      'affine:database',
      { columns: [], titleColumn: 'Title' },
      noteId
    );
    model = doc.getModelById(databaseId) as DatabaseBlockModel;
    status = addProperty(
      model,
      'end',
      databaseBlockProperties.selectColumnConfig.create('Status', { options })
    );
    const rowIds = ['Alpha', 'Bravo', 'Charlie'].map(title =>
      doc.addBlock('affine:paragraph', { text: new Text(title) }, databaseId)
    );
    updateCell(model, rowIds[0]!, { columnId: status, value: 'todo' });
    updateCell(model, rowIds[1]!, { columnId: status, value: 'done' });
    const columns = model.props.columns.map(column => ({
      id: column.id,
      hide: false,
      width: 180,
    }));
    const filter = { type: 'group', op: 'and', conditions: [] };
    const groupBy = { type: 'groupBy', columnId: status, name: 'select' };
    const groupProperties = [{ key: 'done', hide: true, manuallyCardSort: [] }];
    doc.updateBlock(model, {
      views: LAYOUTS.map(({ mode }) => ({
        id: `${mode}-1`,
        name: mode,
        mode,
        columns,
        filter,
        groupBy,
        groupProperties,
        header: {},
      })),
    });
    await settle();
    return cleanup;
  });

  test.each(LAYOUTS)(
    'a stored grouped $mode draws its visible groups, the hidden one at its end',
    async ({ mode, group, ui }) => {
      const before = JSON.stringify(model.props.views);
      await showView(`${mode}-1`);
      const view = block().querySelector(ui);
      expect(view, `${mode} is drawn`).not.toBeNull();
      const keys = [...view!.querySelectorAll<HTMLElement>(group)].map(
        element => element.dataset.groupKey ?? element.dataset.key
      );
      expect(keys).toContain('todo');
      expect(keys).not.toContain('done');
      const hidden = view!.querySelector('[data-testid="dv-hidden-groups"]');
      expect(
        hidden
          ?.querySelector('[data-testid="dv-hidden-group"]')
          ?.getAttribute('data-group-key')
      ).toBe('done');
      expect(JSON.stringify(model.props.views)).toBe(before);
    }
  );

  test('"Show group" writes the stored hide, a fold writes nothing', async () => {
    await showView('list-1');
    const before = JSON.stringify(model.props.views);
    block()
      .querySelector<HTMLElement>(
        '[data-group-key="todo"] [data-testid="dv-group-toggle"]'
      )
      ?.click();
    await settle();
    expect(JSON.stringify(model.props.views)).toBe(before);
    block()
      .querySelector<HTMLElement>(
        '[data-testid="dv-hidden-group"] [data-testid="dv-group-show"]'
      )
      ?.click();
    await settle();
    const list = model.props.views.find(view => view.id === 'list-1') as {
      groupProperties?: { key: string; hide?: boolean }[];
    };
    expect(list.groupProperties?.find(g => g.key === 'done')?.hide).toBe(false);
    expect(
      block().querySelector(
        'dv-list-view-ui [data-testid="dv-flat-group"][data-group-key="done"]'
      )
    ).not.toBeNull();
    // Unfold for the next spec: the fold is kept on this device.
    block()
      .querySelector<HTMLElement>(
        '[data-group-key="todo"] [data-testid="dv-group-toggle"]'
      )
      ?.click();
    await settle();
  });
});
