import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { coreEffects } from '../core/effect.js';
import type { CellStatus } from '../core/data-source/hydration.js';
import type { FilterGroup } from '../core/filter/types.js';
import type { PropertyMetaConfig } from '../core/property/property-config.js';
import type { Sort } from '../core/sort/types.js';
import type { ViewManager } from '../core/view-manager/view-manager.js';
import { propertyPresetsEffects } from '../property-presets/effect.js';
import { propertyPresets } from '../property-presets/index.js';
import { viewConverts } from '../view-presets/convert.js';
import type { FlatViewDataType } from '../view-presets/flat/flat-view-manager.js';
import { flatViewDefaultData } from '../view-presets/flat/flat-view-manager.js';
import type { FlatViewUILogic } from '../view-presets/flat/flat-view-ui.js';
import { galleryEffects } from '../view-presets/gallery/effect.js';
import {
  GallerySingleView,
  galleryViewModel,
} from '../view-presets/gallery/index.js';
import { GalleryViewUILogic } from '../view-presets/gallery/gallery-view.js';
import { viewPresets } from '../view-presets/index.js';
import { listEffects } from '../view-presets/list/effect.js';
import { ListSingleView, listViewModel } from '../view-presets/list/index.js';
import { ListViewUILogic } from '../view-presets/list/list-view.js';

/**
 * The gallery and list presets (ADR 0035 §1 and §8, issues B6 and B7): a
 * transposition of the table, not a new drawing. A card or a row draws its
 * values with the cell renderers a table cell mounts, reads per-view
 * visibility from the stored `columns[].hide` shape table and kanban use,
 * filters and sorts with the engine's traits, adds a row through the view and
 * opens one through the root's detail panel.
 *
 * What it would have caught:
 * - a preset drawing its own chips or editors instead of the table's cells
 *   (no `affine-database-*-cell` under a card or a row);
 * - a hidden property still drawn, or a visibility stored in a new shape;
 * - a write on mount: the view data or a cell written by merely drawing a
 *   stored gallery or list (nothing is written on load);
 * - a row hidden by a filter on a hidden property still drawn, or a sort
 *   ignored;
 * - a click on a value opening the row instead of editing it, or a click on
 *   the card not opening it;
 * - a read-only view offering "New page" or an editor;
 * - a layout switch into a gallery or a list dropping the filter and sort;
 * - a value a hosted source has not delivered drawn by its renderer, hence
 *   editable over, instead of the table's spinner (ADR 0035 §9e, B2).
 */

beforeAll(() => {
  if (!customElements.get('uni-lit')) coreEffects();
  if (!customElements.get('affine-database-text-cell')) {
    propertyPresetsEffects();
  }
  if (!customElements.get('dv-gallery-view-ui')) galleryEffects();
  if (!customElements.get('dv-list-view-ui')) listEffects();
});

afterEach(() => {
  document.body.innerHTML = '';
});

const metas: Record<string, PropertyMetaConfig> = {
  // No title preset lives in this package: the text cell stands in for it.
  title: propertyPresets.textPropertyConfig as unknown as PropertyMetaConfig,
  text: propertyPresets.textPropertyConfig as unknown as PropertyMetaConfig,
  select: propertyPresets.selectPropertyConfig as unknown as PropertyMetaConfig,
  checkbox:
    propertyPresets.checkboxPropertyConfig as unknown as PropertyMetaConfig,
};

const statusOptions = {
  options: [
    { id: 'todo', value: 'Todo', color: 'var(--affine-tag-blue)' },
    { id: 'done', value: 'Done', color: 'var(--affine-tag-green)' },
  ],
};

