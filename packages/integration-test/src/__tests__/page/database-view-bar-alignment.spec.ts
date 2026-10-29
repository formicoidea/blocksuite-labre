import { DatabaseBlockDataSource } from '@labre/affine/blocks/database';
import type { DatabaseBlockModel, RootBlockModel } from '@labre/affine/model';
import type { ExtensionType, Store } from '@labre/store';
import { Text } from '@labre/store';
import { afterEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **The view bar, the title and the rows share one left edge** (labre
 * recette of 1.1).
 *
 * What it would have caught:
 * - the first tab's icon drawn 4px right of the database title and of the
 *   rows (the tab's own padding, which its hover background needs);
 * - on the full page, a table wide enough for the page layout dropping the
 *   root's centring: the view bar and the rows started left of the centred
 *   page heading (40px in this 1024px frame).
 */

type DatabasePage = HTMLElement & {
  store: Store;
  extensions: ExtensionType[];
  hostBlockId: string;
  heading: HTMLElement | null;
};

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function writeDatabase() {
  (doc.root as RootBlockModel).props.title.insert('Page', 0);
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
  writer.viewManager.viewAdd('kanban');
  writer.viewManager.setCurrentView(writer.viewManager.views$.value[0]!);
  for (let i = 0; i < 3; i++) writer.rowAdd('end');
  writer.dispose();
  return hostId;
}

/** The left edge of the first text `root` draws. */
function textLeft(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect().left;
  }
  throw new Error('no text');
}

function edges(database: HTMLElement) {
  const icon = database.querySelector('.database-view-button .icon')!;
  const row = database.querySelector('data-view-table-row')!;
  return {
    tabIcon: icon.getBoundingClientRect().left,
    row: row.getBoundingClientRect().left,
  };
}

describe('the view bar left edge', () => {
  test('inline: the first tab icon and the rows under the database title', async () => {
    cleanup = await setupEditor('page');
    writeDatabase();
    await wait(400);
    const database =
      window.editor.querySelector<HTMLElement>('affine-database')!;
    const title = textLeft(database.querySelector('affine-database-title')!);
    const { tabIcon, row } = edges(database);
    expect(Math.abs(tabIcon - title), 'tab icon').toBeLessThanOrEqual(1);
    expect(Math.abs(row - title), 'rows').toBeLessThanOrEqual(1);
  });

  test('full page: the first tab icon and the rows under the page heading', async () => {
    cleanup = await setupEditor('page');
    const hostId = writeDatabase();
    const app = window.editor.parentElement!;
    const extensions = window.editor.pageSpecs;
    window.editor.remove();
    const heading = document.createElement('doc-title') as HTMLElement & {
      doc: Store;
      bodyBlockId: string | undefined;
    };
    heading.doc = doc;
    heading.bodyBlockId = hostId;
    const page = document.createElement('affine-database-page') as DatabasePage;
    page.style.height = '500px';
    page.store = doc;
    page.extensions = extensions;
    page.hostBlockId = hostId;
    page.heading = heading;
    app.append(page);
    const previous = cleanup;
    cleanup = () => {
      page.remove();
      previous();
    };
    await wait(400);
    const database = page.querySelector<HTMLElement>('affine-database')!;
    expect(database.hasAttribute('data-standalone')).toBe(true);
    const title = textLeft(heading);
    const { tabIcon, row } = edges(database);
    expect(Math.abs(tabIcon - title), 'tab icon').toBeLessThanOrEqual(1);
    expect(Math.abs(row - title), 'rows').toBeLessThanOrEqual(1);
    // Nothing overflows sideways for a table narrower than the page.
    const viewport = page.querySelector<HTMLElement>('.affine-page-viewport')!;
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  });
});
