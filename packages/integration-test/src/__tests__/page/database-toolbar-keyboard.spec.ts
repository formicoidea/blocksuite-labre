import {
  DatabaseBlockDataSource,
  DatabaseNewRowMenuExtension,
  type DatabaseNewRowMenuRequest,
} from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import type { ExtensionType, Store } from '@labre/store';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { pointerMoveTo } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **The view toolbar of a database is driven from the keyboard** (#678,
 * Labre design audit P1-6; WCAG 2.1.1, 2.4.3, 2.4.7, 4.1.2).
 *
 * Real keystrokes (Playwright's keyboard): the editor swallows Tab and
 * Enter for its blocks, so only a real Tab proves a control is reachable,
 * and only a real Enter proves it activates without the editor acting too.
 *
 * What it would have caught:
 * - Tab skipping the whole toolbar (filter, sort, search, view options, New
 *   and its menu arrow measured at `tabIndex = -1`), or reaching its
 *   controls out of their visual order, or a control with no name ("⋯");
 * - a focused control in a toolbar still at opacity 0 (shown only on hover)
 *   or without a visible focus ring;
 * - filter, sort or view options not opening from the keyboard, Escape not
 *   closing their menu, or the focus left on the page's body after it;
 * - search, an icon in a label, not opening from the keyboard with the
 *   focus in its field, and Escape not bringing the focus back;
 * - a database opened as the page itself hiding its toolbar at rest.
 *
 * The names, the read-only view and the seam's wording are in
 * `toolbar-keyboard.unit.spec.ts` (data-view).
 */

const HOST_MENU_LABEL = 'Templates and options';

/** The middle of a box, for the pointer. */
const CENTRE = 0.5;
/** Long enough for the editor and the database to mount and lay out. */
const MOUNTED = 300;
/** Long enough for a menu to open, take the focus, or go. */
const MENU_OPENED = 100;

/** The toolbar's controls in visual order, as `controlsOf` names them. */
const TAB_ORDER = [
  'filter',
  'sort',
  'search',
  'viewOptions',
  'newRecord',
  'newRecordMenu',
] as const;

let cleanup: (() => void) | undefined;
let pointerRest: HTMLElement | undefined;

afterEach(() => {
  pointerRest?.remove();
  pointerRest = undefined;
  cleanup?.();
  cleanup = undefined;
});

/** A note holding a database with one table view, two rows. */
function writeDatabase() {
  const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  const id = doc.addBlock(
    'affine:database',
    { title: new Text('Portfolio') },
    noteId
  );
  const model = doc.getModelById(id) as DatabaseBlockModel;
  const writer = new DatabaseBlockDataSource(model);
  writer.viewManager.viewAdd('table');
  writer.propertyAdd('end');
  writer.rowAdd('end');
  writer.rowAdd('end');
  writer.dispose();
  doc.resetHistory();
  return id;
}

/**
 * The mouse parked on a box of its own, above everything, away from the
 * database: the suite shares one page, so the pointer is wherever the last
 * spec left it, maybe over the toolbar, which would show it by hover.
 */
async function parkPointer() {
  pointerRest = document.createElement('div');
  pointerRest.id = 'dv-toolbar-pointer-rest';
  Object.assign(pointerRest.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '24px',
    height: '24px',
    zIndex: '100000',
  });
  document.body.append(pointerRest);
  await pointerMoveTo('#dv-toolbar-pointer-rest', CENTRE, CENTRE);
}

async function mountInline() {
  const open = vi.fn<(request: DatabaseNewRowMenuRequest) => void>();
  cleanup = await setupEditor('page', [DatabaseNewRowMenuExtension({ open })]);
  const id = writeDatabase();
  await wait(MOUNTED);
  await parkPointer();
  const block = window.editor.host!.querySelector<HTMLElement>(
    `affine-database[data-block-id="${id}"]`
  );
  expect(block, 'the database block').not.toBe(null);
  return { block: block!, open };
}

const toolbarOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    'data-view-header-tools .affine-database-toolbar'
  )!;

/**
 * The toolbar's controls, in the order the reader sees them, found by what
 * 4.0.0 already drew, so this spec fails there on behaviour, not on a hook.
 */
