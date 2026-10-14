import { effects as menuEffects } from '@labre/affine-components/context-menu';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { DataViewPropertiesSettingView } from '../core/common/properties.js';
import { coreEffects } from '../core/effect.js';
import type { PropertyMetaConfig } from '../core/property/property-config.js';
import type { ViewManager } from '../core/view-manager/view-manager.js';
import { propertyPresetsEffects } from '../property-presets/effect.js';
import { propertyPresets } from '../property-presets/index.js';
import { viewPresets } from '../view-presets/index.js';
import { KanbanSingleView } from '../view-presets/kanban/kanban-view-manager.js';
import { TableSingleView } from '../view-presets/table/table-view-manager.js';

/**
 * A view's properties list as a property manager (PO decision of
 * 2026-10-14): the list the view options' "Properties" pops and the
 * database's side panel mounts, for a table and for a kanban, which has no
 * column header to reach a property's menu from.
 *
 * What it would have caught:
 * - a row's click opening nothing, or a menu other than the column header's
 *   (`propertyMenuItems`: rename, type, hide, duplicate, delete);
 * - the eye or the drag bar opening the menu as well as doing their job;
 * - the title offering a delete or a type change the header refuses;
 * - a delete that does not reach the data source (so the other views keep
 *   the property), or a hide that does (it is this view's alone);
 * - "New property" adding without the type picker, adding elsewhere than the
 *   end of the source, or not opening the new property's menu for the
 *   rename;
 * - a read-only view whose rows still open a menu or which still offers
 *   "New property";
 * - the "New property" words not crossing the translation seam.
 */

beforeAll(() => {
  if (!customElements.get('uni-lit')) coreEffects();
  if (!customElements.get('affine-database-text-cell')) {
    propertyPresetsEffects();
  }
  if (!customElements.get('affine-menu')) menuEffects();
});

afterEach(() => {
  document.body.innerHTML = '';
});

const metas: Record<string, PropertyMetaConfig> = {
  title: propertyPresets.textPropertyConfig as unknown as PropertyMetaConfig,
  text: propertyPresets.textPropertyConfig as unknown as PropertyMetaConfig,
  number: propertyPresets.numberPropertyConfig as unknown as PropertyMetaConfig,
};

function setup(options: { mode: 'table' | 'kanban'; readonly?: boolean }) {
  const properties = signal(['title', 'note']);
  const types: Record<string, string> = { title: 'title', note: 'text' };
  const names: Record<string, string> = { title: 'Name', note: 'Note' };
  const viewData = signal<Record<string, unknown>>({
    id: 'view-1',
    name: 'View',
    mode: options.mode,
    columns: properties.value.map(id => ({ id, hide: false })),
    filter: { type: 'group', op: 'and', conditions: [] },
    ...(options.mode === 'kanban'
      ? { groupBy: undefined, header: { titleColumn: 'title' } }
      : {}),
  });
  const viewDataUpdate = vi.fn(
    (
      _id: string,
      updater: (data: Record<string, unknown>) => Record<string, unknown>
    ) => {
      viewData.value = { ...viewData.value, ...updater(viewData.value) };
    }
  );
  const propertyAdd = vi.fn(
    (_position: unknown, ops?: { type?: string; name?: string }) => {
      const id = `p${properties.value.length + 1}`;
      types[id] = ops?.type ?? 'text';
      names[id] = ops?.name ?? 'Property';
      properties.value = [...properties.value, id];
      return id;
    }
  );
  const propertyDelete = vi.fn((id: string) => {
    properties.value = properties.value.filter(p => p !== id);
  });
  const readonly$ = signal(options.readonly ?? false);
  const services = new Map<unknown, unknown>();
  const dataSource = {
    rows$: signal([]),
    properties$: properties,
    readonly$,
    featureFlags$: signal({
      enable_number_formatting: false,
      enable_table_virtual_scroll: false,
    }),
    propertyMetas$: signal([metas.text, metas.number]),
    provider: { getAll: () => new Map() },
    viewDataGet: () => viewData.value,
    viewDataUpdate,
    cellValueGet: () => undefined,
    propertyTypeGet: (id: string) => types[id],
    propertyTypeCanSet: (id: string) => types[id] !== 'title',
    propertyTypeSet: vi.fn(),
    propertyNameGet: (id: string) => names[id],
    propertyNameSet: vi.fn(),
    propertyDataGet: () => ({}),
    propertyReadonlyGet: () => false,
    propertyMetaGet: (type: string) => metas[type],
    propertyAdd,
    propertyDelete,
    propertyCanDelete: (id: string) => types[id] !== 'title',
    propertyDuplicate: vi.fn(),
    propertyCanDuplicate: (id: string) => types[id] !== 'title',
    serviceGet: () => null,
    viewMetaGet: (type: string) =>
      type === 'kanban'
        ? viewPresets.kanbanViewMeta
        : viewPresets.tableViewMeta,
    serviceGetOrCreate: (key: unknown, create: () => unknown) => {
      if (!services.has(key)) services.set(key, create());
      return services.get(key);
    },
  };
  const manager = { dataSource, readonly$ } as unknown as ViewManager;
  const view =
    options.mode === 'table'
      ? new TableSingleView(manager, 'view-1')
      : new KanbanSingleView(manager, 'view-1');
  return { view, viewData, viewDataUpdate, propertyAdd, propertyDelete };
}

