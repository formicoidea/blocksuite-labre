import type { DatabaseBlockComponent } from '@labre/affine/blocks/database';
import { DatabaseBlockDataSource } from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import { Text } from '@labre/store';
import { afterEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **The views bar draws as many tabs as its width allows, the rest under
 * "N more", and the current view is always a tab** (ADR 0035 B11, labre PRD
 * REQ-DB-7).
 *
 * `views-bar-overflow.unit.spec.ts` (data-view) holds the layout rule over
 * plain numbers. This spec measures the real bar: a database with eight
 * long-named views is mounted in a page editor at the suite's 1024px, then
 * with its bar squeezed to a phone-like width. At each width the drawn tabs
 * plus "N more" and "+" fit inside the bar, "N more" counts exactly the
 * views without a tab, the last view selected keeps its tab, and "N more"
 * lists the hidden views and opens one as a tab. Nothing is written by
 * drawing, measuring or switching.
 */

const VIEW_COUNT = 8;

function writeDatabase() {
  const note = doc.addBlock('affine:note', {}, doc.root!.id);
  const id = doc.addBlock(
    'affine:database',
    { title: new Text('Portfolio') },
    note
  );
  const model = doc.getModelById(id) as DatabaseBlockModel;
  const writer = new DatabaseBlockDataSource(model);
  writer.rowAdd('end');
  for (let i = 0; i < VIEW_COUNT; i++) writer.viewManager.viewAdd('table');
  doc.updateBlock(model, {
    views: model.props.views.map((view, index) => ({
      ...view,
      name: `Quarterly review ${index + 1}`,
    })) as never,
  });
  writer.dispose();
  return { id, model };
}

const snapshot = (model: DatabaseBlockModel) =>
  JSON.parse(JSON.stringify(model.props.views)) as unknown;

function bar(block: DatabaseBlockComponent) {
  const element = block.querySelector<HTMLElement>('data-view-header-views');
  expect(element, 'the views bar').not.toBe(null);
  return element!;
}

function drawnTabs(block: DatabaseBlockComponent) {
  return [
    ...bar(block).querySelectorAll<HTMLElement>(
      '.component-overflow-item:not(.hidden) [data-testid="database-view-tab"]'
    ),
  ];
}

function more(block: DatabaseBlockComponent) {
  return bar(block).querySelector<HTMLElement>(
    '[data-testid="database-views-more"]'
  );
}

function expectLayout(block: DatabaseBlockComponent) {
  const tabs = drawnTabs(block);
  const hidden = VIEW_COUNT - tabs.length;
  const box = bar(block).getBoundingClientRect();
  expect(tabs.length, 'some tabs are drawn').toBeGreaterThan(0);
  expect(hidden, 'some views are under "N more"').toBeGreaterThan(0);
  expect(more(block)?.textContent?.trim()).toBe(`${hidden} more`);
  const add = bar(block).querySelector<HTMLElement>(
    '[data-testid="database-add-view-button"]'
  );
  expect(add, '"+" stays beside "N more"').not.toBe(null);
  for (const element of [...tabs, more(block)!, add!]) {
    const rect = element.getBoundingClientRect();
    expect(rect.right).toBeLessThanOrEqual(box.right + 1);
  }
  const current = block.dataSource.viewManager.currentViewId$.value;
  expect(
    tabs.map(tab => tab.dataset.viewId),
    'the current view keeps its tab'
  ).toContain(current);
  return { tabs, hidden };
}

async function mount() {
  const cleanup = await setupEditor('page');
  const written = writeDatabase();
  await wait(150);
  const block = editor.host?.querySelector<DatabaseBlockComponent>(
    `affine-database[data-block-id="${written.id}"]`
  );
  expect(block, 'the database block').not.toBe(null);
  return { cleanup, block: block!, ...written };
}

async function selectLast(block: DatabaseBlockComponent) {
  const views = block.dataSource.viewManager.views$.value;
  block.dataSource.viewManager.setCurrentView(views[views.length - 1]);
  await wait(150);
}

describe('the views bar', () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test('at 1024px: tabs, then "N more", and the last view keeps its tab', async () => {
    const mounted = await mount();
    cleanup = mounted.cleanup;
    const before = snapshot(mounted.model);

    expectLayout(mounted.block);
    await selectLast(mounted.block);
    expectLayout(mounted.block);

    expect(snapshot(mounted.model)).toEqual(before);
  });

  test('at a narrow width: fewer tabs, still inside the bar', async () => {
    const mounted = await mount();
    cleanup = mounted.cleanup;
    const before = snapshot(mounted.model);
    const wide = expectLayout(mounted.block);

    const element = bar(mounted.block);
    element.style.flex = 'none';
    element.style.width = '320px';
    await wait(200);
    const narrow = expectLayout(mounted.block);
    expect(narrow.tabs.length).toBeLessThan(wide.tabs.length);

    await selectLast(mounted.block);
    expectLayout(mounted.block);

    expect(snapshot(mounted.model)).toEqual(before);
  });

  test('"N more" lists the hidden views and opens one as a tab', async () => {
    const mounted = await mount();
    cleanup = mounted.cleanup;
    const { hidden } = expectLayout(mounted.block);

    more(mounted.block)!.click();
    await wait(150);
    const items = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-testid="database-views-more-item"]'
      ),
    ];
    expect(items.length).toBe(hidden);

    const target = items[items.length - 1]!;
    target.click();
    await wait(200);
    const views = mounted.block.dataSource.viewManager.views$.value;
    expect(mounted.block.dataSource.viewManager.currentViewId$.value).toBe(
      views[views.length - 1]
    );
    expectLayout(mounted.block);
  });

  test('"+" offers the four creatable layouts, gallery and list included', async () => {
    const mounted = await mount();
    cleanup = mounted.cleanup;
    bar(mounted.block)
      .querySelector<HTMLElement>('[data-testid="database-add-view-button"]')!
      .click();
    await wait(150);
    const items = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-testid="database-add-view-preset"]'
      ),
    ];
    const names = items.map(item => item.textContent?.trim());
    expect(names).toEqual([
      'Table View',
      'Kanban View',
      'Gallery View',
      'List View',
    ]);

    // Picking one closes the menu and adds that view, current and a tab.
    items[3]!.click();
    await wait(200);
    const current = mounted.block.dataSource.viewManager.currentView$.value;
    expect(current?.type).toBe('list');
    expect(mounted.model.props.views).toHaveLength(VIEW_COUNT + 1);
    expect(
      document.querySelector('[data-testid="database-add-view-preset"]')
    ).toBe(null);
  });
});
