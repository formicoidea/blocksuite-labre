import {
  DatabaseBlockDataSource,
  DatabaseNewRowMenuExtension,
  type DatabaseNewRowMenuRequest,
} from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import type { EditorHost } from '@labre/std';
import type { ExtensionType, Store } from '@labre/store';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { pointerMoveTo } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **The view toolbar of a database is driven from the keyboard** (#678,
 * Labre design audit P1-6; WCAG 2.1.1, 2.4.3, 2.4.7, 4.1.2).
 *
 * Real keystrokes (Playwright's keyboard): the editor swallows Tab and
 * Enter for its blocks and the view's keys listen on the document, so only
 * real keys prove a control is reachable and that a key aimed at it acts on
 * it alone.
 *
 * What it would have caught:
 * - Tab skipping the whole toolbar (filter, sort, search, view options, New
 *   and its menu arrow measured at `tabIndex = -1`), reaching its controls
 *   out of their visual order (table and kanban), Shift+Tab not walking it
 *   back, or a control with no name ("⋯");
 * - the title of a base's full page keeping Tab, so the toolbar could not
 *   be reached from the page at all;
 * - a focused control in a toolbar still at opacity 0 (shown only on hover)
 *   or without a visible focus ring;
 * - with a cell selected (the state after any gesture in the table): Tab
 *   stuck on a control, a letter on a control putting the cell in editing,
 *   Backspace on a control clearing the cell, Tab stuck in the search field;
 * - the toolbar taking the view's keys after a MOUSE gesture (the product
 *   owner's rule: a toolbar takes the keys of its own model, and only in
 *   keyboard mode): a cell selected, a click on Filter, the menu closed by a
 *   click, then a letter must edit the cell and the arrows move it, as on
 *   4.0.0; a click on the arrow beside New (which opens no library menu)
 *   took the focus from the table on mousedown, and a letter no longer
 *   edited the cell;
 * - filter, sort or view options not opening from Enter or Space, Escape
 *   not closing their menu, or the focus left on the page's body after it;
 * - search, an icon in a label, not opening from the keyboard with the
 *   focus in its field, and Escape not bringing the focus back;
 * - Enter or Space on New adding no row, or more than one;
 * - a database opened as the page itself hiding its toolbar at rest.
 *
 * The names through the seam, the read-only view, the held key and the
 * folded field's `inert` are in `toolbar-keyboard.unit.spec.ts` (data-view).
 */

const HOST_MENU_LABEL = 'Templates and options';

/** The middle of a box, for the pointer. */
const CENTRE = 0.5;

/** The toolbar's controls in visual order, as `controlsOf` names them. */
const TAB_ORDER = [
  'filter',
  'sort',
  'search',
  'viewOptions',
  'newRecord',
  'newRecordMenu',
] as const;

type Control = (typeof TAB_ORDER)[number];

let cleanup: (() => void) | undefined;
let pointerRest: HTMLElement | undefined;

afterEach(() => {
  pointerRest?.remove();
  pointerRest = undefined;
  cleanup?.();
  cleanup = undefined;
});

/** A loaded machine may take seconds to lay out a page. */
const PATIENCE_MS = 5000;

/** Retried until it holds: what the spec waits for, never a delay. */
const until = <T>(check: () => T) =>
  vi.waitFor(check, { timeout: PATIENCE_MS });

/** A note holding a database with one view, a text column and two rows. */
function writeDatabase(mode = 'table') {
  const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  const id = doc.addBlock(
    'affine:database',
    { title: new Text('Portfolio') },
    noteId
  );
  const model = doc.getModelById(id) as DatabaseBlockModel;
  const writer = new DatabaseBlockDataSource(model);
  writer.viewManager.viewAdd(mode);
  writer.propertyAdd('end');
  ['Alpha', 'Beta'].forEach(name => {
    const rowId = writer.rowAdd('end');
    const row = doc.getModelById(rowId) as unknown as {
      props: { text: Text };
    };
    row.props.text.insert(name, 0);
  });
  writer.dispose();
  doc.resetHistory();
  return { id, model };
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

const toolbarOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    'data-view-header-tools .affine-database-toolbar'
  );

