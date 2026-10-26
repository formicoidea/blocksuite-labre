import { DatabaseBlockDataSource } from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import type { ExtensionType, Store } from '@labre/store';
import { Text } from '@labre/store';
import { afterEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **A database's full page is one scroller, its column header natively
 * sticky** (ADR 0035 amendment of 2026-10-26; labre recette of the same
 * day).
 *
 * What it would have caught:
 * - a second vertical scroller inside the page (the host's viewport around
 *   the page's, or the table's wrapper), two scrollbars on a long table;
 * - the column header put back by data-view's script on each scroll (a
 *   transform a frame late, which jumped), instead of sticking to the top
 *   of the page by itself;
 * - the page title scrolling out sideways when a wide table scrolls the
 *   page.
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

async function mountLongTable() {
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
  for (let i = 0; i < 6; i++) writer.propertyAdd('end');
  for (let i = 0; i < 40; i++) writer.rowAdd('end');
  writer.dispose();

  const app = window.editor.parentElement!;
  const extensions = window.editor.pageSpecs;
  window.editor.remove();
  const title = document.createElement('doc-title') as HTMLElement & {
    doc: Store;
    bodyBlockId: string;
  };
  title.doc = doc;
  title.bodyBlockId = hostId;
  const page = document.createElement('affine-database-page') as DatabasePage;
  page.style.height = '500px';
  page.style.width = '600px';
  page.store = doc;
  page.extensions = extensions;
  page.hostBlockId = hostId;
  page.heading = title;
  app.append(page);
  await wait(300);
  const previous = cleanup;
  cleanup = () => {
    page.remove();
    previous();
  };
  const viewport = page.querySelector<HTMLElement>(
    ':scope > .affine-page-viewport'
  )!;
  return { page, viewport, title };
}

const scrollers = (root: HTMLElement) =>
  [root, ...root.querySelectorAll<HTMLElement>('*')].filter(el => {
    const style = getComputedStyle(el);
    const scrolls = (overflow: string) => /auto|scroll/.test(overflow);
    return (
      (scrolls(style.overflowY) && el.scrollHeight > el.clientHeight + 1) ||
      (scrolls(style.overflowX) && el.scrollWidth > el.clientWidth + 1)
    );
  });

describe('the full page of a database', () => {
  test('scrolls as one page, both ways', async () => {
    const { page, viewport } = await mountLongTable();
    expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
    expect(scrollers(page)).toEqual([viewport]);
  });

  test('keeps the column header at the top, by itself', async () => {
    const { page, viewport } = await mountLongTable();
    const header = page.querySelector<HTMLElement>(
      'affine-database-column-header'
    )!;
    viewport.scrollTop = 400;
    await wait(100);
    const top = viewport.getBoundingClientRect().top;
    expect(
      Math.round(header.getBoundingClientRect().top - top),
      'stuck to the top of the page'
    ).toBe(0);
    expect(header.style.transform, 'no scripted offset').toBe('');
  });

  test('keeps the page title in view when the page scrolls sideways', async () => {
    const { viewport, title } = await mountLongTable();
    viewport.scrollLeft = 200;
    await wait(100);
    expect(
      Math.round(
        title.getBoundingClientRect().left -
          viewport.getBoundingClientRect().left
      )
    ).toBe(0);
  });
});
