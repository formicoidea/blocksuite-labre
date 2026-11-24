import {
  type DatabaseBlockComponent,
  DatabaseBlockDataSource,
} from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import { Text } from '@labre/store';
import { expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **Typing into a selected title cell of a sorted table keeps editing the
 * same row** (#739, upstream toeverything/AFFiNE#15915, 10ea096; modelled on
 * upstream's `editor-semantics.spec.ts` case).
 *
 * A printable key on a selected (not editing) cell writes the key into the
 * cell and enters the edit mode (`handleCharStartEdit`). The rows of a
 * sorted view only keep their order while they are locked, and the lock
 * came from the cell's render, a Lit update after the first write: the sort
 * moved the edited row away and the editor was left on another row. The
 * unit spec (`sorted-typing-row-lock.unit.spec.ts`, database engine) drives
 * the controllers over a stand-in source; this one presses the key in a real
 * editor on a real `affine:database` block.
 *
 * What it would have caught:
 * - the edited row re-sorted under its new first letter ("z" after "c");
 * - the edit mode landing on the row now at the selection's index.
 */

/** Time for the store to notify the view, then frames for Lit to render. */
const SETTLE_MS = 100;
const SETTLE_FRAMES = 4;

const nextFrame = () =>
  new Promise<unknown>(resolve => requestAnimationFrame(resolve));

const settle = async () => {
  await wait(SETTLE_MS);
  await Array.from({ length: SETTLE_FRAMES }).reduce<Promise<unknown>>(
    previous => previous.then(nextFrame),
    Promise.resolve()
  );
};

test('typing into a sorted database title keeps editing the same row (#739)', async () => {
  const cleanup = await setupEditor('page');
  try {
    const doc = window.doc;
    const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
    const databaseId = doc.addBlock(
      'affine:database',
      { columns: [], title: new Text('Sorted') },
      noteId
    );
    const model = doc.getModelById(databaseId) as DatabaseBlockModel;
    const edited = doc.addBlock(
      'affine:paragraph',
      { text: new Text('b') },
      databaseId
    );
    const other = doc.addBlock(
      'affine:paragraph',
      { text: new Text('c') },
      databaseId
    );
    const writer = new DatabaseBlockDataSource(model);
    const viewId = writer.viewManager.viewAdd('table');
    const titleId = writer.properties$.value.find(
      propertyId => writer.propertyTypeGet(propertyId) === 'title'
    )!;
    // The base view data type has no `sort`; the table's own type does.
    writer.viewDataUpdate(
      viewId,
      data =>
        ({
          ...data,
          sort: {
            manuallySort: [],
            sortBy: [{ ref: { type: 'ref', name: titleId }, desc: false }],
          },
        }) as never
    );
    writer.dispose();
    await settle();

    const database = document.querySelector<DatabaseBlockComponent>(
      `affine-database[data-block-id="${databaseId}"]`
    );
    expect(database, 'the database block is rendered').not.toBeNull();
    const titleCells = () =>
      Array.from(
        database!.querySelectorAll<HTMLElement>(
          `dv-table-view-cell-container[data-column-id="${titleId}"]`
        )
      );
    expect(titleCells().map(cell => cell.dataset.rowId)).toEqual([
      edited,
      other,
    ]);

    const container = titleCells()[0] as HTMLElement & {
      selectCurrentCell: (editing: boolean) => void;
    };
    container.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    container.selectCurrentCell(false);
    await settle();
    container.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'z',
        bubbles: true,
        cancelable: true,
      })
    );
    await settle();

    const after = titleCells();
    expect(after.map(cell => cell.dataset.rowId)).toEqual([edited, other]);
    expect(after[0]!.dataset.editing).toBe('true');
  } finally {
    cleanup();
  }
});
