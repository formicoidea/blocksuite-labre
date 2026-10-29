import {
  addProperty,
  type DatabaseBlockComponent,
  databaseBlockProperties,
} from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine-model';
import { Text } from '@labre/store';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * A view's « Properties » list as a property manager, in a real editor (PO
 * decision of 2026-10-14). The unit spec drives the list over a stand-in
 * source; this one proves that, from a kanban (no column header), a row
 * opens the table header's own menu and its edits reach the stored source,
 * that « New property » adds a column to the block, and that the table
 * header, whose menu now comes from the same builder, still opens it.
 *
 * What it would have caught:
 * - a rename from the list that the table, another view of the same
 *   source, does not show (written to the view instead of the source);
 * - « New property » adding nothing to `model.props.columns`, or not
 *   opening the new property's menu;
 * - a delete from the list leaving the column in the block;
 * - the table header's menu losing its own entries (filter, sort, insert)
 *   or the shared ones (duplicate, delete) in the move to one builder;
 * - in a host's narrow left sidebar (labre, about 470px), a property's menu
 *   drawn over the list it edits, or its « Type » sub-menu half off screen
 *   (labre recette of 1.1): the menu sits beside the list, both inside the
 *   viewport.
 */

const settle = async () => {
  await wait(100);
  for (let i = 0; i < 4; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

const menuButton = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('affine-menu-button')].find(
    button => button.textContent?.includes(name)
  );

const lastMenuText = () =>
  [...document.querySelectorAll('affine-menu')].at(-1)?.textContent ?? '';

const closeMenus = () => {
  for (const layer of document.querySelectorAll(
    'body > [data-range-sync-exclude]'
  )) {
    layer.remove();
  }
};

describe('the properties list of a view', () => {
  let model!: DatabaseBlockModel;
  let status!: string;
  let cleanup: (() => void) | undefined;

  const block = () =>
    document.querySelector<DatabaseBlockComponent>(
      `affine-database[data-block-id="${model.id}"]`
    )!;

  const openProperties = async (viewId: string) => {
    block().dataSource.viewManager.setCurrentView(viewId);
    await settle();
    block()
      .querySelector<HTMLElement>(
        'data-view-header-tools-view-options .more-action'
      )!
      .click();
    await settle();
    menuButton('Properties')!.click();
    await settle();
    const list = document.querySelector<HTMLElement>(
      'data-view-properties-setting'
    );
    if (!list) throw new Error('the properties list is not drawn');
    return list;
  };

  const rowOf = (list: HTMLElement, id: string) =>
    list.querySelector<HTMLElement>(
      `[data-testid="data-view-property-item"][data-property-id="${id}"]`
    )!;

  beforeEach(async () => {
    cleanup = await setupEditor('page');
    const doc = window.doc;
    const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
    const databaseId = doc.addBlock(
      'affine:database',
      { columns: [], title: new Text('Plan') },
      noteId
    );
    model = doc.getModelById(databaseId) as DatabaseBlockModel;
    status = addProperty(
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
        { id: 'table-1', name: 'Table', mode: 'table', columns, filter },
        {
          id: 'kanban-1',
          name: 'Board',
          mode: 'kanban',
          columns,
          filter,
          groupBy: { type: 'groupBy', columnId: status, name: 'select' },
          header: {},
        },
      ],
    } as never);
    await settle();
  });

  afterEach(() => {
    closeMenus();
    cleanup?.();
    cleanup = undefined;
  });

  test('a kanban row renames the property for every view', async () => {
    const list = await openProperties('kanban-1');
    rowOf(list, status).click();
    await settle();
    expect(lastMenuText()).toContain('Delete');

    const input = document.querySelector<HTMLInputElement>(
      'affine-menu-input input'
    )!;
    expect(input.value).toBe('Status');
    input.value = 'Phase';
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    await settle();

    expect(model.props.columns.find(c => c.id === status)?.name).toBe('Phase');
    closeMenus();
    block().dataSource.viewManager.setCurrentView('table-1');
    await settle();
    expect(
      block().querySelector(
        `affine-database-header-column[data-column-id="${status}"]`
      )?.textContent
    ).toContain('Phase');
  });

  test('« New property » adds a column to the source and opens its menu', async () => {
    const list = await openProperties('kanban-1');
    const before = model.props.columns.length;
    list
      .querySelector<HTMLElement>('[data-testid="data-view-properties-new"]')!
      .click();
    await settle();
    menuButton('Number')!.click();
    await settle();

    expect(model.props.columns).toHaveLength(before + 1);
    const added = model.props.columns.at(-1)!;
    expect(added.type).toBe('number');
    expect(rowOf(list, added.id)).not.toBeNull();
    expect(lastMenuText()).toContain('Delete');
    expect(
      document.querySelector<HTMLInputElement>('affine-menu-input input')?.value
    ).toBe(added.name);
  });

  test('a delete from the list removes the column from the block', async () => {
    const list = await openProperties('kanban-1');
    rowOf(list, status).click();
    await settle();
    menuButton('Delete')!.click();
    await settle();
    expect(model.props.columns.some(c => c.id === status)).toBe(false);
  });

  test('the table header still opens its full menu', async () => {
    block().dataSource.viewManager.setCurrentView('table-1');
    await settle();
    block()
      .querySelector<HTMLElement>(
        `affine-database-header-column[data-column-id="${status}"] .affine-database-column-content`
      )!
      .click();
    await settle();
    const menu = lastMenuText();
    for (const entry of [
      'Hide In View',
      'Filter',
      'Sort Ascending',
      'Insert Left Column',
      'Duplicate',
      'Delete',
    ]) {
      expect(menu).toContain(entry);
    }
  });

  test('in a narrow left sidebar, the menu sits beside the list, its Type menu on screen', async () => {
    block().dataSource.viewManager.setCurrentView('kanban-1');
    await settle();
    // The list as a host mounts it in its left sidebar.
    const sidebar = document.createElement('div');
    Object.assign(sidebar.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '470px',
      height: '100%',
      zIndex: '10',
      background: 'white',
    });
    const list = document.createElement(
      'data-view-properties-setting'
    ) as HTMLElement & { view: unknown };
    list.view = block().dataSource.viewManager.currentView$.value!;
    sidebar.append(list);
    document.body.append(sidebar);
    try {
      await settle();
      const row = rowOf(list, status);
      row.click();
      await settle();
      const menus = () => [...document.querySelectorAll('affine-menu')];
      const propertyMenu = menus().at(-1)!.getBoundingClientRect();
      const listBox = list.getBoundingClientRect();
      // Beside the list, not over its rows.
      expect(propertyMenu.left).toBeGreaterThanOrEqual(listBox.right - 1);
      expect(propertyMenu.right).toBeLessThanOrEqual(window.innerWidth);

      const type = [
        ...document.querySelectorAll<HTMLElement>('affine-menu-sub-menu'),
      ].find(entry => entry.textContent?.includes('Type'))!;
      type.click();
      await settle();
      const typeMenu = menus().at(-1)!.getBoundingClientRect();
      expect(typeMenu.left).toBeGreaterThanOrEqual(0);
      expect(typeMenu.top).toBeGreaterThanOrEqual(0);
      expect(typeMenu.right).toBeLessThanOrEqual(window.innerWidth);
      expect(typeMenu.bottom).toBeLessThanOrEqual(window.innerHeight);
      // Beside the property menu, not over it, and not back over the list.
      const overlaps =
        typeMenu.left < propertyMenu.right &&
        typeMenu.right > propertyMenu.left;
      expect(overlaps).toBe(false);
      expect(typeMenu.left).toBeGreaterThanOrEqual(listBox.right - 1);
    } finally {
      sidebar.remove();
    }
  });
});