async function mount(
  view: TableSingleView | KanbanSingleView,
  wording?: DataViewPropertiesSettingView['wording']
) {
  const list = document.createElement('data-view-properties-setting');
  list.view = view;
  if (wording) list.wording = wording;
  document.body.append(list);
  await settle();
  return list;
}

async function settle() {
  for (let pass = 0; pass < 4; pass++) {
    await Promise.all(
      [...document.body.querySelectorAll('*')]
        .map(
          el =>
            (el as Partial<{ updateComplete: Promise<boolean> }>).updateComplete
        )
        .filter(Boolean)
    );
  }
}

const rowOf = (list: HTMLElement, id: string) =>
  list.querySelector<HTMLElement>(
    `[data-testid="data-view-property-item"][data-property-id="${id}"]`
  )!;

const newRowOf = (list: HTMLElement) =>
  list.querySelector<HTMLElement>('[data-testid="data-view-properties-new"]');

/** The words of the menus open right now, the last one last. */
const openMenus = () =>
  [...document.body.querySelectorAll('affine-menu')].map(
    menu => menu.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  );

const menuButton = (name: string) =>
  [...document.body.querySelectorAll<HTMLElement>('affine-menu-button')].find(
    button => button.textContent?.includes(name)
  );

describe.each(['table', 'kanban'] as const)('the %s properties list', mode => {
  it("opens the property's header menu on a row click", async () => {
    const { view } = setup({ mode });
    const list = await mount(view);

    rowOf(list, 'note').click();
    await settle();

    const menus = openMenus();
    expect(menus).toHaveLength(1);
    for (const entry of ['Type', 'Hide In View', 'Duplicate', 'Delete']) {
      expect(menus[0]).toContain(entry);
    }
    expect(
      document.body.querySelector<HTMLInputElement>('affine-menu-input input')
        ?.value
    ).toBe('Note');
  });

  it('keeps the title to what the header allows', async () => {
    const { view } = setup({ mode });
    const list = await mount(view);

    rowOf(list, 'title').click();
    await settle();

    const [menu] = openMenus();
    expect(menu).toBeDefined();
    expect(menu).not.toContain('Delete');
    expect(menu).not.toContain('Duplicate');
    expect(menu).not.toContain('Hide In View');
    expect(menu).not.toContain('Type');
  });

  it('deletes through the source, hides through the view', async () => {
    const { view, viewDataUpdate, propertyDelete } = setup({ mode });
    const list = await mount(view);

    list
      .querySelector<HTMLElement>(
        `[data-property-id="note"] [data-testid="data-view-property-visibility"]`
      )!
      .click();
    await settle();
    expect(openMenus()).toHaveLength(0);
    expect(viewDataUpdate).toHaveBeenCalledTimes(1);
    expect(view.propertyGetOrCreate('note').hide$.value).toBe(true);

    list
      .querySelector<HTMLElement>(
        '[data-property-id="note"] .property-item-drag-bar'
      )!
      .click();
    await settle();
    expect(openMenus()).toHaveLength(0);

    rowOf(list, 'note').click();
    await settle();
    menuButton('Delete')!.click();
    await settle();
    expect(propertyDelete).toHaveBeenCalledWith('note');
    expect(rowOf(list, 'note')).toBeNull();
  });

  it('adds a property through the type picker, then opens its menu', async () => {
    const { view, propertyAdd } = setup({ mode });
    const list = await mount(view);

    const newRow = newRowOf(list);
    expect(newRow?.textContent).toContain('New property');
    newRow!.click();
    await settle();

    const [picker] = openMenus();
    expect(picker).toContain('Property type');
    expect(picker).toContain(metas.number!.config.name);
    menuButton(metas.number!.config.name)!.click();
    await settle();

    expect(propertyAdd).toHaveBeenCalledWith('end', {
      type: 'number',
      name: metas.number!.config.name,
    });
    expect(rowOf(list, 'p3')).not.toBeNull();
    const menus = openMenus();
    expect(menus.at(-1)).toContain('Delete');
    expect(
      document.body.querySelector<HTMLInputElement>('affine-menu-input input')
        ?.value
    ).toBe(metas.number!.config.name);
  });

  it('is inert when read-only', async () => {
    const { view, propertyAdd } = setup({ mode, readonly: true });
    const list = await mount(view);

    expect(newRowOf(list)).toBeNull();
    rowOf(list, 'note').click();
    await settle();
    expect(openMenus()).toHaveLength(0);
    expect(propertyAdd).not.toHaveBeenCalled();
  });
});

describe('the properties list wording', () => {
  it('resolves "New property" through the opener', async () => {
    const { view } = setup({ mode: 'kanban' });
    const list = await mount(view, ([key]) => `<${key}>`);
    expect(newRowOf(list)?.textContent?.trim()).toBe(
      '<com.labre.data-view.properties.new>'
    );
  });
});
