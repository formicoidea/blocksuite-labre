import { DatabaseBlockDataSource } from '@labre/affine/blocks/database';
import { runViewAction } from '@labre/affine/host-panels';
import type { DatabaseBlockModel } from '@labre/affine/model';
import type { BlockStdScope } from '@labre/std';
import type { ExtensionType, Store } from '@labre/store';
import { Text } from '@labre/store';
import { page } from '@vitest/browser/context';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **The layout picker of a base fits a phone** (labre recette P7-21, "Bases
 * lisibles sur téléphone", 390px).
 *
 * The view settings' "Layout" lists Table, Gallery, List and Kanban as a row
 * of tiles. On a phone the menu is a bottom sheet as wide as the screen.
 *
 * What it would have caught:
 * - the four tiles kept on one line that neither wraps nor shrinks (each
 *   tile its label's width plus 32px of padding), which pushed the row past
 *   the edge of the 390px sheet;
 * - a tile, or its label, wider than the room the sheet gives it;
 * - the fix leaking to a wide screen, where the picker stays one row.
 *
 * The sheet is the real `mobile-menu`, mounted on the very menu the action
 * opened: `IS_MOBILE` reads the user agent once, so this desktop suite never
 * pops it itself.
 */

type DatabasePage = HTMLElement & {
  store: Store;
  extensions: ExtensionType[];
  hostBlockId: string;
  std: BlockStdScope | undefined;
};

let databasePage: DatabasePage;
let cleanup: () => void;

beforeEach(async () => {
  cleanup = await setupEditor('page');
  const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  const hostId = doc.addBlock(
    'affine:database',
    { title: new Text('Portfolio') },
    noteId
  );
  const writer = new DatabaseBlockDataSource(
    doc.getModelById(hostId) as DatabaseBlockModel
  );
  writer.viewManager.viewAdd('table');
  writer.rowAdd('end');
  writer.dispose();

  const app = window.editor.parentElement!;
  const extensions = window.editor.pageSpecs;
  window.editor.remove();
  databasePage = document.createElement('affine-database-page') as DatabasePage;
  databasePage.style.height = '600px';
  databasePage.store = doc;
  databasePage.extensions = extensions;
  databasePage.hostBlockId = hostId;
  app.append(databasePage);
  await wait(200);
  return () => {
    databasePage.remove();
    cleanup();
  };
});

afterEach(async () => {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  document.querySelectorAll('affine-menu, mobile-menu').forEach(menu => {
    menu.remove();
  });
  document.querySelector('[data-testid="layout-picker-phone"]')?.remove();
  // The suite shares one page (`isolate: false`): give it its frame back.
  await page.viewport(1024, 768);
});

async function openLayoutMenu() {
  await runViewAction(databasePage.std!, 'database.view.layout');
  await wait(150);
  const menu = document.querySelector<HTMLElement & { menu: unknown }>(
    'affine-menu'
  );
  expect(menu, 'the layout menu').not.toBe(null);
  return menu!;
}

function tiles(row: Element) {
  return [...row.querySelectorAll<HTMLElement>('affine-menu-button')];
}

/** How many lines the tiles of `row` take. */
function lines(row: Element) {
  return new Set(
    tiles(row).map(tile => Math.round(tile.getBoundingClientRect().top))
  ).size;
}

function expectInside(row: HTMLElement, frame: DOMRect) {
  expect(row.scrollWidth, 'the row overflows').toBeLessThanOrEqual(
    row.clientWidth
  );
  for (const tile of tiles(row)) {
    const box = tile.getBoundingClientRect();
    expect(box.left).toBeGreaterThanOrEqual(frame.left);
    expect(box.right).toBeLessThanOrEqual(frame.right);
    const button = tile.querySelector<HTMLElement>('.affine-menu-button')!;
    expect(button.scrollWidth, tile.textContent ?? '').toBeLessThanOrEqual(
      button.clientWidth
    );
  }
}

describe('the layout picker of a base', () => {
  test('wraps two by two inside a 390px phone sheet', async () => {
    await page.viewport(390, 844);
    const menu = await openLayoutMenu();

    const phone = document.createElement('div');
    phone.dataset.testid = 'layout-picker-phone';
    phone.style.cssText =
      'position: fixed; left: 0; top: 0; width: 390px; height: 844px; z-index: 1000;';
    const sheet = document.createElement('mobile-menu') as HTMLElement & {
      menu: unknown;
    };
    sheet.menu = menu.menu;
    phone.append(sheet);
    document.body.append(phone);
    await wait(100);

    const row = sheet.querySelector<HTMLElement>(
      '[data-testid="dv-layout-picker"]'
    );
    expect(row, 'the picker, in the sheet').not.toBe(null);
    expect(tiles(row!)).toHaveLength(4);
    expect(lines(row!)).toBe(2);
    expectInside(row!, sheet.getBoundingClientRect());
  });

  test('stays inside a 390px viewport as a popover', async () => {
    await page.viewport(390, 844);
    const menu = await openLayoutMenu();
    const row = menu.querySelector<HTMLElement>(
      '[data-testid="dv-layout-picker"]'
    )!;
    expectInside(row, new DOMRect(0, 0, 390, 844));
  });

  test('is still one row on a wide screen', async () => {
    const menu = await openLayoutMenu();
    const row = menu.querySelector<HTMLElement>(
      '[data-testid="dv-layout-picker"]'
    )!;
    expect(tiles(row)).toHaveLength(4);
    expect(lines(row)).toBe(1);
    expectInside(row, menu.getBoundingClientRect());
  });
});
