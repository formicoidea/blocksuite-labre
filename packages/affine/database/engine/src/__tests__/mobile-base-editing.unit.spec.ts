import { effects as menuEffects } from '@labre/affine-components/context-menu';
import { effects as datePickerEffects } from '@labre/affine-components/date-picker';
import { TranslationProvider } from '@labre/affine-shared/services';
import { type BlockStdScope, stdContext } from '@labre/std';
import { ContextProvider } from '@lit/context';
import { signal } from '@preact/signals-core';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

/**
 * Editing a base on a phone, after Notion's phone table (P7, PO decision of
 * 2026-10-16: "Les bases doivent être éditables en mobile").
 *
 * What it would have caught:
 * - the title's two floating ops (open, "...") drawn over the end of the
 *   title instead of an "Open" chip with its room reserved, or the chip
 *   missing on a read-only base, where it is the only way into a row;
 * - deleting a row made impossible on a phone once the "..." op left the
 *   title (it moved to a long press), or a long press that also edits the
 *   cell under the finger, or a scroll that opens the menu;
 * - a select, multi-select or date value edited in a floating popover a
 *   phone cannot use, instead of the bottom sheet;
 * - the header's "+" opening the settings of the previous last property:
 *   the header was looked up before it drew the new one;
 * - filter and sort hidden from a phone's toolbar, or under a finger's 44px;
 * - "+" and "+ New page" adding a row a phone then has to find, or opening
 *   it, instead of putting its title in editing as every view's "New" does
 *   since the recette of 1.1 (product owner, P3-15; it opened the row
 *   from P7 to 1.1);
 * - a tap on a kanban card, a gallery card or a list row editing the value
 *   under the finger instead of opening the row.
 */
vi.mock('@labre/global/env', async importOriginal => ({
  ...(await importOriginal<typeof import('@labre/global/env')>()),
  IS_MOBILE: true,
}));

import { coreEffects } from '../core/effect.js';
import type { PropertyMetaConfig } from '../core/property/property-config.js';
import type { ViewManager } from '../core/view-manager/view-manager.js';
import { propertyPresetsEffects } from '../property-presets/effect.js';
import { propertyPresets } from '../property-presets/index.js';
import { galleryEffects } from '../view-presets/gallery/effect.js';
import { GalleryViewUILogic } from '../view-presets/gallery/gallery-view.js';
import { GallerySingleView } from '../view-presets/gallery/index.js';
import { viewPresets } from '../view-presets/index.js';
import { MobileKanbanCard } from '../view-presets/kanban/mobile/card.js';
import { MobileKanbanCell } from '../view-presets/kanban/mobile/cell.js';
import { MobileTableColumnHeader } from '../view-presets/table/mobile/column-header.js';
import { mobileEffects } from '../view-presets/table/mobile/effect.js';
import {
  ROW_LONG_PRESS_MS,
  ROW_OPEN_WIDTH,
} from '../view-presets/table/mobile/row.js';
import { MobileTableViewUILogic } from '../view-presets/table/mobile/table-view-ui-logic.js';
import { TableSingleView } from '../view-presets/table/table-view-manager.js';
import { DataViewHeaderToolsFilter } from '../widget-presets/tools/presets/filter/filter.js';
import { DataViewHeaderToolsSort } from '../widget-presets/tools/presets/sort/sort.js';
import { DataViewHeaderToolsAddRow } from '../widget-presets/tools/presets/table-add-row/add-row.js';

const define = (name: string, ctor: CustomElementConstructor) => {
  if (!customElements.get(name)) customElements.define(name, ctor);
};

beforeAll(() => {
  if (!customElements.get('uni-lit')) coreEffects();
  if (!customElements.get('affine-database-text-cell')) {
    propertyPresetsEffects();
  }
  if (!customElements.get('mobile-menu')) menuEffects();
  if (!customElements.get('date-picker')) datePickerEffects();
  if (!customElements.get('mobile-table-row')) mobileEffects();
  if (!customElements.get('dv-gallery-view-ui')) galleryEffects();
  define('test-mobile-kanban-card', MobileKanbanCard);
  define('test-mobile-kanban-cell', MobileKanbanCell);
  define('test-dv-tools-filter', DataViewHeaderToolsFilter);
  define('test-dv-tools-sort', DataViewHeaderToolsSort);
  define('test-dv-tools-add-row', DataViewHeaderToolsAddRow);
});

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const metas: Record<string, PropertyMetaConfig> = {
  // No title preset lives in this package: the text cell stands in for it.
  title: propertyPresets.textPropertyConfig as unknown as PropertyMetaConfig,
  text: propertyPresets.textPropertyConfig as unknown as PropertyMetaConfig,
  select: propertyPresets.selectPropertyConfig as unknown as PropertyMetaConfig,
  'multi-select':
    propertyPresets.multiSelectPropertyConfig as unknown as PropertyMetaConfig,
  date: propertyPresets.datePropertyConfig as unknown as PropertyMetaConfig,
};

