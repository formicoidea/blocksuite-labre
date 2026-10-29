import {
  addProperty,
  type DatabaseBlockComponent,
  databaseBlockProperties,
  DatabaseBlockDataSource,
} from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import { Text } from '@labre/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **"New" puts the new row's title in editing, in every view** (product
 * owner, recette P3-15).
 *
 * The toolbar's "New" (`addRow`) added the row and then OPENED it (the peek
 * view, the host's row page), while the table's own "New record" footer
 * added it and put its title in editing. Now every view does what the
 * footer does: the row is added, its title cell is in editing, nothing
 * opens and nothing else is written.
 *
 * What it would have caught:
 * - a row page (`center-peek`) opening after "New" in a table, a board, a
 *   gallery or a list;
 * - the title of another row (the first card of an empty first group, a
 *   stale index after a sort) put in editing instead of the new one's;
 * - a second row, or any other block, written by the gesture.
 *
 * The phone presets follow the same selection (their cells read it); they
 * cannot be mounted here (`IS_MOBILE` is fixed per build).
 */

const settle = async () => {
  await wait(100);
  for (let i = 0; i < 4; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

const options = [
  { id: 'todo', value: 'Todo', color: 'var(--affine-tag-blue)' },
  { id: 'done', value: 'Done', color: 'var(--affine-tag-green)' },
];

describe('"New" in the toolbar puts the new title in editing', () => {
  let model!: DatabaseBlockModel;
  const views: Record<string, string> = {};

  const block = () => {
    const element = document.querySelector<DatabaseBlockComponent>(
      `affine-database[data-block-id="${model.id}"]`
    );
    if (!element) throw new Error('the database block is not rendered');
    return element;
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('page');
    const doc = window.doc;
    const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
    const databaseId = doc.addBlock(
      'affine:database',
      { columns: [], title: new Text('Plan') },
      noteId
    );
    model = doc.getModelById(databaseId) as DatabaseBlockModel;
    addProperty(
      model,
      'end',
      databaseBlockProperties.selectColumnConfig.create('Status', { options })
    );
    for (const title of ['Alpha', 'Bravo']) {
      doc.addBlock('affine:paragraph', { text: new Text(title) }, databaseId);
    }
    const writer = new DatabaseBlockDataSource(model);
    for (const mode of ['table', 'kanban', 'gallery', 'list']) {
      views[mode] = writer.viewManager.viewAdd(mode);
    }
    writer.dispose();
    await settle();
    return () => {
      for (const layer of document.querySelectorAll(
        'body > [data-range-sync-exclude]'
      )) {
        if (layer.querySelector('center-peek')) layer.remove();
      }
      cleanup();
    };
  });

  /** Shows `mode`, presses its toolbar's "New", returns the new row's id. */
  async function pressNew(mode: string) {
    block().dataSource.viewManager.setCurrentView(views[mode]!);
    await settle();
    const before = model.children.map(child => child.id);
    const button = block().querySelector<HTMLElement>(
      'data-view-component-button.new-record'
    );
    expect(button, `${mode} draws "New"`).not.toBeNull();
    button!.click();
    await settle();
    const added = model.children.filter(child => !before.includes(child.id));
    expect(added, `${mode} adds one row`).toHaveLength(1);
    expect(document.querySelector('center-peek'), `${mode} opens no row`).toBe(
      null
    );
    return added[0]!.id;
  }

  const viewSelection = () =>
    window.editor.std.selection.value.find(
      selection => selection.type === 'database'
    ) as
      | { blockId: string; viewSelection: Record<string, unknown> }
      | undefined;

  test('table: the new row title cell is selected in editing', async () => {
    const rowId = await pressNew('table');
    const held = viewSelection();
    expect(held?.blockId).toBe(model.id);
    expect(held?.viewSelection).toMatchObject({
      selectionType: 'area',
      isEditing: true,
    });
    const focus = held!.viewSelection.focus as { rowIndex: number };
    const rows = block().dataSource.viewManager.currentView$.value!.rows$.value;
    expect(rows[focus.rowIndex]?.rowId).toBe(rowId);
  });

  test('kanban: the new card title is selected in editing', async () => {
    const rowId = await pressNew('kanban');
    expect(viewSelection()?.viewSelection).toMatchObject({
      selectionType: 'cell',
      cardId: rowId,
      isEditing: true,
    });
  });

  for (const mode of ['gallery', 'list']) {
    test(`${mode}: the new row title is in editing`, async () => {
      const rowId = await pressNew(mode);
      const row = [
        ...block().querySelectorAll<HTMLElement>(
          `dv-${mode}-view-ui [data-row-id]`
        ),
      ].find(element => element.dataset.rowId === rowId);
      expect(row, 'the new row is drawn').toBeDefined();
      const editing = row!.querySelector<HTMLElement>(
        'dv-standalone-cell[data-editing="true"]'
      );
      expect(editing, 'its title edits').not.toBeNull();
      const view = block().dataSource.viewManager.currentView$
        .value as unknown as {
        titleProperty$: { value?: { id: string } };
      };
      expect(editing!.dataset.propertyId).toBe(view.titleProperty$.value?.id);
    });
  }
});
