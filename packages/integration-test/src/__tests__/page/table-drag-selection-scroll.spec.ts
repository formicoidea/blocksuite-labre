/**
 * Issue #728 (upstream toeverything/AFFiNE#15910, commit 05dd274): a drag
 * selection across table cells must follow the pointer while the table
 * scrolls. The selection controller once measured the cell edges and the
 * press point at mousedown, in viewport coordinates; once the table's scroll
 * box (or the page) scrolled, every later pointer position was compared with
 * those stale edges, and a scroll while the pointer rested updated nothing.
 *
 * Real layout, real scroll box: a one-row table six 300px columns wide
 * overflows the 1024px viewport, the pointer presses the first cell, moves
 * over the second, then the table's own scroll box scrolls by two columns.
 * The pointer now rests over the fourth cell, which is where the selection
 * must end, whether a mousemove follows the scroll or not. The geometry
 * without layout, and the listener release on disconnect, are held by
 * `blocks/table/src/__tests__/drag-selection-scroll.unit.spec.ts`.
 */
import type { TableSelectionData } from '@labre/affine/blocks/table';
import { Text } from '@labre/store';
import { beforeEach, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

// The block component is not exported by the table package: the spec only
// needs the controller it hangs off.
type TableHost = HTMLElement & {
  selectionController: {
    getSelected(): TableSelectionData | undefined;
  };
};

const COLUMN_IDS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
const COLUMN_WIDTH = 300;
const SCROLLED_COLUMNS = 2;
const HALF = 0.5;

beforeEach(async () => {
  const cleanup = await setupEditor('page');
  return cleanup;
});

function addWideTable(noteId: string) {
  return doc.addBlock(
    'affine:table',
    {
      rows: { r0: { rowId: 'r0', order: 'a0' } },
      columns: Object.fromEntries(
        COLUMN_IDS.map((columnId, index) => [
          columnId,
          { columnId, order: `a${index}`, width: COLUMN_WIDTH },
        ])
      ),
      cells: Object.fromEntries(
        COLUMN_IDS.map(columnId => [
          `r0:${columnId}`,
          { text: new Text(columnId) },
        ])
      ),
    },
    noteId
  );
}

const center = (cell: HTMLElement) => {
  const rect = cell.getBoundingClientRect();
  return {
    clientX: rect.left + rect.width * HALF,
    clientY: rect.top + rect.height * HALF,
  };
};

const mouse = (type: string, target: EventTarget, at: MouseEventInit) =>
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, ...at }));

test.each([
  { name: 'after the next pointer move', moveAfterScroll: true },
  { name: 'while the pointer rests', moveAfterScroll: false },
])(
  'table drag selection follows the pointer across a scroll $name',
  async ({ moveAfterScroll }) => {
    const tableId = addWideTable(addNote(doc));
    await wait();
    const table = editor.host!.view.getBlock(tableId) as unknown as TableHost;
    const cells = Array.from(
      table.querySelectorAll<HTMLElement>('affine-table-cell td')
    );
    const scroller = table.querySelector<HTMLElement>(
      '[contenteditable="false"]'
    )!;
    scroller.scrollLeft = 0;
    await wait();

    mouse('mousedown', cells[0]!, center(cells[0]!));
    const pointer = center(cells[1]!);
    mouse('mousemove', cells[1]!, pointer);
    scroller.scrollLeft = SCROLLED_COLUMNS * COLUMN_WIDTH;
    scroller.dispatchEvent(new Event('scroll'));
    await wait();
    if (moveAfterScroll) {
      mouse('mousemove', cells[1 + SCROLLED_COLUMNS]!, pointer);
    }
    await wait();
    mouse('mouseup', window, pointer);

    expect(table.selectionController.getSelected()).toEqual({
      type: 'area',
      rowStartIndex: 0,
      rowEndIndex: 0,
      columnStartIndex: 0,
      columnEndIndex: 1 + SCROLLED_COLUMNS,
    });
  }
);