const statusOptions = {
  options: [
    { id: 'todo', value: 'Todo', color: 'var(--affine-tag-blue)' },
    { id: 'done', value: 'Done', color: 'var(--affine-tag-green)' },
  ],
};

/** A source of three rows: a title, a select, a multi-select and a date. */
function source(mode: 'table' | 'gallery', readonly = false) {
  const rows = signal(['r1', 'r2', 'r3']);
  const properties = signal(['title', 'status', 'tags', 'due']);
  const types: Record<string, string> = {
    title: 'title',
    status: 'select',
    tags: 'multi-select',
    due: 'date',
  };
  const values = new Map<string, unknown>([
    ['r1:title', 'Alpha'],
    ['r1:status', 'todo'],
    ['r2:title', 'Bravo'],
    ['r3:title', 'Charlie'],
  ]);
  const viewData = signal<Record<string, unknown>>({
    id: 'view-1',
    name: 'View',
    mode,
    columns: properties.value.map(id => ({ id, hide: false })),
    filter: { type: 'group', op: 'and', conditions: [] },
  });
  const services = new Map<unknown, unknown>();
  const readonly$ = signal(readonly);
  const rowAdd = vi.fn(() => {
    const rowId = `r${rows.value.length + 1}`;
    rows.value = [...rows.value, rowId];
    return rowId;
  });
  const rowDelete = vi.fn((ids: string[]) => {
    rows.value = rows.value.filter(id => !ids.includes(id));
  });
  const propertyAdd = vi.fn(() => {
    const id = `p${properties.value.length + 1}`;
    types[id] = 'text';
    properties.value = [...properties.value, id];
    viewData.value = {
      ...viewData.value,
      columns: properties.value.map(id => ({ id, hide: false })),
    };
    return id;
  });
  const dataSource = {
    rows$: rows,
    properties$: properties,
    readonly$,
    featureFlags$: signal({
      enable_number_formatting: false,
      enable_table_virtual_scroll: false,
    }),
    propertyMetas$: signal([metas.text]),
    provider: { getAll: () => new Map() },
    viewDataGet: () => viewData.value,
    viewDataUpdate: (
      _id: string,
      updater: (data: Record<string, unknown>) => Record<string, unknown>
    ) => {
      viewData.value = { ...viewData.value, ...updater(viewData.value) };
    },
    cellValueGet: (rowId: string, propertyId: string) =>
      values.get(`${rowId}:${propertyId}`),
    cellValueChange: vi.fn(),
    rowAdd,
    rowDelete,
    propertyAdd,
    propertyTypeGet: (id: string) => types[id],
    propertyTypeCanSet: () => true,
    propertyNameGet: (id: string) => id,
    propertyNameSet: vi.fn(),
    propertyDataGet: (id: string) =>
      id === 'status' || id === 'tags' ? statusOptions : {},
    propertyDataSet: vi.fn(),
    propertyReadonlyGet: () => false,
    propertyMetaGet: (type: string) => metas[type],
    propertyCanDelete: () => true,
    propertyCanDuplicate: () => true,
    serviceGet: () => null,
    serviceGetOrCreate: (key: unknown, create: () => unknown) => {
      if (!services.has(key)) services.set(key, create());
      return services.get(key);
    },
    viewMetaGet: (m: string) =>
      m === 'gallery' ? viewPresets.galleryViewMeta : viewPresets.tableViewMeta,
    cellStatus: () => 'ready',
  };
  const manager = {
    dataSource,
    readonly$,
    viewMetas: [viewPresets.tableViewMeta],
  } as unknown as ViewManager;
  const selection$ = signal<unknown>(undefined);
  const root = {
    config: {
      headerWidget: undefined,
      virtualPadding$: signal(0),
      eventTrace: vi.fn(),
    },
    selection$,
    setSelection: (selection: unknown) => {
      selection$.value = selection;
    },
    openDetailPanel: vi.fn(),
  };
  return { manager, root, rowAdd, rowDelete, propertyAdd, readonly$ };
}

