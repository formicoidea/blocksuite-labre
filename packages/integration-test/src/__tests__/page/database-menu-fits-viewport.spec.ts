/**
 * **No entry of a menu of the base is ever unreachable, whatever the row
 * count and the window height, with the mouse and with the keyboard**
 * (product owner's acceptance of the database work: "the menu is in
 * overflow-hidden mode when the number of rows in the base is not large
 * enough").
 *
 * Menus are placed `fixed` against the window (`POPUP_STRATEGY`). On a tall
 * page the reader scrolled the header up and the menu with it; on a base of
 * three rows on its full page nothing scrolled, and the entries past the
 * window's bottom ("Duplicate", "Delete") could not be reached at all.
 *
 * What it would have caught:
 * - a menu taller than the room on its side running past the window instead
 *   of being capped there and scrolling inside itself, or its last entry
 *   unreachable by a real click;
 * - the arrows, down or up, moving the highlight to an entry the panel does
 *   not show, or hides under the name field row stuck at its top, or the
 *   column's name field scrolling away with the list;
 * - a menu that fits capped and scrolling all the same;
 * - a capped panel scrolling by itself under the pointer: back to its top
 *   when a sub-menu closed (the name field, focused at opening, was scrolled
 *   to), or when a click landed in a margin (the hidden search field took
 *   the focus and was scrolled to);
 * - the tag selector of a select cell (its own popup) or the date picker
 *   of a date cell running past a short window, or the tag selector's arrows
 *   selecting an option its list does not show;
 * - a popup left open, or a short window left, for the next spec of the
 *   suite, which shares one page.
 */
