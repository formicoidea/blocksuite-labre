import {
  addProperty,
  type DatabaseBlockComponent,
  databaseBlockProperties,
} from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import {
  DataSourcePickerExtension,
  type DataSourcePickerService,
  type DataSourcePickerSourcePolicy,
} from '@labre/affine/shared/services';
import { Text } from '@labre/store';
import { type Signal, signal } from '@preact/signals-core';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * GUARD — a host may lock a source's properties and its new rows (ADR 0035
 * amendment of 2026-10-29), in a real editor: a database of the host
 * (`externalSourceId`) whose views read source `s1`, with the host's
 * `sourcePolicy` signal flipped while the views are open. The unit spec
 * (`database/block/…/source-policy.unit.spec.ts`) holds the refused writes;
 * this one holds the chrome.
 *
 * What it would have caught:
 * - a 1.1 host (no `sourcePolicy`) losing any control;
 * - the table header's "+", its menu's rename, type, insert, duplicate and
 *   delete, or the properties list's « New property » still offered on a
 *   source whose properties are locked, or the menu not saying why;
 * - "New", its menu, the table's "+ New Record", a board's "Add" and a
 *   group's "+" still offered on a source that takes no new row, or "New"
 *   vanishing without its reason;
 * - a flip of the host's switch needing a reload to show.
 */

const PLAN_ID = 'host:plan';

