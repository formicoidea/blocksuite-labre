import { DatabaseBlockDataSource } from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import type { ExtensionType, Store } from '@labre/store';
import { Text } from '@labre/store';
import { page, userEvent } from '@vitest/browser/context';
import { afterAll, describe, expect, test, vi } from 'vitest';

import { setupEditor } from '../utils/setup.js';

/**
 * **A menu never runs past the window: every entry can be seen and picked,
 * with the mouse and with the keyboard** (product owner's acceptance of the
 * database work: "the menu is in overflow-hidden mode when the number of
 * rows in the base is not large enough").
 *
 * A base of three rows on its full page, in a window too short for the
 * column menu under or over its header. Menus are placed `fixed` against
 * the window (`POPUP_STRATEGY`): a tall page let the reader scroll the
 * header up and the menu with it, a short one had nothing to scroll, and
 * the entries past the window's bottom ("Duplicate", "Delete") could not be
 * reached at all.
 *
 * What it would have caught:
 * - a menu taller than the room on its side running past the window
 *   instead of being capped there and scrolling inside itself;
 * - its last entry unreachable by a real click;
 * - the arrows moving the highlight to an entry the panel does not show.
 */

/** The suite's frame, given back at the end (`isolate: false`). */
const FRAME_WIDTH = 1024;
const FRAME_HEIGHT = 768;
/** Too short for the column menu on either side of its header. */
const SHORT_HEIGHT = 420;
/** A border's rounding. */
const EPSILON = 1;

/** A loaded machine may take seconds to lay out a page. */
const PATIENCE_MS = 5000;

const until = <T>(check: () => T) =>
  vi.waitFor(check, { timeout: PATIENCE_MS });

type DatabasePage = HTMLElement & {
  store: Store;
  extensions: ExtensionType[];
  hostBlockId: string;
  heading: HTMLElement | null;
};

type Title = HTMLElement & { doc: Store; bodyBlockId: string | undefined };

let cleanup: (() => void) | undefined;

afterAll(async () => {
  cleanup?.();
  await page.viewport(FRAME_WIDTH, FRAME_HEIGHT);
});

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
  return { header, source, status };
}

const lastMenu = () => [...document.querySelectorAll('affine-menu')].at(-1);

/** The part of `element` the window shows, as its rect clipped to it. */
function shown(element: Element) {
  const rect = element.getBoundingClientRect();
  return {
    top: Math.max(rect.top, 0),
    bottom: Math.min(rect.bottom, window.innerHeight),
    rect,
  };
}

async function openHeaderMenu(header: HTMLElement) {
  await userEvent.click(header);
  return until(() => {
    const menu = lastMenu();
    expect(menu, 'the column menu').toBeTruthy();
    return menu!;
  });
}

describe('a column menu on a short base, in a short window', () => {
  test('stays inside the window, scrolls, and reaches its last entry with the arrows and the mouse', async () => {
    const { header, source, status } = await mountShortBase();
    await page.viewport(FRAME_WIDTH, SHORT_HEIGHT);

    const menu = await openHeaderMenu(header);
    await until(() => {
      const { rect } = shown(menu);
      expect(rect.top, 'the panel starts in the window').toBeGreaterThanOrEqual(
        -EPSILON
      );
      expect(rect.bottom, 'the panel ends in the window').toBeLessThanOrEqual(
        window.innerHeight + EPSILON
      );
    });
    expect(
      menu.scrollHeight,
      'taller than the window allows: it scrolls inside itself'
    ).toBeGreaterThan(menu.clientHeight);

    // The name field takes the focus first; Escape leaves it to the list.
    await until(() =>
      expect(document.activeElement?.closest('affine-menu')).toBe(menu)
    );
    await userEvent.keyboard('{Escape}');
    const entries = [
      ...menu.querySelectorAll<HTMLElement>('[data-focusable="true"]'),
    ];
    await userEvent.keyboard('{ArrowDown}'.repeat(entries.length));
    const last = entries.at(-1)!;
    await until(() => {
      expect(menu.querySelector('.focused')?.closest('[data-focusable]')).toBe(
        last
      );
      const entry = last.getBoundingClientRect();
      const panel = menu.getBoundingClientRect();
      expect(
        entry.top,
        'the highlighted entry is shown'
      ).toBeGreaterThanOrEqual(panel.top - EPSILON);
      expect(entry.bottom).toBeLessThanOrEqual(
        Math.min(panel.bottom, window.innerHeight) + EPSILON
      );
    });
    await userEvent.keyboard('{Escape}');
    await until(() => expect(lastMenu()).toBeUndefined());

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
});
