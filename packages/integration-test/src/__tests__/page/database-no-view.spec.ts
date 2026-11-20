import { DatabaseBlockDataSource } from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import type { ExtensionType, Store } from '@labre/store';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { pointerMoveTo } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **A database whose last view is deleted draws an empty state** (ADR 0035
 * amendment of 2026-11-20, product owner's acceptance report of 4.0).
 *
 * The product owner's path: a base with one view, "⋯" (view settings) ›
 * Delete, or the tab's own menu › Delete. The whole views area went: no
 * tab bar, no "+", no table, only the title; nothing but Ctrl+Z brought a
 * view back. Real mouse and keyboard, the block mounted in the editor.
 *
 * What it would have caught:
 * - after either Delete, no empty state, or one without the database's
 *   title row or without its "New view" button;
 * - that button not giving a table back that is current, with its toolbar,
 *   and editable ("New Record" adds a row);
 * - Ctrl+Z not bringing the view back over the empty state;
 * - the last view deleted from the KEYBOARD leaving the focus on the body
 *   (WCAG 2.4.3) instead of the empty state's button, or that button not
 *   ringed, or not opening its menu with Enter;
 * - deleting one view of two showing anything but the other view;
 * - the full page of a base drawing nothing under its heading.
 *
 * The states without a view (read-only, creation off, a peer, the host's
 * `deleteView`) and the absence of writes are in
 * `database/block/src/__tests__/no-view-state.unit.spec.ts`.
 */

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

/** The middle of a box, for the pointer. */
const CENTRE = 0.5;

/** The view settings list a dozen entries at most before Delete. */
const MENU_ENTRIES_MAX = 20;

/** Retried until it holds: what the spec waits for, never a delay. */
const until = <T>(check: () => T) =>
  vi.waitFor(check, { timeout: PATIENCE_MS });

/**
 * A note holding a paragraph (where Ctrl+Z is typed) and a database with
 * `modes` views and two rows.
 */
function writeDatabase(modes: string[] = ['table']) {
  const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  const paragraphId = doc.addBlock(
    'affine:paragraph',
    { text: new Text('Before the base') },
    noteId
  );
  const id = doc.addBlock(
    'affine:database',
    { title: new Text('Portfolio') },
    noteId
  );
  const model = doc.getModelById(id) as DatabaseBlockModel;
  const writer = new DatabaseBlockDataSource(model);
  modes.forEach(mode => writer.viewManager.viewAdd(mode));
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
  return { id, model, paragraphId };
}

/** The suite shares one page: the pointer rests away from the database. */
async function parkPointer() {
  pointerRest = document.createElement('div');
  pointerRest.id = 'dv-no-view-pointer-rest';
  Object.assign(pointerRest.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '24px',
    height: '24px',
    zIndex: '100000',
  });
  document.body.append(pointerRest);
  await pointerMoveTo('#dv-no-view-pointer-rest', CENTRE, CENTRE);
}

const inBlock = (block: HTMLElement, selector: string) =>
  block.querySelector<HTMLElement>(selector);

const viewOptionsOf = (block: HTMLElement) =>
  inBlock(block, '.affine-database-toolbar-item.more-action');

const emptyStateOf = (block: HTMLElement) =>
  inBlock(block, '[data-testid="database-no-view"]');

const addButtonOf = (block: HTMLElement) =>
  inBlock(block, '[data-testid="database-no-view-add"]');

const openMenus = () => [...document.querySelectorAll('affine-menu')];

const deleteEntry = () =>
  document.querySelector<HTMLElement>('affine-menu .delete-item');

async function mountInline(modes?: string[]) {
  cleanup = await setupEditor('page');
  const written = writeDatabase(modes);
  const block = await until(() => {
    const element = window.editor.host!.querySelector<HTMLElement>(
      `affine-database[data-block-id="${written.id}"]`
    );
    expect(element && viewOptionsOf(element), 'the view settings').toBeTruthy();
    return element!;
  });
  await parkPointer();
  return { ...written, block };
}