function setup(options: {
  mode: 'gallery' | 'list';
  hide?: Record<string, boolean>;
  filter?: FilterGroup;
  sort?: Sort;
  readonly?: boolean;
  cellStatus?: Record<string, CellStatus>;
}) {
  const rows = signal(['r1', 'r2', 'r3']);
  const properties = signal(['title', 'status', 'note', 'done']);
  const types: Record<string, string> = {
    title: 'title',
    status: 'select',
    note: 'text',
    done: 'checkbox',
  };
  const values = new Map<string, unknown>([
    ['r1:title', 'Alpha'],
    ['r1:status', 'todo'],
    ['r1:note', 'first'],
    ['r2:title', 'Bravo'],
    ['r2:status', 'done'],
    ['r2:note', 'second'],
    ['r3:title', 'Charlie'],
  ]);
  const viewData = signal<FlatViewDataType>({
    id: 'view-1',
    name: 'View',
    mode: options.mode,
    columns: properties.value.map(id => ({
      id,
      hide: options.hide?.[id] ?? false,
    })),
    filter: options.filter ?? { type: 'group', op: 'and', conditions: [] },
    ...(options.sort ? { sort: options.sort } : {}),
  });
  const viewDataUpdate = vi.fn(
    (
      _id: string,
      updater: (data: FlatViewDataType) => Partial<FlatViewDataType>
    ) => {
      viewData.value = { ...viewData.value, ...updater(viewData.value) };
    }
  );
  const cellValueChange = vi.fn(
    (rowId: string, propertyId: string, value: unknown) => {
      values.set(`${rowId}:${propertyId}`, value);
    }
  );
  const rowAdd = vi.fn(() => {
    const rowId = `r${rows.value.length + 1}`;
    rows.value = [...rows.value, rowId];
    return rowId;
  });
  const readonly$ = signal(options.readonly ?? false);
  const dataSource = {
    rows$: rows,
    properties$: properties,
    readonly$,
    featureFlags$: signal({
      enable_number_formatting: false,
      enable_table_virtual_scroll: false,
    }),
    viewDataGet: () => viewData.value,
    viewDataUpdate,
    cellValueGet: (rowId: string, propertyId: string) =>
      values.get(`${rowId}:${propertyId}`),
    cellValueChange,
    rowAdd,
    propertyTypeGet: (id: string) => types[id],
    propertyNameGet: (id: string) => id,
    propertyDataGet: (id: string) => (id === 'status' ? statusOptions : {}),
    propertyReadonlyGet: () => false,
    propertyMetaGet: (type: string) => metas[type],
    serviceGet: () => null,
    // As the block's: a mode with no preset is drawn as a table.
    viewMetaGet: (mode: string) =>
      mode === 'gallery'
        ? viewPresets.galleryViewMeta
        : mode === 'list'
          ? viewPresets.listViewMeta
          : viewPresets.tableViewMeta,
    cellStatus: (rowId: string, propertyId: string) =>
      options.cellStatus?.[`${rowId}:${propertyId}`] ?? 'ready',
  };
  const manager = { dataSource, readonly$ } as unknown as ViewManager;
  const view =
    options.mode === 'gallery'
      ? new GallerySingleView(manager, 'view-1')
      : new ListSingleView(manager, 'view-1');
  const openDetailPanel = vi.fn();
  const root = { config: { headerWidget: undefined }, openDetailPanel };
  return {
    view,
    root,
    values,
    viewData,
    viewDataUpdate,
    cellValueChange,
    rowAdd,
    openDetailPanel,
    readonly$,
  };
}

async function mount(context: ReturnType<typeof setup>) {
  const { view, root } = context;
  const logic: FlatViewUILogic =
    view instanceof GallerySingleView
      ? new GalleryViewUILogic(root as never, view)
      : new ListViewUILogic(root as never, view as ListSingleView);
  const tag =
    view instanceof GallerySingleView
      ? 'dv-gallery-view-ui'
      : 'dv-list-view-ui';
  const ui = document.createElement(tag) as HTMLElement & {
    logic: FlatViewUILogic;
    updateComplete: Promise<boolean>;
  };
  ui.logic = logic;
  document.body.append(ui);
  await settle(ui);
  return ui;
}

/** Waits for the view and every Lit element under it, cells included. */
async function settle(root: Element) {
  for (let pass = 0; pass < 4; pass++) {
    const pending = [root, ...root.querySelectorAll('*')]
      .map(
        el =>
          (el as Partial<{ updateComplete: Promise<boolean> }>).updateComplete
      )
      .filter(Boolean);
    await Promise.all(pending);
  }
}

const itemSelector = {
  gallery: '[data-testid="dv-gallery-card"]',
  list: '[data-testid="dv-list-row"]',
};