function controlsOf(root: ParentNode) {
  const toolbar = toolbarOf(root);
  const one = (selector: string) => {
    const element = toolbar.querySelector<HTMLElement>(selector);
    expect(element, selector).not.toBe(null);
    return element!;
  };
  return {
    filter: one('[data-testid="dv-tools-filter"]'),
    sort: one('[data-testid="dv-tools-sort"]'),
    search: one('.affine-database-search-input-icon'),
    viewOptions: one('.affine-database-toolbar-item.more-action'),
    newRecord: one('data-view-component-button.new-record'),
    newRecordMenu: one('[data-testid="database-new-record-more"]'),
  };
}

/**
 * A native button just before the toolbar, where a Tab starts from: the
 * views bar before it ("+", the view tabs) is not in the tab order, which
 * #678 does not cover.
 */
function startBefore(root: ParentNode) {
  const tools = root.querySelector<HTMLElement>('data-view-header-tools')!;
  const start = document.createElement('button');
  start.textContent = 'start';
  tools.before(start);
  start.focus();
  expect(document.activeElement).toBe(start);
  return start;
}

const accessibleName = (element: HTMLElement) =>
  (element.getAttribute('aria-label') ?? element.textContent ?? '').trim();

const openMenus = () =>
  [...document.querySelectorAll<HTMLElement>('affine-menu')].filter(
    menu => menu.isConnected
  );

/** Tab from the start until the focus is on `control`, in visual order. */
async function tabTo(
  root: ParentNode,
  control: keyof ReturnType<typeof controlsOf>
) {
  startBefore(root);
  await Array.from({ length: TAB_ORDER.indexOf(control) + 1 }).reduce<
    Promise<void>
  >(async previous => {
    await previous;
    await userEvent.keyboard('{Tab}');
  }, Promise.resolve());
}

/** The toolbar's fade lasts 150ms. */
const FADE = 200;

