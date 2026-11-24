/**
 * Issue #728 (upstream toeverything/AFFiNE#15910): a drag selection across
 * table cells must follow the pointer while the page scrolls.
 *
 * `SelectionController.onDragStart` measures the cell edges and the press
 * point once, at mousedown, in viewport coordinates. Once the page (or the
 * table's own scroll box) scrolls, every later pointer position is compared
 * with those stale edges, so the selected area no longer matches the cells
 * under the pointer — and a scroll while the pointer rests updates nothing.
 *
 * happy-dom has no layout, so the geometry is stubbed: each row and cell
 * reports a `getBoundingClientRect` derived from a shared scroll offset, the
 * way a real viewport moves the table under a still pointer. The real
 * controller, the real `TableSelection` and the real `StoreSelectionExtension`
 * do the rest.
 */
import { type Store, StoreSelectionExtension } from '@labre/store';
import { afterEach, describe, expect, it } from 'vitest';

import { SelectionController } from '../selection-controller.js';
import type { TableBlockComponent } from '../table-block.js';

const ROWS = 10;
const COLUMNS = 2;
const ROW_HEIGHT = 40;
const COLUMN_WIDTH = 100;
const TABLE_TOP = 100;
const TABLE_LEFT = 50;
const HALF = 0.5;
/** The page scrolls by this many rows during the drag. */
const SCROLLED_ROWS = 5;
/** The pointer rests over row 1 before the scroll, so over row 6 after it. */
const ROW_UNDER_POINTER_AFTER_SCROLL = 1 + SCROLLED_ROWS;

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

function mountTable() {
  const scroll = { y: 0 };
  const host = document.createElement('div');
  const cells = Array.from({ length: ROWS }, (_, r) => {
    const tr = document.createElement('tr');
    tr.getBoundingClientRect = () =>
      rect(
        TABLE_LEFT,
        TABLE_TOP + r * ROW_HEIGHT - scroll.y,
        COLUMN_WIDTH * COLUMNS,
        ROW_HEIGHT
      );
    const row = Array.from({ length: COLUMNS }, (_, c) => {
      const cell = document.createElement('affine-table-cell');
      const td = document.createElement('td');
      td.getBoundingClientRect = () =>
        rect(
          TABLE_LEFT + c * COLUMN_WIDTH,
          TABLE_TOP + r * ROW_HEIGHT - scroll.y,
          COLUMN_WIDTH,
          ROW_HEIGHT
        );
      cell.append(td);
      tr.append(cell);
      return td;
    });
    host.append(tr);
    return row;
  });
  document.body.append(host);

  const store = {
    id: 'doc',
    awarenessStore: { setLocalSelection: () => {} },
  } as unknown as Store;
  Object.assign(host, {
    model: { id: 'table' },
    selection: new StoreSelectionExtension(store),
    addController: () => {},
  });
  const controller = new SelectionController(
    host as unknown as TableBlockComponent
  );
  return { host, cells, scroll, controller };
}

/** The pointer at the centre of row `r` (pre-scroll geometry), column 0. */
const at = (r: number) => ({
  clientX: TABLE_LEFT + COLUMN_WIDTH * HALF,
  clientY: TABLE_TOP + r * ROW_HEIGHT + ROW_HEIGHT * HALF,
});

function press(
  controller: SelectionController,
  target: HTMLElement,
  point: { clientX: number; clientY: number }
) {
  target.addEventListener('mousedown', e => controller.onDragStart(e), {
    once: true,
  });
  target.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, ...point })
  );
}

const move = (
  target: HTMLElement,
  point: { clientX: number; clientY: number }
) =>
  target.dispatchEvent(
    new MouseEvent('mousemove', { bubbles: true, ...point })
  );

const release = () => window.dispatchEvent(new MouseEvent('mouseup'));

afterEach(() => {
  release();
  document.body.innerHTML = '';
});

describe('table drag selection across a scroll (#728)', () => {
  it('selects from the pressed cell to the hovered one without a scroll', () => {
    const { cells, controller } = mountTable();
    press(controller, cells[0]![0]!, at(0));
    move(cells[1]![0]!, at(1));

    expect(controller.getSelected()).toEqual({
      type: 'area',
      rowStartIndex: 0,
      rowEndIndex: 1,
      columnStartIndex: 0,
      columnEndIndex: 0,
    });
  });

  it('follows the pointer after the page scrolled, on the next move', () => {
    const { cells, scroll, controller } = mountTable();
    press(controller, cells[0]![0]!, at(0));
    move(cells[1]![0]!, at(1));

    // The page scrolls: the pointer, still at the same viewport point, now
    // rests over a row further down.
    scroll.y = SCROLLED_ROWS * ROW_HEIGHT;
    move(cells[ROW_UNDER_POINTER_AFTER_SCROLL]![0]!, at(1));

    expect(controller.getSelected()).toEqual({
      type: 'area',
      rowStartIndex: 0,
      rowEndIndex: ROW_UNDER_POINTER_AFTER_SCROLL,
      columnStartIndex: 0,
      columnEndIndex: 0,
    });
  });

  it('follows the pointer after the page scrolled while the pointer rests', () => {
    const { cells, scroll, controller } = mountTable();
    press(controller, cells[0]![0]!, at(0));
    move(cells[1]![0]!, at(1));

    scroll.y = SCROLLED_ROWS * ROW_HEIGHT;
    document.dispatchEvent(new Event('scroll'));

    expect(controller.getSelected()).toEqual({
      type: 'area',
      rowStartIndex: 0,
      rowEndIndex: ROW_UNDER_POINTER_AFTER_SCROLL,
      columnStartIndex: 0,
      columnEndIndex: 0,
    });
  });

  it('stops listening to the window once the table disconnects mid-drag', () => {
    const { cells, scroll, controller } = mountTable();
    press(controller, cells[0]![0]!, at(0));
    move(cells[1]![0]!, at(1));

    controller.hostDisconnected();
    scroll.y = SCROLLED_ROWS * ROW_HEIGHT;
    document.dispatchEvent(new Event('scroll'));
    move(cells[ROW_UNDER_POINTER_AFTER_SCROLL]![0]!, at(1));

    expect(controller.getSelected()).toEqual({
      type: 'area',
      rowStartIndex: 0,
      rowEndIndex: 1,
      columnStartIndex: 0,
      columnEndIndex: 0,
    });
  });

  it('stops listening to the window on mouseup', () => {
    const { cells, scroll, controller } = mountTable();
    press(controller, cells[0]![0]!, at(0));
    move(cells[1]![0]!, at(1));

    release();
    scroll.y = SCROLLED_ROWS * ROW_HEIGHT;
    document.dispatchEvent(new Event('scroll'));

    expect(controller.getSelected()).toMatchObject({
      type: 'area',
      rowEndIndex: 1,
    });
  });
});