/** A real click on "⋯" then on Delete, as the product owner did. */
async function deleteFromViewSettings(block: HTMLElement) {
  await userEvent.click(viewOptionsOf(block)!);
  await until(() => expect(deleteEntry()).not.toBe(null));
  await userEvent.click(deleteEntry()!);
  await until(() => expect(openMenus()).toHaveLength(0));
}

/** The empty state as the reader sees it: title row, status, button. */
async function expectEmptyState(block: HTMLElement, model: DatabaseBlockModel) {
  await until(() => expect(emptyStateOf(block)).not.toBe(null));
  expect(model.props.views).toEqual([]);
  expect(emptyStateOf(block)!.getAttribute('role')).toBe('status');
  expect(emptyStateOf(block)!.textContent).toContain('No view');
  expect(
    inBlock(block, 'affine-database-title')?.textContent,
    'the title row'
  ).toContain('Portfolio');
  expect(inBlock(block, 'data-view-header-tools'), 'no toolbar').toBe(null);
  const button = addButtonOf(block)!;
  expect(button, 'its button').not.toBe(null);
  expect(button.textContent?.trim()).toBe('New view');
  expect(button.getBoundingClientRect().height).toBeGreaterThan(0);
}

/** The button, then the preset of a table, with the mouse. */
async function addTableFromEmptyState(block: HTMLElement) {
  await userEvent.click(addButtonOf(block)!);
  const table = await until(() => {
    const preset = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-testid="database-add-view-preset"]'
      ),
    ].find(item => item.textContent?.includes('Table'));
    expect(preset, 'the table preset').toBeTruthy();
    return preset!;
  });
  await userEvent.click(table);
}

/** The table is back, current, and takes a new row from its toolbar. */
async function expectEditableTable(
  block: HTMLElement,
  model: DatabaseBlockModel
) {
  await until(() => expect(viewOptionsOf(block)).not.toBe(null));
  expect(emptyStateOf(block)).toBe(null);
  expect(model.props.views).toHaveLength(1);
  expect(model.props.views[0]!.mode).toBe('table');
  const rows = model.children.length;
  await userEvent.click(
    inBlock(block, 'data-view-component-button.new-record')!
  );
  await until(() => expect(model.children).toHaveLength(rows + 1));
}