const settle = async () => {
  await wait(100);
  for (let i = 0; i < 4; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

const lastMenuText = () =>
  [...document.querySelectorAll('affine-menu')].at(-1)?.textContent ?? '';

const menuButton = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('affine-menu-button')].find(
    button => button.textContent?.includes(name)
  );

const closeMenus = () => {
  for (const layer of document.querySelectorAll(
    'body > [data-range-sync-exclude]'
  )) {
    layer.remove();
  }
};

let cleanup: (() => void) | undefined;

afterEach(() => {
  closeMenus();
  cleanup?.();
  cleanup = undefined;
});

async function mount(withPolicy: boolean) {
  const policy: Signal<DataSourcePickerSourcePolicy> = signal({
    propertiesLocked: false,
    rowsLocked: false,
  });
  const sourcePolicy = vi.fn(() => policy);
  const service: DataSourcePickerService = {
    list: () => signal([]),
    ...(withPolicy ? { sourcePolicy } : {}),
  };
  cleanup = await setupEditor('page', [DataSourcePickerExtension(service)]);
  const doc = window.doc;
  const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  const databaseId = doc.addBlock(
    'affine:database',
    { columns: [], title: new Text('Plan'), externalSourceId: PLAN_ID },
    noteId
  );
  const model = doc.getModelById(databaseId) as DatabaseBlockModel;
  const status = addProperty(
    model,
    'end',
    databaseBlockProperties.selectColumnConfig.create('Status', {
      options: [],
    })
  );
  doc.addBlock('affine:paragraph', { text: new Text('Alpha') }, databaseId);
  const columns = model.props.columns.map(c => ({
    id: c.id,
    hide: false,
    width: 180,
  }));
  const filter = { type: 'group', op: 'and', conditions: [] };
  doc.updateBlock(model, {
    views: [
      {
        id: 'table-1',
        name: 'Table',
        mode: 'table',
        sourceId: 's1',
        columns,
        filter,
      },
      {
        id: 'kanban-1',
        name: 'Board',
        mode: 'kanban',
        sourceId: 's1',
        columns,
        filter,
        groupBy: { type: 'groupBy', columnId: status, name: 'select' },
        header: {},
      },
    ],
  } as never);
  await settle();
  const block = () =>
    document.querySelector<DatabaseBlockComponent>(
      `affine-database[data-block-id="${model.id}"]`
    )!;
  const show = async (viewId: string) => {
    block().dataSource.viewManager.setCurrentView(viewId);
    await settle();
  };
  const q = (selector: string) => block().querySelector<HTMLElement>(selector);
  const openHeaderMenu = async () => {
    q(
      `affine-database-header-column[data-column-id="${status}"] .affine-database-column-content`
    )!.click();
    await settle();
    return lastMenuText();
  };
  return {
    model,
    status,
    policy,
    sourcePolicy,
    block,
    show,
    q,
    openHeaderMenu,
  };
}

describe('a source whose host locks its properties', () => {
  test('without sourcePolicy, every property control is offered', async () => {
    const { q, openHeaderMenu } = await mount(false);
    expect(q('[data-testid="dv-table-add-column"]')).not.toBeNull();
    const menu = await openHeaderMenu();
    for (const entry of ['Insert Left Column', 'Duplicate', 'Delete']) {
      expect(menu).toContain(entry);
    }
    expect(document.querySelector('affine-menu-input')).not.toBeNull();
    expect(
      document.querySelector('[data-testid="dv-property-locked"]')
    ).toBeNull();
  });

  test('the header, its menu and the properties list offer no schema edit', async () => {
    const { model, policy, sourcePolicy, q, show, openHeaderMenu } =
      await mount(true);
    expect(q('[data-testid="dv-table-add-column"]')).not.toBeNull();

    policy.value = { propertiesLocked: true, rowsLocked: false };
    await settle();
    expect(sourcePolicy).toHaveBeenCalledWith(PLAN_ID, 's1');
    expect(q('[data-testid="dv-table-add-column"]')).toBeNull();

    const menu = await openHeaderMenu();
    expect(menu).toContain('The properties of this source are locked');
    expect(menu).toContain('Hide In View');
    expect(menu).toContain('Sort Ascending');
    for (const entry of ['Insert Left Column', 'Duplicate', 'Delete']) {
      expect(menu).not.toContain(entry);
    }
    expect(document.querySelector('affine-menu-input')).toBeNull();
    closeMenus();

    // The properties list of a board: no « New property ».
    await show('kanban-1');
    q('data-view-header-tools-view-options .more-action')!.click();
    await settle();
    menuButton('Properties')!.click();
    await settle();
    const list = document.querySelector('data-view-properties-setting');
    expect(list).not.toBeNull();
    expect(
      list!.querySelector('[data-testid="data-view-properties-new"]')
    ).toBeNull();
    closeMenus();

    // Rows are not locked: "New" still adds one.
    await show('table-1');
    const rows = model.children.length;
    q('data-view-header-tools-add-row .new-record')!.click();
    await settle();
    expect(model.children.length).toBe(rows + 1);
  });
});

describe('a source whose host blocks new rows', () => {
  test('without sourcePolicy, every row control is offered', async () => {
    const { q, show } = await mount(false);
    expect(q('data-view-header-tools-add-row .new-record')).not.toBeNull();
    expect(q('[data-testid="dv-tools-new-row-locked"]')).toBeNull();
    expect(q('.data-view-table-group-add-row')).not.toBeNull();
    await show('kanban-1');
    expect(q('.add-card')).not.toBeNull();
  });

  test('"New" says why it is off, and no "+" adds a row', async () => {
    const { model, policy, q, show } = await mount(true);
    policy.value = { propertiesLocked: false, rowsLocked: true };
    await settle();

    const locked = q('[data-testid="dv-tools-new-row-locked"]');
    expect(locked).not.toBeNull();
    expect(locked!.getAttribute('title')).toBe(
      'New pages cannot be added to this source'
    );
    expect(locked!.getAttribute('aria-disabled')).toBe('true');
    expect(
      q('data-view-header-tools-add-row .new-record:not(.new-record-locked)')
    ).toBeNull();
    expect(q('[data-testid="database-new-record-more"]')).toBeNull();
    expect(q('.data-view-table-group-add-row')).toBeNull();

    const rows = model.children.length;
    locked!.click();
    await settle();
    expect(model.children.length).toBe(rows);

    await show('kanban-1');
    expect(q('.add-card')).toBeNull();

    // The switch flips back: the controls come back, no reload.
    policy.value = { propertiesLocked: false, rowsLocked: false };
    await settle();
    expect(q('.add-card')).not.toBeNull();
    await show('table-1');
    expect(q('[data-testid="dv-tools-new-row-locked"]')).toBeNull();
    expect(q('.data-view-table-group-add-row')).not.toBeNull();
  });
});