const frenchStd = {
  getOptional: (id: unknown) =>
    id === TranslationProvider
      ? {
          t: (key: string) =>
            ({
              'com.labre.open-doc.open': 'Ouvrir',
              'com.labre.toolbar.delete': 'Supprimer',
              'com.labre.data-view.new-page': 'Nouvelle page',
            })[key],
          language: 'fr',
        }
      : null,
} as unknown as BlockStdScope;

/** An element inside an editor, as the base's chrome is: it provides `std`. */
function inEditor(std?: BlockStdScope) {
  const editor = document.createElement('div');
  if (std) {
    new ContextProvider(editor, {
      context: stdContext,
      initialValue: std,
    }).hostConnected();
  }
  document.body.append(editor);
  return editor;
}

async function settle() {
  for (let pass = 0; pass < 5; pass++) {
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

const sheets = () => [...document.body.querySelectorAll('mobile-menu')];

async function mountTable(
  options: { readonly?: boolean; std?: BlockStdScope } = {}
) {
  const context = source('table', options.readonly);
  const view = new TableSingleView(context.manager, 'view-1');
  const logic = new MobileTableViewUILogic(context.root as never, view);
  const ui = document.createElement('mobile-data-view-table-ui');
  ui.logic = logic;
  inEditor(options.std).append(ui);
  await settle();
  const row = (rowId: string) =>
    ui.querySelector<HTMLElement>(`mobile-table-row[data-row-id="${rowId}"]`)!;
  const cell = (rowId: string, propertyId: string) =>
    row(rowId).querySelector<HTMLElement>(
      `mobile-table-cell[data-column-id="${propertyId}"]`
    )!;
  return { ...context, view, logic, ui, row, cell };
}

describe('a phone table row', () => {
  it('opens through an "Open" chip on the title, its room reserved', async () => {
    const { ui, row, cell, root, view } = await mountTable();
    expect(ui.querySelector('.mobile-row-ops, .mobile-row-op')).toBeNull();
    const chips = ui.querySelectorAll('[data-testid="dv-row-open"]');
    expect(chips).toHaveLength(3);

    const chip = row('r2').querySelector<HTMLElement>(
      '[data-testid="dv-row-open"]'
    )!;
    expect(chip.textContent?.trim()).toBe('Open');
    expect(chip.getAttribute('role')).toBe('button');
    expect(chip.closest('.mobile-row-title')).not.toBeNull();
    expect(cell('r2', 'title').style.paddingRight).toBe(`${ROW_OPEN_WIDTH}px`);
    expect(cell('r2', 'status').style.paddingRight).toBe('');

    chip.click();
    expect(root.openDetailPanel).toHaveBeenCalledWith({ view, rowId: 'r2' });
    // The chip is no tap on the title cell: nothing enters editing.
    expect(root.selection$.value).toBeUndefined();
  });

  it('says "Open" in the host language', async () => {
    const { row } = await mountTable({ std: frenchStd });
    const chip = row('r1').querySelector('[data-testid="dv-row-open"]');
    expect(chip?.textContent?.trim()).toBe('Ouvrir');
    expect(chip?.getAttribute('aria-label')).toBe('Ouvrir');
  });

  it('keeps the chip on a read-only base, where it is the way in', async () => {
    const { ui, row, root, view } = await mountTable({ readonly: true });
    expect(ui.querySelectorAll('[data-testid="dv-row-open"]')).toHaveLength(3);
    row('r1')
      .querySelector<HTMLElement>('[data-testid="dv-row-open"]')!
      .click();
    expect(root.openDetailPanel).toHaveBeenCalledWith({ view, rowId: 'r1' });
  });
});

describe('a long press on a phone table row', () => {
  const press = (target: HTMLElement, x = 10, y = 10) =>
    target.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y })
    );

  it('opens the row menu: open and delete', async () => {
    const { row, cell, rowDelete, root, view } = await mountTable({
      std: frenchStd,
    });
    vi.useFakeTimers();
    press(cell('r2', 'status'));
    vi.advanceTimersByTime(ROW_LONG_PRESS_MS);
    vi.useRealTimers();
    await settle();
    const [sheet] = sheets();
    expect(sheet?.textContent).toContain('Ouvrir');
    expect(sheet?.textContent).toContain('Supprimer');

    // The release's click does not edit the cell under the finger.
    cell('r2', 'status').click();
    expect(root.selection$.value).toBeUndefined();

    const entry = (name: string) =>
      [...sheet!.querySelectorAll<HTMLElement>('mobile-menu-button')].find(
        button => button.textContent?.includes(name)
      );
    entry('Supprimer')!.click();
    expect(rowDelete).toHaveBeenCalledWith(['r2']);
    expect(root.openDetailPanel).not.toHaveBeenCalledWith({
      view,
      rowId: 'r2',
    });
    expect(row('r1')).not.toBeNull();
  });

  it('is a scroll, not a press, once the finger travels', async () => {
    const { cell } = await mountTable();
    vi.useFakeTimers();
    press(cell('r1', 'status'));
    cell('r1', 'status').dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: 40,
        clientY: 10,
      })
    );
    vi.advanceTimersByTime(ROW_LONG_PRESS_MS);
    vi.useRealTimers();
    expect(sheets()).toHaveLength(0);
  });

  it('offers nothing on a read-only base', async () => {
    const { cell } = await mountTable({ readonly: true });
    vi.useFakeTimers();
    press(cell('r1', 'status'));
    vi.advanceTimersByTime(ROW_LONG_PRESS_MS);
    vi.useRealTimers();
    expect(sheets()).toHaveLength(0);
  });
});

