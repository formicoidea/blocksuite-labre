import { DatabaseBlockDataSource } from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import type { ExtensionType, Store } from '@labre/store';
import { Text } from '@labre/store';
import { afterEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **A database derives its standalone layout from the page it is drawn in**
 * (ADR 0035 amendment of 2026-10-28).
 *
 * Drawn by the full page's root under a `<doc-title>` naming it as its body,
 * the block hides its own title row, drops its top margin
 * (`data-standalone`) and its table sticks its column header to the page
 * (`data-page-layout`). Anywhere else it is the inline database of 0.61.
 * The look used to be rules of the full page's root, whatever its heading.
 *
 * What it would have caught:
 * - the database's own title row « Portfolio ⋯ » under the page title that
 *   already names it (P7, 2026-10-16), or the margin between them;
 * - a full page mounted without a heading losing the database's name: the
 *   root hid the title row anyway;
 * - an inline table taking the page's layout (its column header no longer
 *   following the scroll), or the page layout missing when the heading
 *   arrives after the page mounted;
 * - anything written to measure the layout.
 */

type DatabasePage = HTMLElement & {
  store: Store;
  extensions: ExtensionType[];
  hostBlockId: string;
  heading: HTMLElement | null;
};

type Title = HTMLElement & { doc: Store; bodyBlockId: string | undefined };

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

/** A note holding a database with a table of 40 rows, as a base's document. */
function writeDatabase() {
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
  for (let i = 0; i < 2; i++) writer.propertyAdd('end');
  for (let i = 0; i < 40; i++) writer.rowAdd('end');
  writer.dispose();
  doc.resetHistory();
  return hostId;
}

function heading(hostId: string) {
  const title = document.createElement('doc-title') as Title;
  title.doc = doc;
  title.bodyBlockId = hostId;
  return title;
}

/** The full page, as a host mounts it; `writes` counts every block update. */
async function mountFullPage(withHeading: boolean) {
  cleanup = await setupEditor('page');
  const hostId = writeDatabase();
  const app = window.editor.parentElement!;
  const extensions = window.editor.pageSpecs;
  window.editor.remove();
  const counter = { writes: 0 };
  const watch = doc.slots.blockUpdated.subscribe(() => counter.writes++);
  const page = document.createElement('affine-database-page') as DatabasePage;
  page.style.height = '500px';
  page.store = doc;
  page.extensions = extensions;
  page.hostBlockId = hostId;
  page.heading = withHeading ? heading(hostId) : null;
  app.append(page);
  await wait(300);
  const previous = cleanup;
  cleanup = () => {
    watch.unsubscribe();
    page.remove();
    previous();
  };
  return { page, hostId, counter };
}

const databaseIn = (root: ParentNode) =>
  root.querySelector<HTMLElement>('affine-database')!;

const titleRow = (database: HTMLElement) =>
  database.querySelector('affine-database-title')!.parentElement!;

const tableOf = (database: HTMLElement) =>
  database.querySelector<HTMLElement>('dv-table-view-ui')!;

function scrollContainerOf(element: HTMLElement) {
  let node: HTMLElement | null = element;
  while (node && !/auto|scroll/.test(getComputedStyle(node).overflowY)) {
    node = node.parentElement;
  }
  return node ?? document.body;
}

describe('a database on its full page, under its heading', () => {
  test('is laid out as the page: no title row, no top margin, a page table', async () => {
    const { page, counter } = await mountFullPage(true);
    const database = databaseIn(page);
    expect(database.hasAttribute('data-standalone')).toBe(true);
    expect(getComputedStyle(titleRow(database)).display).toBe('none');
    expect(getComputedStyle(database).marginTop).toBe('0px');
    expect(getComputedStyle(database).paddingTop).toBe('0px');
    expect(tableOf(database).hasAttribute('data-page-layout')).toBe(true);
    expect(counter.writes, 'nothing written').toBe(0);
  });

  test('takes the layout when the heading arrives after the page mounted', async () => {
    const { page, hostId, counter } = await mountFullPage(false);
    const database = databaseIn(page);
    expect(database.hasAttribute('data-standalone')).toBe(false);

    page.heading = heading(hostId);
    await wait(200);
    expect(database.hasAttribute('data-standalone')).toBe(true);
    expect(getComputedStyle(titleRow(database)).display).toBe('none');
    expect(tableOf(database).hasAttribute('data-page-layout')).toBe(true);
    expect(counter.writes, 'nothing written').toBe(0);
  });
});

describe('a database on its full page without a heading', () => {
  test('renders as inline, its title shown, and writes nothing', async () => {
    const { page, counter } = await mountFullPage(false);
    const database = databaseIn(page);
    expect(database.hasAttribute('data-standalone')).toBe(false);
    expect(getComputedStyle(titleRow(database)).display).toBe('flex');
    expect(tableOf(database).hasAttribute('data-page-layout')).toBe(false);
    expect(counter.writes, 'nothing written').toBe(0);
  });
});

describe('the same database inline in a page', () => {
  test('keeps its title, and its column header follows the scroll', async () => {
    cleanup = await setupEditor('page');
    writeDatabase();
    await wait(300);
    const database = databaseIn(window.editor);
    // The page's own scroller, short enough for the table to scroll in it.
    const scroller = scrollContainerOf(database);
    scroller.style.height = '500px';
    expect(database.hasAttribute('data-standalone')).toBe(false);
    expect(getComputedStyle(titleRow(database)).display).toBe('flex');
    const table = tableOf(database);
    expect(table.hasAttribute('data-page-layout')).toBe(false);

    const header = table.querySelector<HTMLElement>(
      'affine-database-column-header'
    )!;
    const group = header.closest<HTMLElement>('affine-data-view-table-group')!;
    scroller.scrollTop +=
      group.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      300;
    await wait(200);
    expect(header.style.transform, 'put back by the script').toMatch(
      /^translate3d\(0(px)?,\s*[1-9]/
    );
  });
});
