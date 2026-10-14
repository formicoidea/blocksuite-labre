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
 * The gallery and list views inside a real `affine:database` block, in a real
 * editor (ADR 0035 §1 and §8, issues B6 and B7). The unit specs mount the
 * presets over a stand-in source; this one proves the block registers them,
 * gives them the table's toolbar, and that a stored view renders with the
 * table's own cells and popups, in the browser.
 *
 * What it would have caught:
 * - a stored `gallery` or `list` view the block cannot draw (no preset, or a
 *   preset that throws once real cells, rich text and the toolbar mount);
 * - a stored view rewritten by being drawn (`props.views` must not move);
 * - a value drawn by anything but the table's cell, or a click on it that
 *   opens the row instead of the table's tag menu;
 * - "New page" not adding a row to the block, or not opening it.
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

describe('database gallery and list views', () => {
  let model!: DatabaseBlockModel;
  let status!: string;
  let notes!: string;
  let rowIds!: string[];

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
    notes = addProperty(
      model,
      'end',
      databaseBlockProperties.richTextColumnConfig.create('Notes')
    );
    rowIds = ['Alpha', 'Bravo', 'Charlie'].map(title =>
      doc.addBlock('affine:paragraph', { text: new Text(title) }, databaseId)
    );
    updateCell(model, rowIds[0]!, { columnId: status, value: 'todo' });
    updateCell(model, rowIds[1]!, { columnId: status, value: 'done' });
    const columns = model.props.columns.map(column => ({
      id: column.id,
      hide: false,
    }));
    const filter = { type: 'group', op: 'and', conditions: [] };
    doc.updateBlock(model, {
      views: [
        { id: 'gallery-1', name: 'Gallery', mode: 'gallery', columns, filter },
        { id: 'list-1', name: 'List', mode: 'list', columns, filter },
      ],
    });
    await settle();
    return () => {
      // The suite shares one page: a tag menu or a row panel left open is a
      // full-page layer that swallows the next spec's clicks.
      for (const layer of document.querySelectorAll(
        'body > [data-range-sync-exclude]'
      )) {
        if (layer.querySelector('center-peek, affine-multi-tag-select')) {
          layer.remove();
        }
      }
      cleanup();
    };
  });

  test('a stored gallery draws its cards with the table cells, writing nothing', async () => {
    const before = JSON.stringify(model.props.views);
    await showView('gallery-1');
    const gallery = block().querySelector('dv-gallery-view-ui');
    expect(gallery).not.toBeNull();
    const cards = gallery!.querySelectorAll<HTMLElement>(
      '[data-testid="dv-gallery-card"]'
    );
    expect([...cards].map(card => card.dataset.rowId)).toEqual(rowIds);
    expect(cards[0]?.textContent).toContain('Alpha');
    expect(
      cards[0]?.querySelector('affine-database-select-cell')?.textContent
    ).toContain('Todo');
    expect(
      cards[0]?.querySelector(`[data-property-id="${notes}"]`)
    ).not.toBeNull();
    // The table's toolbar: filter, sort and view options reach this view.
    expect(
      block().querySelector('data-view-header-tools-view-options')
    ).not.toBeNull();
    expect(JSON.stringify(model.props.views)).toBe(before);
  });

  test('a stored list draws one line per row, its values as chips', async () => {
    const before = JSON.stringify(model.props.views);
    await showView('list-1');
    const list = block().querySelector('dv-list-view-ui');
    expect(list).not.toBeNull();
    const rows = list!.querySelectorAll<HTMLElement>(
      '[data-testid="dv-list-row"]'
    );
    expect(rows).toHaveLength(3);
    const chips = rows[0]?.querySelector('.dv-list-row-properties');
    expect(chips?.textContent).toContain('Todo');
    // Charlie has no value: no chip at all.
    expect(rows[2]?.querySelector('.dv-list-row-properties')).toBeNull();
    // Title left, chips right.
    const title = rows[0]?.querySelector('.dv-list-row-title');
    expect(title!.getBoundingClientRect().left).toBeLessThan(
      chips!.getBoundingClientRect().left
    );
    expect(JSON.stringify(model.props.views)).toBe(before);
  });

  test('a click on a value opens the table tag menu', async () => {
    await showView('gallery-1');
    const cell = block().querySelector<HTMLElement>(
      `[data-row-id="${rowIds[0]}"] [data-property-id="${status}"]`
    );
    cell?.click();
    await settle();
    expect(document.querySelector('affine-multi-tag-select')).not.toBeNull();
    (cell as unknown as { exit(): void } | null)?.exit();
    await settle();
  });

  test('"New page" adds a row to the block and opens it', async () => {
    await showView('list-1');
    block()
      .querySelector<HTMLElement>('dv-list-view-ui [data-testid="dv-flat-new"]')
      ?.click();
    await settle();
    expect(model.children).toHaveLength(4);
    expect(
      block().querySelectorAll('dv-list-view-ui [data-testid="dv-list-row"]')
    ).toHaveLength(4);
    expect(document.querySelector('center-peek')).not.toBeNull();
  });
});