describe('a tap on a phone table cell', () => {
  it.each([
    ['select', 'status'],
    ['multi-select', 'tags'],
    ['date', 'due'],
  ])('edits a %s value in a bottom sheet', async (_type, propertyId) => {
    const { cell, root } = await mountTable();
    cell('r1', propertyId).click();
    await settle();
    expect(root.selection$.value).toMatchObject({ isEditing: true });
    const [sheet] = sheets();
    expect(sheet).toBeDefined();
    // The sheet is the phone's: a modal over the page, titled by the property.
    expect(sheet!.parentElement?.style.position).toBe('fixed');
    expect(sheet!.textContent).toContain(propertyId);
  });
});

describe('the header "+" on a phone', () => {
  it('opens the settings sheet of the property it adds', async () => {
    const popMenu = vi.spyOn(
      MobileTableColumnHeader.prototype as unknown as { popMenu: () => void },
      'popMenu'
    );
    const { ui, propertyAdd } = await mountTable();
    const add = ui.querySelector<HTMLElement>(
      '[data-testid="dv-table-add-property"]'
    )!;
    expect(add.getAttribute('aria-label')).toBe('New property');
    add.click();
    await settle();
    expect(propertyAdd).toHaveBeenCalled();
    expect(popMenu).toHaveBeenCalledTimes(1);
    const header = popMenu.mock.contexts[0] as MobileTableColumnHeader;
    expect(header.column.id).toBe('p5');
  });

  it('is not drawn on a read-only base', async () => {
    const { ui } = await mountTable({ readonly: true });
    expect(
      ui.querySelector('[data-testid="dv-table-add-property"]')
    ).toBeNull();
  });
});

describe('adding a row on a phone', () => {
  /** The new row's title cell, in editing, and nothing opened. */
  async function expectTitleEditing(
    mounted: Awaited<ReturnType<typeof mountTable>>
  ) {
    await new Promise(resolve => requestAnimationFrame(resolve));
    await settle();
    expect(mounted.root.openDetailPanel).not.toHaveBeenCalled();
    expect(mounted.root.selection$.value).toMatchObject({
      type: 'table',
      selectionType: 'area',
      isEditing: true,
      focus: { rowIndex: 3 },
    });
    expect(mounted.cell('r4', 'title').dataset.editing).toBe('true');
  }

  it('"+ New page" under the rows adds a row at the end, its title in editing', async () => {
    const mounted = await mountTable({ std: frenchStd });
    const footer = mounted.ui.querySelector<HTMLElement>(
      '.data-view-table-group-add-row'
    )!;
    expect(footer.textContent).toContain('Nouvelle page');
    footer.click();
    expect(mounted.rowAdd).toHaveBeenCalledWith('end');
    await expectTitleEditing(mounted);
  });

  it('the toolbar draws a blue "+" that adds a row, its title in editing', async () => {
    const mounted = await mountTable();
    const { logic, rowAdd } = mounted;
    const tool = document.createElement(
      'test-dv-tools-add-row'
    ) as DataViewHeaderToolsAddRow;
    tool.dataViewLogic = logic;
    inEditor(frenchStd).append(tool);
    await settle();
    const button = tool.querySelector<HTMLElement>(
      '[data-testid="dv-tools-new-row"]'
    )!;
    expect(button.getAttribute('aria-label')).toBe('Nouvelle page');
    expect(button.textContent?.trim()).toBe('');
    button.click();
    expect(rowAdd).toHaveBeenCalledWith('start');
    await expectTitleEditing(mounted);
  });
});

