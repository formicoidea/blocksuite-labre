import { DatabaseBlockDataSource } from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { pointerMoveTo } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **The views bar and the quick-setting bar of a database are driven from
 * the keyboard** (#678's follow-up; WCAG 2.1.1, 2.4.3, 2.4.7, 4.1.2).
 *
 * 4.1.0 drove the view toolbar from the keyboard but left out, beside it,
 * the view tabs and the "+" that adds a view (Tab went straight from the
 * title to Filter), and the chips of the quick-setting bar: a filter or a
 * sort created from the keyboard could be neither edited nor removed from
 * it. Real keystrokes (Playwright's keyboard), one mount, every step in
 * sequence: the suite shares one page and a mount costs seconds.
 *
 * What it would have caught:
 * - a tab or "+" skipped by Tab, reached out of visual order, or without
 *   the toolbar's focus ring;
 * - "+" not opening its menu from Enter, Escape leaving the focus on the
 *   body, or "+" not saying its menu is open (`aria-expanded`);
 * - Enter on another view's tab not making it current, or dropping the
 *   focus on the body when the view drawn next redraws the bar; Enter on
 *   the current tab not opening its menu;
 * - the sort chip or the filter chip skipped by Tab, their menu not opening
 *   from Enter, their "Delete" out of the arrows' reach, or the focus left
 *   on the body once the chip they removed is gone.
 *
 * Names, roles, the read-only bar, the view's keys kept out and the pointer
 * press are in `database/block/…/views-bar-keyboard.unit.spec.ts`; the
 * toolbar itself in `database-toolbar-keyboard.spec.ts`.
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

/** More stops than the toolbar and the bar hold: a Tab loop's bound. */
const STOPS_MAX = 12;

/** More entries than a chip's menu holds: an arrow loop's bound. */
const MENU_ENTRIES_MAX = 12;

const until = <T>(check: () => T) =>
  vi.waitFor(check, { timeout: PATIENCE_MS });

/** Two views: a current tab and another one. */
const VIEW_COUNT = 2;

/** A note holding a database with two table views, a column and two rows. */
function writeDatabase() {
  const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  const id = doc.addBlock(
    'affine:database',
    { title: new Text('Portfolio') },
    noteId
  );
  const model = doc.getModelById(id) as DatabaseBlockModel;
  const writer = new DatabaseBlockDataSource(model);
  Array.from({ length: VIEW_COUNT }).forEach(() =>
    writer.viewManager.viewAdd('table')
  );
  writer.propertyAdd('end');
  ['Alpha', 'Beta'].forEach(() => writer.rowAdd('end'));
  writer.dispose();
  doc.resetHistory();
  return { id, model };
}

/** The suite shares one page: the pointer rests away from the database. */
async function parkPointer() {
  pointerRest = document.createElement('div');
  pointerRest.id = 'dv-bars-pointer-rest';
  Object.assign(pointerRest.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '24px',
    height: '24px',
    zIndex: '100000',
  });
  document.body.append(pointerRest);
  await pointerMoveTo('#dv-bars-pointer-rest', CENTRE, CENTRE);
}

const openMenus = () => [...document.querySelectorAll('affine-menu')];

const active = () => document.activeElement as HTMLElement | null;

/** Focused from the keyboard, ringed as the toolbar's controls are. */
function expectKeyboardFocus(element: HTMLElement | null, what: string) {
  expect(active(), what).toBe(element);
  expect(element!.matches(':focus-visible'), `${what}, visibly`).toBe(true);
  expect(getComputedStyle(element!).outlineStyle, `${what}, ringed`).toBe(
    'solid'
  );
}

async function press(keys: string, landsOn: () => HTMLElement | null) {
  await userEvent.keyboard(keys);
  await until(() => expect(active()).toBe(landsOn()));
}

/** Real Tabs until `target()` holds the focus, at most `STOPS_MAX`. */
async function tabUntil(target: () => HTMLElement | null, left = STOPS_MAX) {
  if (target() && active() === target()) return;
  expect(left, 'reached with Tab').toBeGreaterThan(0);
  await userEvent.keyboard('{Tab}');
  return tabUntil(target, left - 1);
}

/** ArrowDown in the open menu until `selector` is its highlighted entry. */
async function arrowTo(selector: string, left = MENU_ENTRIES_MAX) {
  const focused = openMenus()
    .at(-1)
    ?.querySelector('.affine-menu-button.focused');
  if (focused?.matches(selector)) return;
  expect(left, `${selector} reached with the arrows`).toBeGreaterThan(0);
  await userEvent.keyboard('{ArrowDown}');
  return arrowTo(selector, left - 1);
}

/**
 * Enter on a menu control, then the first entry its menu highlights. A new
 * sort then opens its panel on the chip (`thenPanel`): Escape closes it.
 */
async function createFromMenu(control: HTMLElement, thenPanel = false) {
  expect(active()).toBe(control);
  await userEvent.keyboard('{Enter}');
  await until(() => expect(openMenus()).toHaveLength(1));
  await arrowTo('*');
  await userEvent.keyboard('{Enter}');
  if (thenPanel) {
    await until(() =>
      expect(document.querySelector('affine-menu sort-root-view')).not.toBe(
        null
      )
    );
    await userEvent.keyboard('{Escape}');
  }
  await until(() => expect(openMenus()).toHaveLength(0));
  await until(() => expect(active(), 'back on its control').toBe(control));
}

/** Enter on a chip, then its menu's "Delete" with the arrows. */
async function deleteFromChip(chip: HTMLElement, opensOnField = false) {
  await userEvent.keyboard('{Enter}');
  await until(() => expect(openMenus()).toHaveLength(1));
  expect(chip.getAttribute('aria-expanded'), 'its menu said open').toBe('true');
  if (opensOnField) {
    // A text filter's menu opens on its value's field, as the view settings
    // on their name: the menu's own model, Escape leaves the field first.
    await until(() =>
      expect(active()?.closest('affine-menu-input')).not.toBe(null)
    );
    await userEvent.keyboard('{Escape}');
    await until(() =>
      expect(active()?.closest('affine-menu-input')).toBe(null)
    );
    expect(openMenus(), 'the menu stays').toHaveLength(1);
  }
  await arrowTo('.delete-item');
  await userEvent.keyboard('{Enter}');
  await until(() => expect(openMenus()).toHaveLength(0));
}

describe('the views bar and the quick-setting bar of a database', () => {
  test('from the keyboard: tabs, "+", then a sort and a filter created, reached and removed', async () => {
    cleanup = await setupEditor('page');
    const { id, model } = writeDatabase();
    const block = await until(() => {
      const element = window.editor.host!.querySelector<HTMLElement>(
        `affine-database[data-block-id="${id}"]`
      );
      expect(
        element?.querySelector('[data-testid="dv-tools-view-options"]'),
        'the database header, drawn'
      ).toBeTruthy();
      return element!;
    });
    await parkPointer();
    const [tableId, secondId] = model.props.views.map(view => view.id);
    const tab = (viewId: string) =>
      block.querySelector<HTMLElement>(
        `[data-testid="database-view-tab"][data-view-id="${viewId}"]`
      );
    const one = (selector: string) => () =>
      block.querySelector<HTMLElement>(selector);
    const add = one('[data-testid="database-add-view-button"]');
    const filter = one('[data-testid="dv-tools-filter"]');
    const sort = one('[data-testid="dv-tools-sort"]');
    const viewOptions = one('[data-testid="dv-tools-view-options"]');
    const sortChip = one('data-view-component-button.data-view-sort-button');
    const filterChip = one('[data-testid="dv-filter-condition"]');

    // Inside a document only text precedes the bar, whose Tab the editor
    // keeps to indent: a native button stands for the control before it.
    const start = document.createElement('button');
    start.textContent = 'start';
    block.querySelector('data-view-header-views')!.before(start);
    start.focus();

    // The tabs, "+", then the toolbar, in visual order, each ringed.
    const order: [() => HTMLElement | null, string][] = [
      [() => tab(tableId!), 'the current tab'],
      [() => tab(secondId!), 'the other tab'],
      [add, '"+"'],
      [filter, 'Filter'],
    ];
    await order.reduce<Promise<void>>(async (previous, [target, what]) => {
      await previous;
      await press('{Tab}', target);
      expectKeyboardFocus(target(), what);
    }, Promise.resolve());
    expect(tab(tableId!)!.getAttribute('aria-current')).toBe('true');

    // "+": Enter opens its menu, Escape gives the focus back.
    await press('{Shift>}{Tab}{/Shift}', add);
    await userEvent.keyboard('{Enter}');
    await until(() =>
      expect(
        document.querySelector('[data-testid="database-add-view-preset"]')
      ).not.toBe(null)
    );
    expect(add()!.getAttribute('aria-expanded')).toBe('true');
    await userEvent.keyboard('{Escape}');
    await until(() => expect(openMenus()).toHaveLength(0));
    await until(() => expect(active()).toBe(add()));
    expect(add()!.getAttribute('aria-expanded')).toBe('false');
    expect(model.props.views, 'no view added').toHaveLength(VIEW_COUNT);

    // Another view's tab: Enter makes it current, its tab keeps the focus;
    // Enter again opens its menu, which gives the focus back.
    await press('{Shift>}{Tab}{/Shift}', () => tab(secondId!));
    await userEvent.keyboard('{Enter}');
    await until(() =>
      expect(tab(secondId!)?.getAttribute('aria-current')).toBe('true')
    );
    await until(() => expectKeyboardFocus(tab(secondId!), 'the picked tab'));
    await userEvent.keyboard('{Enter}');
    await until(() => expect(openMenus()).toHaveLength(1));
    // The menu opens on the view's name: Escape leaves it, then closes.
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Escape}');
    await until(() => expect(openMenus()).toHaveLength(0));
    await until(() => expect(active()).toBe(tab(secondId!)));

    // A filter and a sort, created from the toolbar with the keyboard.
    await tabUntil(filter);
    await createFromMenu(filter()!);
    await tabUntil(sort);
    await createFromMenu(sort()!, true);
    const second = () => model.props.views.find(v => v.id === secondId)!;
    await until(() => {
      expect(
        (second() as unknown as { filter: { conditions: unknown[] } }).filter
          .conditions
      ).toHaveLength(1);
      expect(
        (second() as unknown as { sort: { sortBy: unknown[] } }).sort.sortBy
      ).toHaveLength(1);
    });

    // Their chips, after the toolbar: each reached, opened, emptied, and
    // the focus lands on "⋯" once the chip it was on is gone.
    await tabUntil(sortChip);
    expectKeyboardFocus(sortChip(), 'the sort chip');
    await deleteFromChip(sortChip()!);
    await until(() => expect(active()).toBe(viewOptions()));

    await tabUntil(filterChip);
    expectKeyboardFocus(filterChip(), 'the filter chip');
    await deleteFromChip(filterChip()!, true);
    await until(() => expect(active()).toBe(viewOptions()));
    expect(
      (second() as unknown as { filter: { conditions: unknown[] } }).filter
        .conditions
    ).toHaveLength(0);
    start.remove();
  });
});