describe.each(['gallery', 'list'] as const)('the %s preset', mode => {
  it('draws one item per row, its values by the table cells', async () => {
    const context = setup({ mode });
    const ui = await mount(context);
    const items = ui.querySelectorAll<HTMLElement>(itemSelector[mode]);
    expect([...items].map(item => item.dataset.rowId)).toEqual([
      'r1',
      'r2',
      'r3',
    ]);
    const first = items[0];
    expect(first?.querySelector('[data-testid="title"]')).not.toBeNull();
    expect(first?.querySelector('affine-database-select-cell')).not.toBeNull();
    expect(first?.querySelector('affine-database-text-cell')).not.toBeNull();
    expect(first?.textContent).toContain('Alpha');
    expect(first?.textContent).toContain('Todo');
    expect(first?.textContent).toContain('first');
  });

  it('draws no property its view hides', async () => {
    const context = setup({ mode, hide: { status: true, done: true } });
    const ui = await mount(context);
    const first = ui.querySelector(itemSelector[mode]);
    expect(first?.querySelector('[data-property-id="status"]')).toBeNull();
    expect(first?.querySelector('[data-property-id="done"]')).toBeNull();
    expect(first?.querySelector('[data-property-id="note"]')).not.toBeNull();
    expect(first?.textContent).not.toContain('Todo');
  });

  it('stores a hide in the columns[].hide shape table and kanban use', async () => {
    const context = setup({ mode });
    const ui = await mount(context);
    context.view.propertyGetOrCreate('status').hideSet(true);
    await settle(ui);
    expect(context.viewData.value.columns).toEqual([
      { id: 'title', hide: false },
      { id: 'status', hide: true },
      { id: 'note', hide: false },
      { id: 'done', hide: false },
    ]);
    expect(ui.querySelector('[data-property-id="status"]')).toBeNull();
  });

  it('writes nothing on mount', async () => {
    const context = setup({ mode });
    const before = structuredClone(context.viewData.value);
    await mount(context);
    expect(context.viewDataUpdate).not.toHaveBeenCalled();
    expect(context.cellValueChange).not.toHaveBeenCalled();
    expect(context.rowAdd).not.toHaveBeenCalled();
    expect(context.viewData.value).toEqual(before);
  });

  it('filters, hidden properties included, and sorts', async () => {
    const context = setup({
      mode,
      hide: { note: true },
      filter: {
        type: 'group',
        op: 'and',
        conditions: [
          {
            type: 'filter',
            left: { type: 'ref', name: 'note' },
            function: 'isNot',
            args: [{ type: 'literal', value: 'first' }],
          },
        ],
      },
      sort: {
        manuallySort: [],
        sortBy: [{ ref: { type: 'ref', name: 'title' }, desc: true }],
      },
    });
    const ui = await mount(context);
    const ids = [...ui.querySelectorAll<HTMLElement>(itemSelector[mode])].map(
      item => item.dataset.rowId
    );
    expect(ids).toEqual(['r3', 'r2']);
  });

  it('opens a row on a click outside its values, edits on a click on one', async () => {
    const context = setup({ mode });
    const ui = await mount(context);
    const first = ui.querySelector<HTMLElement>(itemSelector[mode]);
    first?.click();
    expect(context.openDetailPanel).toHaveBeenCalledTimes(1);
    expect(context.openDetailPanel.mock.calls[0]?.[0]).toMatchObject({
      rowId: 'r1',
    });
    // The title is drawn read-only: a click on it opens the row too.
    first?.querySelector<HTMLElement>('[data-property-id="title"]')?.click();
    expect(context.openDetailPanel).toHaveBeenCalledTimes(2);
    // A value is the table's cell: a click opens its editor, not the row.
    const note = first?.querySelector<
      HTMLElement & { isEditing$: { value: boolean }; exit(): void }
    >('[data-property-id="note"]');
    note?.click();
    expect(context.openDetailPanel).toHaveBeenCalledTimes(2);
    expect(note?.isEditing$.value).toBe(true);
    // While a value edits, the rows hold still, as in a table.
    expect(context.view.isLocked$.value).toBe(true);
    note?.exit();
    expect(context.view.isLocked$.value).toBe(false);
    first?.querySelector<HTMLElement>('[data-testid="dv-flat-open"]')?.click();
    expect(context.openDetailPanel).toHaveBeenCalledTimes(3);
  });

  it('adds a row at the end and opens it', async () => {
    const context = setup({ mode });
    const ui = await mount(context);
    const add = ui.querySelector<HTMLElement>('[data-testid="dv-flat-new"]');
    expect(add?.textContent).toContain('New page');
    add?.click();
    expect(context.rowAdd).toHaveBeenCalledWith('end');
    expect(context.openDetailPanel.mock.calls[0]?.[0]).toMatchObject({
      rowId: 'r4',
    });
  });

  it('offers no editor and no "New page" when read-only', async () => {
    const context = setup({ mode, readonly: true });
    const ui = await mount(context);
    expect(ui.querySelector('[data-testid="dv-flat-new"]')).toBeNull();
    const note = ui.querySelector<HTMLElement & { readonly: boolean }>(
      '[data-property-id="note"]'
    );
    expect(note?.readonly).toBe(true);
    note?.click();
    // Read-only, the value lets the click through: the row opens for reading.
    expect(context.openDetailPanel).toHaveBeenCalledTimes(1);
  });

  it('draws a value still loading as the table does: a spinner, no editor, no write', async () => {
    const context = setup({
      mode,
      cellStatus: { 'r1:status': 'pending', 'r2:status': 'error' },
    });
    const ui = await mount(context);
    const pending = ui.querySelector<HTMLElement>(
      '[data-row-id="r1"] [data-property-id="status"]'
    );
    expect(
      pending?.querySelector('[data-testid="dv-cell-loading"]')
    ).not.toBeNull();
    expect(pending?.querySelector('affine-database-select-cell')).toBeNull();
    expect(pending?.tagName).not.toBe('DV-STANDALONE-CELL');
    const failed = ui.querySelector(
      '[data-row-id="r2"] [data-property-id="status"]'
    );
    expect(failed?.querySelector('[data-cell-status="error"]')).not.toBeNull();
    expect(failed?.querySelector('affine-database-select-cell')).toBeNull();
    // Its neighbours are ready and drawn by their cell.
    expect(
      ui.querySelector(
        '[data-row-id="r1"] dv-standalone-cell[data-property-id="note"]'
      )
    ).not.toBeNull();

    // No editor to open: the click reaches the row, which opens.
    pending?.click();
    expect(context.openDetailPanel).toHaveBeenCalledTimes(1);
    expect(context.view.isLocked$.value).toBe(false);
    // And the cell refuses a write that would land over the missing value.
    context.view
      .propertyGetOrCreate('status')
      .cellGetOrCreate('r1')
      .valueSet('done');
    expect(context.cellValueChange).not.toHaveBeenCalled();
    expect(context.values.get('r1:status')).toBe('todo');
  });
});