import { DatabaseBlockDataSource } from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import type { ExtensionType, Store } from '@labre/store';
import { Text } from '@labre/store';
import { page, userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { deepQueryAll } from '../utils/deep-query.js';
import { pointerMoveTo } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

/** The suite's frame, given back at the end (`isolate: false`). */
const FRAME_WIDTH = 1024;
const FRAME_HEIGHT = 768;
/** Too short for the column menu on either side of its header. */
const SHORT_HEIGHT = 420;
/** Short enough for the column menu to scroll a long way. */
const VERY_SHORT_HEIGHT = 300;
/** A border's rounding. */
const EPSILON = 1;
/** A loaded machine may take seconds to lay out a page. */
const PATIENCE_MS = 5000;
/** Frames given to a gesture's effects (a sub-menu opens on hover). */
const SETTLE_FRAMES = 6;
/** Options of the select column: more than its 400px list shows. */
const OPTION_COUNT = 24;
/** A click in the page's top left corner, away from any popup. */
const CLICK_AWAY_OFFSET = 2;
/** Escapes enough for a name field, a menu and its sub-menu. */
const MAX_ESCAPES = 4;
/** Arrow presses that take the selection past what the capped list shows. */
const OPTIONS_PAST_THE_LIST = 12;
/** The middle of a box, for the pointer. */
const CENTRE = 0.5;
/** The column menu and the sub-menu its hovered entry opens. */
const MENU_AND_SUB_MENU = 2;
/** Inside the panel's 8px left padding, at its middle height. */
const LEFT_MARGIN_X = 3;

const until = <T>(check: () => T) =>
  vi.waitFor(check, { timeout: PATIENCE_MS });

const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

const settle = () =>
  Array.from({ length: SETTLE_FRAMES }).reduce<Promise<void>>(
    async previous => {
      await previous;
      await frame();
    },
    Promise.resolve()
  );

type DatabasePage = HTMLElement & {
  store: Store;
  extensions: ExtensionType[];
  hostBlockId: string;
  heading: HTMLElement | null;
};

type Title = HTMLElement & { doc: Store; bodyBlockId: string | undefined };

let cleanup: (() => void) | undefined;

/** Every popup a test here may open: menus, the tag selector, the date picker. */
const openPopups = () => [
  ...document.querySelectorAll('affine-menu'),
  ...document.querySelectorAll('affine-multi-tag-select'),
  ...deepQueryAll(document, 'date-picker'),
];

// Each test closes what it opened, by the reader's gesture; this holds it,
// and gives the suite's shared page its frame back.
afterEach(async () => {
  const left = openPopups().map(popup => popup.tagName.toLowerCase());
  cleanup?.();
  cleanup = undefined;
  await page.viewport(FRAME_WIDTH, FRAME_HEIGHT);
  expect(left, 'no popup left open').toEqual([]);
  await until(() => expect(window.innerHeight).toBe(FRAME_HEIGHT));
});

/** A base of three rows on its full page, as a host mounts it. */
async function mountShortBase() {
  const unmount = await setupEditor('page');
  const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  const hostId = doc.addBlock(
    'affine:database',
    { title: new Text('Database 1') },
    noteId
  );
  const model = doc.getModelById(hostId) as DatabaseBlockModel;
  const source = new DatabaseBlockDataSource(model);
  source.viewManager.viewAdd('table');
  const status = source.propertyAdd('end', { type: 'select', name: 'Status' })!;
  source.propertyDataSet(status, {
    options: Array.from({ length: OPTION_COUNT }, (_, index) => ({
      id: `option-${index}`,
      color: 'var(--affine-tag-blue)',
      value: `Option ${index + 1}`,
    })),
  });
  const due = source.propertyAdd('end', { type: 'date', name: 'Due' })!;
  ['One', 'Two', 'Three'].forEach(() => source.rowAdd('end'));
  doc.resetHistory();

  const app = window.editor.parentElement!;
  const extensions = window.editor.pageSpecs;
  window.editor.remove();
  const databasePage = document.createElement(
    'affine-database-page'
  ) as DatabasePage;
  databasePage.style.height = '100vh';
  databasePage.store = doc;
  databasePage.extensions = extensions;
  databasePage.hostBlockId = hostId;
  const title = document.createElement('doc-title') as Title;
  title.doc = doc;
  title.bodyBlockId = hostId;
  databasePage.heading = title;
  app.append(databasePage);
  cleanup = () => {
    databasePage.remove();
    unmount();
  };
  const header = await until(() => {
    const element = databasePage.querySelector<HTMLElement>(
      `affine-database-header-column[data-column-id="${status}"] .affine-database-column-content`
    );
    expect(element, 'the Status header').toBeTruthy();
    return element!;
  });
  const cellOf = (columnId: string) =>
    databasePage.querySelector<HTMLElement>(
      `dv-table-view-cell-container[data-column-id="${columnId}"]`
    )!;
  return { header, source, status, due, cellOf };
}

const menus = () => [...document.querySelectorAll<HTMLElement>('affine-menu')];

async function openHeaderMenu(header: HTMLElement) {
  await userEvent.click(header);
  return until(() => {
    const menu = menus().at(-1);
    expect(menu, 'the column menu').toBeTruthy();
    return menu!;
  });
}

/** Whether the reader sees `entry` itself at its centre (nothing over it). */
function hitAtCentre(entry: HTMLElement) {
  const box = entry.getBoundingClientRect();
  const hit = document.elementFromPoint(
    box.left + box.width * CENTRE,
    box.top + box.height * CENTRE
  );
  return !!hit && entry.contains(hit);
}

const highlighted = (menu: HTMLElement) =>
  menu.querySelector('.focused')?.closest<HTMLElement>('[data-focusable]');

/** Whether `inner` is shown inside `outer` and inside the window. */
function shownIn(inner: Element, outer: Element) {
  const box = inner.getBoundingClientRect();
  const frameBox = outer.getBoundingClientRect();
  return (
    box.top >= Math.max(frameBox.top, 0) - EPSILON &&
    box.bottom <= Math.min(frameBox.bottom, window.innerHeight) + EPSILON
  );
}

function insideWindow(element: Element) {
  const box = element.getBoundingClientRect();
  return { top: box.top, bottom: box.bottom, window: window.innerHeight };
}

const entryNamed = (menu: HTMLElement, text: string) =>
  [...menu.querySelectorAll<HTMLElement>('[data-focusable="true"]')].find(
    entry => entry.textContent?.trim().startsWith(text)
  )!;

describe('a column menu on a short base, in a short window', () => {
  test('stays inside the window, scrolls, and reaches its last entry with the arrows and the mouse', async () => {
    const { header, source, status } = await mountShortBase();
    await page.viewport(FRAME_WIDTH, SHORT_HEIGHT);

    const menu = await openHeaderMenu(header);
    await until(() => {
      const { top, bottom } = insideWindow(menu);
      expect(top, 'the panel starts in the window').toBeGreaterThanOrEqual(
        -EPSILON
      );
      expect(bottom, 'the panel ends in the window').toBeLessThanOrEqual(
        window.innerHeight + EPSILON
      );
    });
    expect(
      menu.scrollHeight,
      'taller than the window allows: it scrolls inside itself'
    ).toBeGreaterThan(menu.clientHeight);

    // The name field takes the focus two frames after the menu opens
    // (MenuInput selects it); the hidden search field has it one frame
    // after, and Escape there closes the menu. Wait for the name field: a
    // slower runner (the PR's CI) pressed Escape in between, and the walk
    // below found nothing highlighted.
    await until(() =>
      expect(
        document.activeElement
          ?.closest('affine-menu-input')
          ?.closest('affine-menu')
      ).toBe(menu)
    );
    await userEvent.keyboard('{Escape}');
    const entries = [
      ...menu.querySelectorAll<HTMLElement>('[data-focusable="true"]'),
    ];
    // Down, one step at a time: each highlighted entry is wholly shown, and
    // nothing (the name field row) covers it.
    const list = entries.slice(1);
    await list.reduce<Promise<void>>(async (previous, entry) => {
      await previous;
      await userEvent.keyboard('{ArrowDown}');
      await until(() => expect(highlighted(menu)).toBe(entry));
      expect(shownIn(entry, menu), `${entry.textContent} shown`).toBe(true);
      expect(hitAtCentre(entry), `${entry.textContent} not covered`).toBe(true);
    }, Promise.resolve());
    const last = entries.at(-1)!;
    // The menu does not wrap: past the last entry, the highlight stays.
    await userEvent.keyboard('{ArrowDown}');
    await until(() => expect(highlighted(menu)).toBe(last));
    const nameField = menu.querySelector('affine-menu-input')!;
    expect(menu.scrollTop, 'scrolled to the last entry').toBeGreaterThan(0);
    expect(
      shownIn(nameField, menu),
      'the name field stays in view over the list'
    ).toBe(true);
    // Up again to the first entry of the list, under the name field row.
    await list
      .slice(0, -1)
      .reverse()
      .reduce<Promise<void>>(async (previous, entry) => {
        await previous;
        await userEvent.keyboard('{ArrowUp}');
        await until(() => expect(highlighted(menu)).toBe(entry));
        expect(shownIn(entry, menu), `${entry.textContent} shown`).toBe(true);
        expect(
          hitAtCentre(entry),
          `${entry.textContent} not under the name field row`
        ).toBe(true);
      }, Promise.resolve());
    await userEvent.keyboard('{Escape}');
    await until(() => expect(menus()).toHaveLength(0));

    const reopened = await openHeaderMenu(header);
    const remove = [
      ...reopened.querySelectorAll<HTMLElement>('affine-menu-button'),
    ].at(-1)!;
    expect(remove.textContent, 'the last entry').toContain('Delete');
    await userEvent.click(remove);
    await until(() =>
      expect(source.properties$.value, 'Status deleted').not.toContain(status)
    );
  });

  test('is left as it is when it fits', async () => {
    const { header } = await mountShortBase();
    await page.viewport(FRAME_WIDTH, FRAME_HEIGHT);

    const menu = await openHeaderMenu(header);
    await settle();
    expect(insideWindow(menu).bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(menu.style.maxHeight, 'no cap').toBe('');
    expect(menu.scrollHeight, 'no scroll').toBeLessThanOrEqual(
      menu.clientHeight
    );
    await closeMenusByEscape();
  });

  test('does not scroll by itself when the pointer leaves a sub-menu for the next entry', async () => {
    const { header } = await mountShortBase();
    await page.viewport(FRAME_WIDTH, VERY_SHORT_HEIGHT);

    const menu = await openHeaderMenu(header);
    await settle();
    const type = entryNamed(menu, 'Type');
    const next = entries(menu)[entries(menu).indexOf(type) + 1]!;
    type.dataset.probe = 'type';
    next.dataset.probe = 'next';
    // As a reader scrolls it: "Type" at the top of the list (under the name
    // field's row where that row stays in view), the field's place in the
    // list scrolled away.
    menu.scrollTop = type.offsetTop - nameRowHeight(menu);
    await settle();
    const scrolled = menu.scrollTop;
    expect(scrolled, 'the panel scrolled down').toBeGreaterThan(0);

    await pointerMoveTo('[data-probe="type"]', CENTRE, CENTRE);
    await until(() =>
      expect(menus().length, 'its sub-menu').toBe(MENU_AND_SUB_MENU)
    );
    await pointerMoveTo('[data-probe="next"]', CENTRE, CENTRE);
    await settle();
    expect(menu.scrollTop, 'the panel did not move').toBe(scrolled);
    await closeMenusByEscape();
  });

  test('does not scroll back to its top on a click in a margin', async () => {
    const { header } = await mountShortBase();
    await page.viewport(FRAME_WIDTH, VERY_SHORT_HEIGHT);

    const menu = await openHeaderMenu(header);
    await settle();
    menu.scrollTop = menu.scrollHeight;
    await settle();
    const scrolled = menu.scrollTop;
    expect(scrolled, 'the panel scrolled down').toBeGreaterThan(0);

    await userEvent.click(menu, {
      position: { x: LEFT_MARGIN_X, y: menu.clientHeight * CENTRE },
    });
    await settle();
    expect(menus(), 'still open').toContain(menu);
    expect(menu.scrollTop, 'the panel did not move').toBe(scrolled);
    await closeMenusByEscape();
  });
});

/**
 * Escape, as the reader closes a menu: once to leave its name field, once
 * per menu (a sub-menu over it).
 */
async function closeMenusByEscape() {
  await Array.from({ length: MAX_ESCAPES }).reduce<Promise<void>>(
    async previous => {
      await previous;
      if (!menus().length) return;
      await userEvent.keyboard('{Escape}');
      await settle();
    },
    Promise.resolve()
  );
  await until(() => expect(menus()).toHaveLength(0));
}

/** The height of the menu's name field row: scrolled past it, it is out of view. */
function nameRowHeight(menu: HTMLElement) {
  return (
    menu.querySelector('.affine-menu-input-row')?.getBoundingClientRect()
      .height ?? 0
  );
}

function entries(menu: HTMLElement) {
  return [...menu.querySelectorAll<HTMLElement>('[data-focusable="true"]')];
}

describe('the popups of a cell, in a short window', () => {
  async function editCell(cell: HTMLElement) {
    await userEvent.click(cell);
    await settle();
    await userEvent.keyboard('{Enter}');
  }

  test('the tag selector stays inside the window, its field in view, its options scrolling', async () => {
    const { status, cellOf } = await mountShortBase();
    await page.viewport(FRAME_WIDTH, SHORT_HEIGHT);

    await editCell(cellOf(status));
    const selector = await until(() => {
      const element = document.querySelector<HTMLElement>(
        'affine-multi-tag-select'
      );
      expect(element, 'the tag selector').toBeTruthy();
      return element!;
    });
    await settle();
    const { top, bottom } = insideWindow(selector);
    expect(top, 'it starts in the window').toBeGreaterThanOrEqual(-EPSILON);
    expect(bottom, 'it ends in the window').toBeLessThanOrEqual(
      window.innerHeight + EPSILON
    );
    const field = selector.querySelector('input')!;
    expect(shownIn(field, selector), 'the field is shown').toBe(true);
    const scroller = [...selector.querySelectorAll<HTMLElement>('*')].find(
      element =>
        element.querySelector('[data-testid="tag-name"]') &&
        element.scrollHeight > element.clientHeight &&
        getComputedStyle(element).overflowY === 'auto'
    );
    expect(scroller, 'the options scroll').toBeTruthy();
    expect(scroller!.contains(field), 'the field is not in the scroll').toBe(
      false
    );

    // The arrows bring the selected option wholly into the list's view,
    // down past what the list shows, and around from the first to the last.
    const optionAt = () =>
      scroller!.querySelector<HTMLElement>('[data-selected-option="true"]');
    const followed = async (key: string) => {
      await userEvent.keyboard(key);
      await settle();
      const option = optionAt();
      expect(option, 'a selected option').toBeTruthy();
      expect(shownIn(option!, scroller!), `${key}: shown`).toBe(true);
      expect(hitAtCentre(option!), `${key}: not covered`).toBe(true);
    };
    await Array.from({ length: OPTIONS_PAST_THE_LIST }).reduce<Promise<void>>(
      async previous => {
        await previous;
        await followed('{ArrowDown}');
      },
      Promise.resolve()
    );
    expect(scroller!.scrollTop, 'the list scrolled down').toBeGreaterThan(0);
    await userEvent.keyboard('{Escape}');
    await until(() => expect(openPopups()).toHaveLength(0));
  });

  test('the date picker stays inside the window', async () => {
    const { due, cellOf } = await mountShortBase();
    await page.viewport(FRAME_WIDTH, SHORT_HEIGHT);

    await editCell(cellOf(due));
    const picker = await until(() => {
      // The picker's portal holds it in a shadow root.
      const element = deepQueryAll(document, 'date-picker')[0];
      expect(element, 'the date picker').toBeTruthy();
      return element!;
    });
    await until(() => {
      const { top, bottom } = insideWindow(picker);
      expect(top, 'it starts in the window').toBeGreaterThanOrEqual(-EPSILON);
      expect(bottom, 'it ends in the window').toBeLessThanOrEqual(
        window.innerHeight + EPSILON
      );
    });
    // Closed by a click away, as the reader closes it.
    await userEvent.click(document.body, {
      position: { x: CLICK_AWAY_OFFSET, y: CLICK_AWAY_OFFSET },
    });
    await until(() => expect(openPopups()).toHaveLength(0));
  });
});
