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
 * Conditional colours drawn by a real `affine:database` block, in a real
 * editor and a real browser (ADR 0036, red zone: the stored `colorRules`
 * of a view). The unit specs evaluate the rules over a stand-in source; this
 * one proves the four layouts paint what a stored rule says, with the
 * stylesheets of the real components, so the colour is actually visible.
 *
 * What it would have caught:
 * - a layout that reads no rule, or paints a row the rule does not match;
 * - a colour set on the element but hidden by the component's own
 *   background (the custom property not read by its stylesheet);
 * - a stored coloured view rewritten by being drawn.
 */

// The palette's red, as an option stores it (`selectOptionColors`).
const RED = 'var(--affine-v2-chip-label-red)';

const options = [
  { id: 'todo', value: 'Todo', color: RED },
  { id: 'done', value: 'Done', color: 'var(--affine-v2-chip-label-green)' },
];

const settle = async () => {
  await wait(100);
  for (let i = 0; i < 4; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

const LAYOUTS = [
  { mode: 'table', item: 'data-view-table-row', key: 'rowId' },
  { mode: 'kanban', item: 'affine-data-view-kanban-card', key: 'cardId' },
  { mode: 'gallery', item: '[data-testid="dv-gallery-card"]', key: '' },
  { mode: 'list', item: '[data-testid="dv-list-row"]', key: '' },
] as const;

describe('conditional colours on every layout', () => {
  let model!: DatabaseBlockModel;
  let rowIds: string[] = [];

  const block = () => {
    const element = document.querySelector<DatabaseBlockComponent>(
      `affine-database[data-block-id="${model.id}"]`
    );
    if (!element) throw new Error('the database block is not rendered');
    return element;
  };

  /** What the browser computes for `color` as a background, here. */
  const computed = (color: string) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = color;
    block().append(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
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
    const status = addProperty(
      model,
      'end',
      databaseBlockProperties.selectColumnConfig.create('Status', { options })
    );
    rowIds = ['Alpha', 'Bravo', 'Charlie'].map(title =>
      doc.addBlock('affine:paragraph', { text: new Text(title) }, databaseId)
    );
    updateCell(model, rowIds[0]!, { columnId: status, value: 'todo' });
    updateCell(model, rowIds[1]!, { columnId: status, value: 'done' });
    const columns = model.props.columns.map(column => ({
      id: column.id,
      hide: false,
      width: 180,
    }));
    const colorRules = [
      {
        id: 'rule-todo',
        color: RED,
        filter: {
          type: 'group' as const,
          op: 'and' as const,
          conditions: [
            {
              type: 'filter',
              left: { type: 'ref', name: status },
              function: 'isOneOf',
              args: [{ type: 'literal', value: ['todo'] }],
            },
          ],
        },
      },
    ];
    doc.updateBlock(model, {
      views: LAYOUTS.map(({ mode }) => ({
        id: `${mode}-1`,
        name: mode,
        mode,
        columns,
        filter: { type: 'group', op: 'and', conditions: [] },
        header: {},
        colorRules,
        ...(mode === 'kanban'
          ? {
              groupBy: { type: 'groupBy', columnId: status, name: 'select' },
              groupProperties: [],
            }
          : {}),
      })),
    });
    await settle();
    return cleanup;
  });

  test.each(LAYOUTS)(
    'a $mode paints the row the rule matches, and no other',
    async ({ mode, item, key }) => {
      const before = JSON.stringify(model.props.views);
      block().dataSource.viewManager.setCurrentView(`${mode}-1`);
      await settle();
      const items = [...block().querySelectorAll<HTMLElement>(item)];
      const idOf = (element: HTMLElement) =>
        key
          ? (element as unknown as Record<string, string>)[key]
          : element.dataset.rowId;
      const alpha = items.find(element => idOf(element) === rowIds[0]);
      const bravo = items.find(element => idOf(element) === rowIds[1]);
      expect(alpha, `${mode}: Alpha is drawn`).toBeTruthy();
      expect(bravo, `${mode}: Bravo is drawn`).toBeTruthy();
      const red = computed(RED);
      expect(red).not.toBe('rgba(0, 0, 0, 0)');
      expect(getComputedStyle(alpha!).backgroundColor).toBe(red);
      expect(getComputedStyle(bravo!).backgroundColor).not.toBe(red);
      expect(JSON.stringify(model.props.views)).toBe(before);
    }
  );
});
