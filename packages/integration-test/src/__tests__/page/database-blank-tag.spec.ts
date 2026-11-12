import {
  addProperty,
  type DatabaseBlockComponent,
  databaseBlockProperties,
  updateCell,
} from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine-model';
import { Text } from '@labre/store';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * A select option whose name is empty or blank, drawn in a real
 * `affine:database` block (issue #657, ported from toeverything/AFFiNE#15807).
 *
 * The name is the pill's only content: an option named `''` or `'   '` drew
 * an empty pill. In a kanban grouped by that column the group title then had
 * no height at all, so nothing could be clicked to rename it, the one way to
 * give the option a name back; in a table cell the tag was invisible.
 *
 * What it would have caught:
 * - a blank option drawn without the fallback label (`com.labre.data-view.tag.untitled`,
 *   "Untitled") in the kanban group title or in a table cell;
 * - the kanban group title collapsing to zero height, or a click at its
 *   centre landing elsewhere than on the title, so no rename menu opens;
 * - the rename menu losing the stored name (its input starts from the
 *   stored `''`, the label is only its placeholder);
 * - the fallback written into the document: the stored names stay `''` and
 *   `'   '`, whatever is drawn.
 */

const options = [
  { id: 'empty', value: '', color: 'var(--affine-tag-blue)' },
  { id: 'blank', value: '   ', color: 'var(--affine-tag-green)' },
];

const SETTLE_MS = 100;
const SETTLE_FRAMES = 4;
const COLUMN_WIDTH = 180;

// The same settle as the other database specs of this suite.
const settle = async () => {
  await wait(SETTLE_MS);
  for (let i = 0; i < SETTLE_FRAMES; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

const centreOf = (element: Element) => {
  const box = element.getBoundingClientRect();
  return [box.left + box.width / 2, box.top + box.height / 2] as const;
};

describe('a select option with a blank name', () => {
  let model!: DatabaseBlockModel;
  let status!: string;

  const block = () => {
    const element = document.querySelector<DatabaseBlockComponent>(
      `affine-database[data-block-id="${model.id}"]`
    );
    if (!element) throw new Error('the database block is not rendered');
    return element;
  };

  const storedNames = () =>
    (
      model.props.columns.find(column => column.id === status)?.data as {
        options: { value: string }[];
      }
    ).options.map(option => option.value);

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
    const rowIds = ['Alpha', 'Bravo'].map(title =>
      doc.addBlock('affine:paragraph', { text: new Text(title) }, databaseId)
    );
    updateCell(model, rowIds[0]!, { columnId: status, value: 'empty' });
    updateCell(model, rowIds[1]!, { columnId: status, value: 'blank' });
    const columns = model.props.columns.map(column => ({
      id: column.id,
      hide: false,
      width: COLUMN_WIDTH,
    }));
    const filter = { type: 'group', op: 'and', conditions: [] };
    doc.updateBlock(model, {
      views: [
        {
          id: 'table-1',
          name: 'Table',
          mode: 'table',
          columns,
          filter,
          header: {},
        },
        {
          id: 'kanban-1',
          name: 'Kanban',
          mode: 'kanban',
          columns,
          filter,
          groupBy: { type: 'groupBy', columnId: status, name: 'select' },
          groupProperties: [],
          header: {},
        },
      ],
    });
    await settle();
    return cleanup;
  });

  afterEach(() => {
    document.querySelectorAll('affine-menu').forEach(menu => menu.remove());
  });

  test('a table cell draws the fallback label', async () => {
    block().dataSource.viewManager.setCurrentView('table-1');
    await settle();
    const tags = [
      ...block().querySelectorAll<HTMLElement>(
        'affine-multi-tag-view [data-testid="tag-selected"]'
      ),
    ];
    expect(tags.map(tag => tag.textContent?.trim())).toEqual([
      'Untitled',
      'Untitled',
    ]);
    expect(storedNames()).toEqual(['', '   ']);
  });

  test('a kanban group title keeps a height and opens its rename menu', async () => {
    block().dataSource.viewManager.setCurrentView('kanban-1');
    await settle();
    const titles = [
      ...block().querySelectorAll<HTMLElement>(
        '.data-view-group-title-select-view'
      ),
    ];
    expect(titles).toHaveLength(options.length);
    // The height first: it is what the reader lost, the label is the fix.
    expect(
      titles.map(title => title.getBoundingClientRect().height > 0)
    ).toEqual([true, true]);
    expect(
      titles.map(title => title.querySelector('.tag')?.textContent?.trim())
    ).toEqual(['Untitled', 'Untitled']);

    const title = titles[0]!;
    title.scrollIntoView({ block: 'center' });
    await settle();
    const hit = document.elementFromPoint(...centreOf(title));
    expect(title.contains(hit)).toBe(true);
    (hit as HTMLElement).click();
    await settle();

    const input = document.querySelector<HTMLInputElement>(
      'affine-menu input.affine-menu-input'
    );
    expect(input, 'the rename menu opens').not.toBeNull();
    expect(input!.placeholder).toBe('Untitled');
    expect(input!.value.trim()).toBe('');
    expect(storedNames()).toEqual(['', '   ']);
  });
});
