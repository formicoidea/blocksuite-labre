/**
 * A destructive menu entry reads as one before it is hovered, and the menu
 * panel takes the floating-menu radius of the shell (#677, design audit
 * P2-20).
 *
 * `.affine-menu-button.delete-item` was styled under `:hover` only, so
 * "Delete" in a database column, view, row or card menu was drawn like every
 * other entry until the pointer reached it; the panel had 4px corners where
 * every floating menu of the shell has 8px.
 *
 * The styles are read back computed, from a menu really mounted (the light-DOM
 * sheets go to `document.adoptedStyleSheets`), with the theme variables set on
 * the root to sentinel values: the label and the icon must take the error
 * variable with no hover, while a plain entry keeps the primary text colour.
 * The icon is read on the `<svg>` itself, whose paths fill with
 * `currentColor`. A row holding a popup open (`.active` on its host, set by
 * `popupTargetFromElement`) takes the danger background, not the grey wash of
 * any other active row; `:hover` itself is out of happy-dom's reach.
 */
import { DeleteIcon, DuplicateIcon } from '@blocksuite/icons/lit';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';

import { effects } from '../context-menu/index.js';
import { Menu } from '../context-menu/menu.js';
import { menu } from '../context-menu/menu-all.js';

const ERROR = 'rgb(201, 12, 34)';
const TEXT = 'rgb(17, 18, 19)';
const ICON = 'rgb(51, 52, 53)';
const ERROR_BACKGROUND = 'rgb(255, 236, 238)';
const HOVER = 'rgb(240, 240, 240)';

const THEME: Record<string, string> = {
  '--affine-error-color': ERROR,
  '--affine-text-primary-color': TEXT,
  '--affine-icon-color': ICON,
  '--affine-background-error-color': ERROR_BACKGROUND,
  '--affine-hover-color': HOVER,
};

beforeAll(() => {
  effects();
  Object.entries(THEME).forEach(([name, value]) =>
    document.documentElement.style.setProperty(name, value)
  );
});

afterAll(() => {
  Object.keys(THEME).forEach(name =>
    document.documentElement.style.removeProperty(name)
  );
});

beforeEach(() => {
  document.body.replaceChildren();
});

/** Lets Lit render the menu and its rows, as the sibling specs do. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0));
};

async function openMenu() {
  const m = new Menu({
    items: [
      menu.action({
        name: 'Duplicate',
        prefix: DuplicateIcon(),
        select: () => {},
        testId: 'plain',
      }),
      menu.action({
        name: 'Delete',
        prefix: DeleteIcon(),
        select: () => {},
        class: { 'delete-item': true },
        testId: 'delete',
      }),
    ],
  });
  document.body.append(m.menuElement);
  await settle();
  const row = (testId: string) => {
    const element = document.querySelector<HTMLElement>(
      `[data-testid="${testId}"]`
    );
    if (!element) throw new Error(`no row ${testId}`);
    return {
      element,
      label: element.querySelector<HTMLElement>('.affine-menu-action-text')!,
      icon: element.querySelector<SVGElement>('svg')!,
    };
  };
  return { panel: m.menuElement, row };
}

describe('context menu, destructive entry and panel radius (#677)', () => {
  test('a delete-item entry is drawn in the error colour at rest, label and icon', async () => {
    const { row } = await openMenu();
    const deleteRow = row('delete');

    expect(getComputedStyle(deleteRow.label).color).toBe(ERROR);
    expect(getComputedStyle(deleteRow.icon).color).toBe(ERROR);
  });

  test('a delete-item entry holding a popup open takes the error background', async () => {
    const { row } = await openMenu();
    const deleteRow = row('delete');
    deleteRow.element.closest('affine-menu-button')!.classList.add('active');

    expect(getComputedStyle(deleteRow.element).backgroundColor).toBe(
      ERROR_BACKGROUND
    );
  });

  test('a plain entry keeps the primary text and icon colours', async () => {
    const { row } = await openMenu();
    const plainRow = row('plain');

    expect(getComputedStyle(plainRow.label).color).toBe(TEXT);
    expect(getComputedStyle(plainRow.icon).color).toBe(ICON);
  });

  test('the menu panel has 8px corners', async () => {
    const { panel } = await openMenu();

    expect(getComputedStyle(panel).borderRadius).toBe('8px');
  });
});