describe('deleting the only view of a database', () => {
  test('from "⋯" › Delete: the empty state, then "New view" gives an editable table back', async () => {
    const { block, model } = await mountInline();

    await deleteFromViewSettings(block);
    await expectEmptyState(block, model);

    await addTableFromEmptyState(block);
    await expectEditableTable(block, model);
  });

  test('from the tab’s own menu › Delete: the same empty state', async () => {
    const { block, model } = await mountInline();
    const tab = inBlock(block, '[data-testid="database-view-tab"]')!;

    // The current view's tab opens its menu on a click.
    await userEvent.click(tab);
    await until(() => expect(deleteEntry()).not.toBe(null));
    await userEvent.click(deleteEntry()!);
    await expectEmptyState(block, model);
  });

  test('Ctrl+Z brings the view back over the empty state', async () => {
    const { block, model, paragraphId } = await mountInline();
    await deleteFromViewSettings(block);
    await expectEmptyState(block, model);

    // The caret in the document, where the editor takes its keys.
    const paragraph = window.editor.host!.querySelector<HTMLElement>(
      `affine-paragraph[data-block-id="${paragraphId}"] [contenteditable="true"]`
    )!;
    await userEvent.click(paragraph);
    await userEvent.keyboard('{Control>}z{/Control}');

    await until(() => expect(viewOptionsOf(block)).not.toBe(null));
    expect(emptyStateOf(block)).toBe(null);
    expect(model.props.views).toHaveLength(1);
  });

  test('from the keyboard, the focus lands on "New view", which opens its menu with Enter', async () => {
    const { block, model } = await mountInline();
    const options = viewOptionsOf(block)!;
    // A key nothing binds makes the page's modality the keyboard's.
    await userEvent.keyboard('{Shift}');
    options.focus();
    expect(options.matches(':focus-visible'), 'keyboard focus').toBe(true);

    await userEvent.keyboard('{Enter}');
    await until(() => expect(openMenus()).toHaveLength(1));
    // The menu opens on the view's name: Escape leaves it, the menu stays.
    await until(() =>
      expect(document.activeElement?.closest('affine-menu-input')).toBeTruthy()
    );
    await userEvent.keyboard('{Escape}');
    const focusedEntry = () =>
      openMenus()[0]?.querySelector('.affine-menu-button.focused');
    const reachDelete = async (left: number): Promise<void> => {
      if (focusedEntry()?.classList.contains('delete-item')) return;
      expect(left, 'Delete reached with the arrows').toBeGreaterThan(0);
      await userEvent.keyboard('{ArrowDown}');
      return reachDelete(left - 1);
    };
    await reachDelete(MENU_ENTRIES_MAX);
    await userEvent.keyboard('{Enter}');

    await expectEmptyState(block, model);
    const button = addButtonOf(block)!;
    await until(() => expect(document.activeElement).toBe(button));
    expect(button.matches(':focus-visible')).toBe(true);
    expect(getComputedStyle(button).outlineStyle).toBe('solid');

    await userEvent.keyboard('{Enter}');
    await until(() =>
      expect(
        document.querySelector('[data-testid="database-add-view-preset"]')
      ).not.toBe(null)
    );
    await userEvent.keyboard('{Escape}');
    await until(() => expect(openMenus()).toHaveLength(0));
    await until(() => expect(document.activeElement).toBe(button));
  });

  test('a mouse deletion moves no focus to the empty state', async () => {
    const { block, model } = await mountInline();
    await deleteFromViewSettings(block);
    await expectEmptyState(block, model);
    expect(document.activeElement).not.toBe(addButtonOf(block));
  });
});

describe('deleting one view of two', () => {
  test('shows the other view, as before', async () => {
    const { block, model } = await mountInline(['table', 'kanban']);
    const kanban = model.props.views[1]!.id;
    // The first view is current on mount: the board's tab makes it current.
    await userEvent.click(
      inBlock(
        block,
        `[data-testid="database-view-tab"][data-view-id="${kanban}"]`
      )!
    );
    await until(() =>
      expect(
        inBlock(block, '[data-testid="database-view-tab"].selected')?.dataset
          .viewId
      ).toBe(kanban)
    );

    await deleteFromViewSettings(block);

    await until(() => expect(model.props.views).toHaveLength(1));
    expect(model.props.views[0]!.mode).toBe('table');
    await until(() =>
      expect(
        inBlock(block, '[data-testid="database-view-tab"].selected')?.dataset
          .viewId
      ).toBe(model.props.views[0]!.id)
    );
    expect(emptyStateOf(block)).toBe(null);
    expect(viewOptionsOf(block)).not.toBe(null);
  });
});

type DatabasePage = HTMLElement & {
  store: Store;
  extensions: ExtensionType[];
  hostBlockId: string;
  heading: HTMLElement | null;
};

type Title = HTMLElement & { doc: Store; bodyBlockId: string | undefined };

describe('the full page of a base', () => {
  test('deleting its only view draws the empty state under the heading', async () => {
    cleanup = await setupEditor('page');
    const { id, model } = writeDatabase();
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
      expect(element && viewOptionsOf(element), 'the page').toBeTruthy();
      return element!;
    });
    await parkPointer();

    await deleteFromViewSettings(database);

    await until(() => expect(emptyStateOf(database)).not.toBe(null));
    expect(model.props.views).toEqual([]);
    expect(
      addButtonOf(database)!.getBoundingClientRect().height
    ).toBeGreaterThan(0);
    await addTableFromEmptyState(database);
    await expectEditableTable(database, model);
  });
});