describe('the view toolbar of an inline table, from the keyboard', () => {
  test('Tab walks its controls in visual order, each named, focused visibly', async () => {
    const { block } = await mountInline();
    const toolbar = toolbarOf(block);
    expect(
      getComputedStyle(toolbar).opacity,
      'inline, the toolbar waits for the pointer at rest'
    ).toBe('0');

    const controls = controlsOf(block);
    const order = [
      controls.filter,
      controls.sort,
      controls.search,
      controls.viewOptions,
      controls.newRecord,
      controls.newRecordMenu,
    ];
    startBefore(block);
    const visited = await order.reduce<
      Promise<
        { name: string; opacity: string; outline: string; width: string }[]
      >
    >(async previous => {
      const seen = await previous;
      await userEvent.keyboard('{Tab}');
      await wait(FADE);
      const active = document.activeElement as HTMLElement;
      const style = getComputedStyle(active);
      return [
        ...seen,
        {
          name: active === order[seen.length] ? accessibleName(active) : '',
          opacity: getComputedStyle(toolbar).opacity,
          outline: style.outlineStyle,
          width: style.outlineWidth,
        },
      ];
    }, Promise.resolve([]));

    expect(visited.map(step => step.name)).toEqual([
      'Filter',
      'Sort',
      'Search',
      'View settings',
      'New Record',
      HOST_MENU_LABEL,
    ]);
    expect(visited.map(step => step.opacity)).toEqual(order.map(() => '1'));
    expect(visited.map(step => [step.outline, step.width])).toEqual(
      order.map(() => ['solid', '2px'])
    );
  });

  test('Enter opens the filter menu, the arrows walk it, Escape gives the focus back', async () => {
    const { block } = await mountInline();
    const { filter } = controlsOf(block);
    await tabTo(block, 'filter');
    expect(document.activeElement).toBe(filter);

    await userEvent.keyboard('{Enter}');
    await wait(MENU_OPENED);
    expect(openMenus().length, 'the filter menu').toBe(1);
    await userEvent.keyboard('{ArrowDown}');
    await wait();
    expect(
      openMenus()[0].querySelector('.affine-menu-button.focused'),
      'an item focused by the arrows'
    ).not.toBe(null);

    await userEvent.keyboard('{Escape}');
    await wait(MENU_OPENED);
    expect(openMenus().length).toBe(0);
    expect(document.activeElement).toBe(filter);
  });

  test('Space opens the sort menu, Escape gives the focus back', async () => {
    const { block } = await mountInline();
    const { sort } = controlsOf(block);
    await tabTo(block, 'sort');
    expect(document.activeElement).toBe(sort);

    await userEvent.keyboard(' ');
    await wait(MENU_OPENED);
    expect(openMenus().length, 'the sort menu').toBe(1);

    await userEvent.keyboard('{Escape}');
    await wait(MENU_OPENED);
    expect(openMenus().length).toBe(0);
    expect(document.activeElement).toBe(sort);
  });

  // The view settings open on the view's name, selected for a rename: the
  // shared menu's field takes a first Escape to leave it (`MenuInput`), the
  // second closes the menu.
  test('Enter opens the view settings, Escape leaves the name, then gives the focus back', async () => {
    const { block } = await mountInline();
    const { viewOptions } = controlsOf(block);
    await tabTo(block, 'viewOptions');
    expect(document.activeElement).toBe(viewOptions);

    await userEvent.keyboard('{Enter}');
    await wait(MENU_OPENED);
    expect(openMenus().length, 'the view settings').toBe(1);

    await userEvent.keyboard('{Escape}');
    await wait(MENU_OPENED);
    expect(openMenus().length, 'still open, out of the name').toBe(1);

    await userEvent.keyboard('{Escape}');
    await wait(MENU_OPENED);
    expect(openMenus().length).toBe(0);
    expect(document.activeElement).toBe(viewOptions);
  });

  test('search opens into its field, Escape clears it, then gives the focus back', async () => {
    const { block } = await mountInline();
    const { search } = controlsOf(block);
    const field = toolbarOf(block).querySelector<HTMLInputElement>(
      '.affine-database-search-input'
    )!;
    await tabTo(block, 'search');
    expect(document.activeElement).toBe(search);

    await userEvent.keyboard('{Enter}');
    await wait(MENU_OPENED);
    expect(document.activeElement, 'the focus in the field').toBe(field);
    expect(search.getAttribute('aria-expanded')).toBe('true');

    await userEvent.keyboard('x');
    expect(field.value).toBe('x');
    await userEvent.keyboard('{Escape}');
    await wait();
    expect(field.value, 'the first Escape clears').toBe('');
    expect(document.activeElement).toBe(field);

    await userEvent.keyboard('{Escape}');
    await wait(MENU_OPENED);
    expect(search.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement, 'the second closes').toBe(search);
  });

  test('Enter on the arrow beside New asks the host for its menu', async () => {
    const { block, open } = await mountInline();
    const { newRecordMenu } = controlsOf(block);
    await tabTo(block, 'newRecordMenu');
    expect(document.activeElement).toBe(newRecordMenu);

    await userEvent.keyboard('{Enter}');
    await wait();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0].anchor).toBe(newRecordMenu);
  });
});

type DatabasePage = HTMLElement & {
  store: Store;
  extensions: ExtensionType[];
  hostBlockId: string;
  heading: HTMLElement | null;
};

type Title = HTMLElement & { doc: Store; bodyBlockId: string | undefined };

describe('the view toolbar of a database opened as the page', () => {
  test('is shown at rest', async () => {
    cleanup = await setupEditor('page');
    const hostId = writeDatabase();
    const app = window.editor.parentElement!;
    const extensions = window.editor.pageSpecs;
    window.editor.remove();
    const page = document.createElement('affine-database-page') as DatabasePage;
    page.style.height = '500px';
    page.store = doc;
    page.extensions = extensions;
    page.hostBlockId = hostId;
    const title = document.createElement('doc-title') as Title;
    title.doc = doc;
    title.bodyBlockId = hostId;
    page.heading = title;
    app.append(page);
    const previous = cleanup;
    cleanup = () => {
      page.remove();
      previous();
    };
    await wait(MOUNTED);
    await parkPointer();
    await wait(FADE);

    const database = page.querySelector<HTMLElement>('affine-database')!;
    expect(database.hasAttribute('data-standalone')).toBe(true);
    expect(getComputedStyle(toolbarOf(database)).opacity).toBe('1');
  });
});