describe('the list preset', () => {
  it('draws no chip for an empty value', async () => {
    const context = setup({ mode: 'list' });
    const ui = await mount(context);
    const third = ui.querySelector('[data-row-id="r3"]');
    expect(third?.querySelector('[data-property-id="status"]')).toBeNull();
    expect(third?.querySelector('[data-property-id="note"]')).toBeNull();
    expect(third?.querySelector('[data-property-id="title"]')).not.toBeNull();
  });

  it('keeps the chip of an empty value still loading, with its spinner', async () => {
    const context = setup({
      mode: 'list',
      cellStatus: { 'r3:status': 'pending' },
    });
    const ui = await mount(context);
    const chip = ui.querySelector(
      '[data-row-id="r3"] .dv-list-row-properties [data-property-id="status"]'
    );
    expect(
      chip?.querySelector('[data-testid="dv-cell-loading"]')
    ).not.toBeNull();
  });
});

describe('a new gallery or list view', () => {
  it('shows its title and hides every other property', () => {
    const { view } = setup({ mode: 'gallery' });
    const data = flatViewDefaultData(view.manager);
    expect(data.columns).toEqual([
      { id: 'title', hide: false },
      { id: 'status', hide: true },
      { id: 'note', hide: true },
      { id: 'done', hide: true },
    ]);
    expect(data.filter.conditions).toEqual([]);
  });

  it('keeps the filter and the sort through a layout switch', () => {
    const filter: FilterGroup = {
      type: 'group',
      op: 'and',
      conditions: [
        {
          type: 'filter',
          left: { type: 'ref', name: 'note' },
          function: 'is',
          args: [{ type: 'literal', value: 'first' }],
        },
      ],
    };
    const sort: Sort = {
      manuallySort: [],
      sortBy: [{ ref: { type: 'ref', name: 'title' }, desc: false }],
    };
    for (const [from, to] of <[string, string][]>[
      ['table', 'gallery'],
      ['kanban', 'list'],
      ['gallery', 'list'],
      ['list', 'table'],
      ['gallery', 'kanban'],
    ]) {
      const convert = viewConverts.find(c => c.from === from && c.to === to);
      expect(convert, `${from} → ${to}`).toBeDefined();
      expect(
        convert?.convert({
          id: 'v',
          name: 'v',
          mode: from,
          filter,
          sort,
        } as FlatViewDataType)
      ).toEqual({ filter, sort });
    }
  });

  it('is a preset of this package, under its stored mode', () => {
    expect(viewPresets.galleryViewMeta.type).toBe('gallery');
    expect(viewPresets.listViewMeta.type).toBe('list');
    expect(galleryViewModel.model.dataViewManager).toBe(GallerySingleView);
    expect(listViewModel.model.dataViewManager).toBe(ListSingleView);
  });
});