describe('filter and sort on a phone', () => {
  it.each([
    ['filter', 'test-dv-tools-filter', DataViewHeaderToolsFilter],
    ['sort', 'test-dv-tools-sort', DataViewHeaderToolsSort],
  ] as const)(
    '%s shows in the toolbar, 44px, its menu a sheet',
    async (kind, tag, ctor) => {
      const { logic } = await mountTable();
      const tool = document.createElement(tag) as InstanceType<typeof ctor>;
      tool.dataViewLogic = logic;
      inEditor().append(tool);
      await settle();
      expect(tool.style.display).toBe('flex');
      const css = [ctor.styles].flat(Infinity).join('\n').replace(/\s+/g, ' ');
      expect(css).toMatch(
        new RegExp(
          `@media \\(pointer: coarse\\) \\{ \\.affine-database-${kind}-button \\{[^}]*min-width: 44px;[^}]*min-height: 44px`
        )
      );
      tool
        .querySelector<HTMLElement>(`[data-testid="dv-tools-${kind}"]`)!
        .click();
      await settle();
      expect(sheets()).toHaveLength(1);
    }
  );
});

describe('a tap on a phone card opens its row', () => {
  it('on the kanban, the card opens and no value enters editing', async () => {
    const openDetailPanel = vi.fn();
    const setSelection = vi.fn();
    const view = {
      id: 'view-1',
      shownAsFallback$: signal(true),
      properties$: signal([]),
      readonly$: signal(false),
      isInHeader: () => false,
      hasHeader: () => false,
      lockRows: () => {},
    };
    const card = document.createElement(
      'test-mobile-kanban-card'
    ) as MobileKanbanCard;
    card.cardId = 'card-1';
    card.groupKey = 'g';
    card.kanbanViewLogic = {
      view,
      root: { openDetailPanel },
    } as never;
    document.body.append(card);
    await settle();
    card.click();
    expect(openDetailPanel).toHaveBeenCalledWith({ view, rowId: 'card-1' });

    const cell = document.createElement(
      'test-mobile-kanban-cell'
    ) as MobileKanbanCell;
    Object.assign(cell, {
      column: {
        id: 'status',
        readonly$: signal(false),
        renderer$: signal(undefined),
        cellGetOrCreate: () => ({}),
      },
      cardId: 'card-1',
      groupKey: 'g',
      kanbanViewLogic: { selection$: signal(undefined), setSelection, view },
    });
    document.body.append(cell);
    cell.click();
    expect(setSelection).not.toHaveBeenCalled();
  });

  it('on the gallery, a tap on a value opens the row instead of editing', async () => {
    const context = source('gallery');
    const view = new GallerySingleView(context.manager, 'view-1');
    const logic = new GalleryViewUILogic(context.root as never, view);
    const ui = document.createElement('dv-gallery-view-ui') as HTMLElement & {
      logic: GalleryViewUILogic;
    };
    ui.logic = logic;
    document.body.append(ui);
    await settle();
    const cells = ui.querySelectorAll<HTMLElement & { readonly: boolean }>(
      'dv-standalone-cell'
    );
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(cell.readonly).toBe(true);
    const value = ui.querySelector<HTMLElement>(
      '[data-row-id="r1"] dv-standalone-cell[data-property-id="status"]'
    )!;
    value.click();
    expect(context.root.openDetailPanel).toHaveBeenCalledWith({
      view,
      rowId: 'r1',
      newTab: false,
    });
  });
});