/**
 * The toolbar's controls, in the order the reader sees them, found by what
 * 4.0.0 already drew, so this spec fails there on behaviour, not on a hook.
 */
function controlsOf(root: ParentNode): Record<Control, HTMLElement> {
  const toolbar = toolbarOf(root)!;
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

async function mountInline(mode = 'table') {
  const open = vi.fn<(request: DatabaseNewRowMenuRequest) => void>();
  cleanup = await setupEditor('page', [DatabaseNewRowMenuExtension({ open })]);
  const { id, model } = writeDatabase(mode);
  const block = await until(() => {
    const element = window.editor.host!.querySelector<HTMLElement>(
      `affine-database[data-block-id="${id}"]`
    );
    expect(element && toolbarOf(element), 'the database toolbar').toBeTruthy();
    expect(
      toolbarOf(element!)!.querySelector(
        '[data-testid="database-new-record-more"]'
      ),
      'the toolbar, drawn'
    ).toBeTruthy();
    return element!;
  });
  await parkPointer();
  return { block, model, open, controls: controlsOf(block) };
}

/**
 * Inside an ordinary document nothing focusable precedes the toolbar but
 * text, whose Tab the editor keeps to indent: a native button inserted just
 * before it stands for whatever control the reader comes from. The full
 * page tabs from its real title (`database-page` below).
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

const openMenus = () => [...document.querySelectorAll('affine-menu')];

const isFocused = (element: HTMLElement) =>
  expect(document.activeElement).toBe(element);

/** Real Tabs, one at a time, each landing on the next of `controls`. */
async function tabThrough(controls: HTMLElement[], shift = false) {
  const key = shift ? '{Shift>}{Tab}{/Shift}' : '{Tab}';
  await controls.reduce<Promise<void>>(async (previous, control) => {
    await previous;
    await userEvent.keyboard(key);
    await until(() => isFocused(control));
  }, Promise.resolve());
}

async function tabTo(
  root: ParentNode,
  controls: Record<Control, HTMLElement>,
  control: Control
) {
  startBefore(root);
  await tabThrough(
    TAB_ORDER.slice(0, TAB_ORDER.indexOf(control) + 1).map(
      name => controls[name]
    )
  );
}

/** The table's cell selection of the database, if any. */
function cellSelection() {
  const host = window.editor.host as EditorHost;
  const held = host.std.selection.value.find(
    selection => selection.type === 'database'
  ) as { viewSelection?: { selectionType?: string; isEditing?: boolean } };
  return held?.viewSelection;
}

/**
 * Keyboard focus on `control` while a cell is selected: the selection came
 * from a click, so a plain `focus()` would be a pointer focus; a key that
 * nothing binds (Shift) first makes the page's modality the keyboard's, as
 * for a reader who tabs on from there.
 */
async function keyboardFocus(control: HTMLElement) {
  await userEvent.keyboard('{Shift}');
  control.focus();
  expect(control.matches(':focus-visible'), 'keyboard focus').toBe(true);
}

/** Where the table's cell selection stands: its row, and whether it edits. */
function cellState() {
  const held = cellSelection() as
    | { focus?: { rowIndex: number }; isEditing?: boolean }
    | undefined;
  return { row: held?.focus?.rowIndex, editing: held?.isEditing };
}

/** A real click on the first row's first cell, then out of its editing. */
async function selectCell(block: HTMLElement) {
  const cell = block.querySelector<HTMLElement>(
    'dv-table-view-cell-container, affine-database-virtual-cell-container'
  )!;
  await userEvent.click(cell);
  await until(() =>
    expect(cellSelection()?.selectionType, 'a cell selected').toBe('area')
  );
  if (cellSelection()?.isEditing) {
    await userEvent.keyboard('{Escape}');
    await until(() => expect(cellSelection()?.isEditing).toBe(false));
  }
}

const rowTexts = (model: DatabaseBlockModel) =>
  model.children.map(row =>
    (row as unknown as { props: { text: Text } }).props.text.toString()
  );

describe('the view toolbar of an inline table, from the keyboard', () => {
  test('Tab and Shift+Tab walk its controls in visual order, each named, focused visibly', async () => {
    const { block, controls } = await mountInline();
    const toolbar = toolbarOf(block)!;
    await until(() =>
      expect(
        getComputedStyle(toolbar).opacity,
        'inline, the toolbar waits for the pointer at rest'
      ).toBe('0')
    );

    const order = TAB_ORDER.map(name => controls[name]);
    startBefore(block);
    const visited = await order.reduce<
      Promise<{ name: string; outline: string; width: string }[]>
    >(async previous => {
      const seen = await previous;
      await userEvent.keyboard('{Tab}');
      const control = order[seen.length];
      await until(() => isFocused(control));
      await until(() => expect(getComputedStyle(toolbar).opacity).toBe('1'));
      const style = getComputedStyle(control);
      return [
        ...seen,
        {
          name: accessibleName(control),
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
    expect(visited.map(step => [step.outline, step.width])).toEqual(
      order.map(() => ['solid', '2px'])
    );

    await tabThrough(order.slice(0, -1).reverse(), true);
  });

  test('Enter and Space open the filter menu, the arrows walk it, Escape gives the focus back', async () => {
    const { block, controls } = await mountInline();
    await tabTo(block, controls, 'filter');

    await ['{Enter}', ' '].reduce<Promise<void>>(async (previous, key) => {
      await previous;
      await userEvent.keyboard(key);
      await until(() => expect(openMenus(), key).toHaveLength(1));
      expect(controls.filter.getAttribute('aria-expanded')).toBe('true');
      await userEvent.keyboard('{ArrowDown}');
      await until(() =>
        expect(
          openMenus()[0].querySelector('.affine-menu-button.focused'),
          'an item focused by the arrows'
        ).not.toBe(null)
      );
      await userEvent.keyboard('{Escape}');
      await until(() => expect(openMenus()).toHaveLength(0));
      await until(() => isFocused(controls.filter));
      expect(controls.filter.getAttribute('aria-expanded')).toBe('false');
    }, Promise.resolve());
  });

  test('Space and Enter open the sort menu, Escape gives the focus back', async () => {
    const { block, controls } = await mountInline();
    await tabTo(block, controls, 'sort');

    await [' ', '{Enter}'].reduce<Promise<void>>(async (previous, key) => {
      await previous;
      await userEvent.keyboard(key);
      await until(() => expect(openMenus(), key).toHaveLength(1));
      await userEvent.keyboard('{Escape}');
      await until(() => expect(openMenus()).toHaveLength(0));
      await until(() => isFocused(controls.sort));
    }, Promise.resolve());
  });

  // The view settings open on the view's name, selected for a rename: the
  // shared menu's field takes a first Escape to leave it (`MenuInput`), the
  // second closes the menu.
  test('Enter and Space open the view settings, Escape leaves the name, then gives the focus back', async () => {
    const { block, controls } = await mountInline();
    await tabTo(block, controls, 'viewOptions');

    await ['{Enter}', ' '].reduce<Promise<void>>(async (previous, key) => {
      await previous;
      await userEvent.keyboard(key);
      await until(() => expect(openMenus(), key).toHaveLength(1));
      expect(controls.viewOptions.getAttribute('aria-expanded')).toBe('true');
      // The name field takes the focus two frames after the menu opens.
      await until(() =>
        expect(
          document.activeElement?.closest('affine-menu-input')
        ).toBeTruthy()
      );
      await userEvent.keyboard('{Escape}');
      expect(openMenus(), 'still open, out of the name').toHaveLength(1);
      await userEvent.keyboard('{Escape}');
      await until(() => expect(openMenus()).toHaveLength(0));
      await until(() => isFocused(controls.viewOptions));
      expect(controls.viewOptions.getAttribute('aria-expanded')).toBe('false');
    }, Promise.resolve());
  });

  test('search opens into its field with Enter or Space, Escape clears it, then gives the focus back', async () => {
    const { block, controls } = await mountInline();
    const field = toolbarOf(block)!.querySelector<HTMLInputElement>(
      '.affine-database-search-input'
    )!;
    await tabTo(block, controls, 'search');

    await ['{Enter}', ' '].reduce<Promise<void>>(async (previous, key) => {
      await previous;
      await userEvent.keyboard(key);
      await until(() => isFocused(field));
      expect(controls.search.getAttribute('aria-expanded')).toBe('true');

      await userEvent.keyboard('x');
      await until(() => expect(field.value).toBe('x'));
      await userEvent.keyboard('{Escape}');
      await until(() =>
        expect(field.value, 'the first Escape clears').toBe('')
      );
      isFocused(field);

      await userEvent.keyboard('{Escape}');
      await until(() => isFocused(controls.search));
      expect(controls.search.getAttribute('aria-expanded')).toBe('false');
    }, Promise.resolve());
  });

  // One key per mount: the new row's title takes the focus a frame later.
  test.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('%s on New adds one row', async (_name, key) => {
    const { block, model, controls } = await mountInline();
    await tabTo(block, controls, 'newRecord');
    const rows = model.children.length;

    await userEvent.keyboard(key);
    await until(() => expect(model.children.length).toBe(rows + 1));
    await new Promise(resolve => requestAnimationFrame(resolve));
    expect(model.children.length, 'one row, not two').toBe(rows + 1);
  });

  test('Enter and Space on the arrow beside New ask the host for its menu', async () => {
    const { block, open, controls } = await mountInline();
    await tabTo(block, controls, 'newRecordMenu');

    await userEvent.keyboard('{Enter}');
    await until(() => expect(open).toHaveBeenCalledTimes(1));
    await userEvent.keyboard(' ');
    await until(() =>
      expect(open).toHaveBeenCalledTimes(['Enter', 'Space'].length)
    );
    expect(open.mock.calls.map(([request]) => request.anchor)).toEqual([
      controls.newRecordMenu,
      controls.newRecordMenu,
    ]);
  });
});

describe('the view toolbar while a cell of the table is selected', () => {
  test('Tab and Shift+Tab still walk the toolbar', async () => {
    const { block, controls } = await mountInline();
    await selectCell(block);
    await keyboardFocus(controls.filter);

    await tabThrough([controls.sort, controls.search, controls.viewOptions]);
    await tabThrough([controls.search, controls.sort], true);
    expect(cellSelection()?.selectionType, 'the cell stays selected').toBe(
      'area'
    );
  });

  test('a letter or Backspace on a control leaves the cell alone', async () => {
    const { block, model, controls } = await mountInline();
    await selectCell(block);
    const before = rowTexts(model);
    await keyboardFocus(controls.filter);

    await userEvent.keyboard('q');
    await userEvent.keyboard('{Backspace}');
    await userEvent.keyboard('{Delete}');
    await userEvent.keyboard('{ArrowDown}');
    isFocused(controls.filter);
    expect(cellSelection()?.isEditing, 'the cell not in editing').toBe(false);
    expect(rowTexts(model)).toEqual(before);
  });

  test('typing in the search field then Tab leaves the field', async () => {
    const { block, model, controls } = await mountInline();
    await selectCell(block);
    const before = rowTexts(model);
    const field = toolbarOf(block)!.querySelector<HTMLInputElement>(
      '.affine-database-search-input'
    )!;
    await keyboardFocus(controls.search);
    await userEvent.keyboard('{Enter}');
    await until(() => isFocused(field));

    await userEvent.keyboard('al');
    await until(() => expect(field.value).toBe('al'));
    await userEvent.keyboard('{Tab}');
    await until(() => isFocused(controls.viewOptions));
    expect(rowTexts(model)).toEqual(before);
  });
});

describe('the view keys after a mouse gesture on the toolbar', () => {
  test('a click on Filter, the menu closed by a click: the arrows move the cell, a letter edits it', async () => {
    const { block, controls } = await mountInline();
    await selectCell(block);
    expect(cellState()).toEqual({ row: 0, editing: false });

    await userEvent.click(controls.filter);
    await until(() => expect(openMenus()).toHaveLength(1));
    const modal = openMenus()[0].parentElement!;
    await userEvent.click(modal, { position: { x: 2, y: 2 } });
    await until(() => expect(openMenus()).toHaveLength(0));
    expect(
      document.activeElement?.matches(':focus-visible') &&
        toolbarOf(block)!.contains(document.activeElement),
      'no keyboard focus in the toolbar'
    ).toBe(false);

    await userEvent.keyboard('{ArrowDown}');
    await until(() => expect(cellState().row, 'the arrow moved it').toBe(1));
    await userEvent.keyboard('q');
    await until(() =>
      expect(cellState().editing, 'the letter edits it').toBe(true)
    );
  });

  test('a click on the arrow beside New takes no focus, and a letter still edits the cell', async () => {
    const { block, controls, open } = await mountInline();
    await selectCell(block);

    await userEvent.click(controls.newRecordMenu);
    await until(() => expect(open).toHaveBeenCalledTimes(1));
    expect(
      toolbarOf(block)!.contains(document.activeElement),
      'the focus left where it was, out of the toolbar'
    ).toBe(false);

    await userEvent.keyboard('q');
    await until(() =>
      expect(cellState().editing, 'the letter edits it').toBe(true)
    );
  });
});

describe('the view toolbar of a kanban', () => {
  test('Tab walks its controls in visual order', async () => {
    const { block, controls } = await mountInline('kanban');
    startBefore(block);
    await tabThrough(TAB_ORDER.map(name => controls[name]));
  });
});

type DatabasePage = HTMLElement & {
  store: Store;
  extensions: ExtensionType[];
  hostBlockId: string;
  heading: HTMLElement | null;
};

type Title = HTMLElement & {
  doc: Store;
  bodyBlockId: string | undefined;
  inlineEditor: { focusEnd(): void } | null;
};

describe('the view toolbar of a database opened as the page', () => {
  async function mountFullPage() {
    const open = vi.fn<(request: DatabaseNewRowMenuRequest) => void>();
    cleanup = await setupEditor('page', [
      DatabaseNewRowMenuExtension({ open }),
    ]);
    const { id } = writeDatabase();
    const app = window.editor.parentElement!;
    const extensions = window.editor.pageSpecs;
    window.editor.remove();
    const page = document.createElement('affine-database-page') as DatabasePage;
    page.style.height = '500px';
    page.store = doc;
    page.extensions = extensions;
    page.hostBlockId = id;
    const title = document.createElement('doc-title') as Title;
    title.doc = doc;
    title.bodyBlockId = id;
    page.heading = title;
    app.append(page);
    const previous = cleanup;
    cleanup = () => {
      page.remove();
      previous();
    };
    const database = await until(() => {
      const element = page.querySelector<HTMLElement>(
        'affine-database[data-standalone]'
      );
      expect(element && toolbarOf(element), 'the page toolbar').toBeTruthy();
      expect(title.inlineEditor, 'the title').toBeTruthy();
      return element!;
    });
    await parkPointer();
    return { title, database };
  }

  test('is shown at rest', async () => {
    const { database } = await mountFullPage();
    await until(() =>
      expect(getComputedStyle(toolbarOf(database)!).opacity).toBe('1')
    );
  });

  test('is reached with Tab from the title after the views bar, and Shift+Tab goes back to it', async () => {
    const { title, database } = await mountFullPage();
    const controls = controlsOf(database);
    // The views bar comes first: the view's tab and "+" (its own spec,
    // `database-bars-keyboard.spec.ts`), then the toolbar.
    const views = [
      database.querySelector<HTMLElement>('[data-testid="database-view-tab"]')!,
      database.querySelector<HTMLElement>(
        '[data-testid="database-add-view-button"]'
      )!,
    ];
    const order = [...views, ...TAB_ORDER.map(name => controls[name])];
    title.inlineEditor!.focusEnd();
    await until(() =>
      expect(title.contains(document.activeElement)).toBe(true)
    );

    await tabThrough(order);
    await tabThrough(order.slice(0, -1).reverse(), true);
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await until(() =>
      expect(title.contains(document.activeElement)).toBe(true)
    );
  });
});
