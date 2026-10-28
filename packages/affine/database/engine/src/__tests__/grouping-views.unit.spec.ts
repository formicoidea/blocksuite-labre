import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { GroupBy, GroupProperty } from '../core/common/types.js';
import { coreEffects } from '../core/effect.js';
import type { GroupSetting } from '../core/group-by/setting.js';
import type { PropertyMetaConfig } from '../core/property/property-config.js';
import {
  rowsArePages,
  viewOpenIn,
  viewOpenInSet,
} from '../core/view/open-in.js';
import type { ViewManager } from '../core/view-manager/view-manager.js';
import { propertyPresetsEffects } from '../property-presets/effect.js';
import { propertyPresets } from '../property-presets/index.js';
import { viewConverts } from '../view-presets/convert.js';
import type { FlatViewDataType } from '../view-presets/flat/flat-view-manager.js';
import type { FlatViewUILogic } from '../view-presets/flat/flat-view-ui.js';
import { galleryEffects } from '../view-presets/gallery/effect.js';
import { GalleryViewUILogic } from '../view-presets/gallery/gallery-view.js';
import { GallerySingleView } from '../view-presets/gallery/index.js';
import { viewPresets } from '../view-presets/index.js';
import { listEffects } from '../view-presets/list/effect.js';
import { ListSingleView } from '../view-presets/list/index.js';
import { ListViewUILogic } from '../view-presets/list/list-view.js';

/**
 * Grouping on every layout and the per-view settings of B8 (ADR 0035 §8,
 * PRD REQ-DB-5, 11, 13 and 16), on the gallery and list presets: the
 * table's stored `groupBy` and `groupProperties`, the table's trait, the
 * table's group header.
 *
 * What it would have caught:
 * - a gallery or a list ignoring a stored `groupBy`, or drawing a group its
 *   `groupProperties` hide;
 * - a hidden group nowhere to be found (it is listed at the end of the view,
 *   with a button that shows it again) or a hide stored in a new shape;
 * - a fold written into the view data instead of kept on this device;
 * - a "New page" of a group creating a row outside it;
 * - a write on mount of a grouped view;
 * - "Open pages in" written on load, written when the pick changes nothing,
 *   written on a read-only view, or an unknown stored value breaking the read;
 * - a layout switch into a gallery or a list dropping the grouping.
 */

beforeAll(() => {
  if (!customElements.get('uni-lit')) coreEffects();
  if (!customElements.get('affine-database-text-cell')) {
    propertyPresetsEffects();
  }
  if (!customElements.get('dv-gallery-view-ui')) galleryEffects();
  if (!customElements.get('dv-list-view-ui')) listEffects();
});

// The first grouped mount of a run pays for the cells' and the group titles'
// first render; paid here, under the hook's budget, not by the first case.
beforeAll(async () => {
  for (const mode of ['gallery', 'list'] as const) {
    await mount(
      setup({ mode, groupBy: byStatus, groupProperties: doneHidden })
    );
  }
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

const metas: Record<string, PropertyMetaConfig> = {
  title: propertyPresets.textPropertyConfig as unknown as PropertyMetaConfig,
  text: propertyPresets.textPropertyConfig as unknown as PropertyMetaConfig,
  select: propertyPresets.selectPropertyConfig as unknown as PropertyMetaConfig,
};

const statusOptions = {
  options: [
    { id: 'todo', value: 'Todo', color: 'var(--affine-tag-blue)' },
    { id: 'done', value: 'Done', color: 'var(--affine-tag-green)' },
  ],
};

const byStatus: GroupBy = {
  type: 'groupBy',
  columnId: 'status',
  name: 'select',
};

type GroupedViewData = FlatViewDataType & {
  groupBy?: GroupBy;
  groupProperties?: GroupProperty[];
  openIn?: string;
};

let viewCount = 0;

function setup(options: {
  mode: 'gallery' | 'list';
  groupBy?: GroupBy;
  groupProperties?: GroupProperty[];
  readonly?: boolean;
  rowsAreDocuments?: boolean;
  openIn?: string;
}) {
  // One view id per case: the fold store keeps one signal per key.
  const viewId = `view-${++viewCount}`;
  const rows = signal(['r1', 'r2', 'r3']);
  const properties = signal(['title', 'status', 'note']);
  const types: Record<string, string> = {
    title: 'title',
    status: 'select',
    note: 'text',
  };
  const values = new Map<string, unknown>([
    ['r1:title', 'Alpha'],
    ['r1:status', 'todo'],
    ['r2:title', 'Bravo'],
    ['r2:status', 'done'],
    ['r3:title', 'Charlie'],
  ]);
  const viewData = signal<GroupedViewData>({
    id: viewId,
    name: 'View',
    mode: options.mode,
    columns: properties.value.map(id => ({ id, hide: false })),
    filter: { type: 'group', op: 'and', conditions: [] },
    ...(options.groupBy ? { groupBy: options.groupBy } : {}),
    ...(options.groupProperties
      ? { groupProperties: options.groupProperties }
      : {}),
    ...(options.openIn ? { openIn: options.openIn } : {}),
  });
  const viewDataUpdate = vi.fn(
    (
      _id: string,
      updater: (data: GroupedViewData) => Partial<GroupedViewData>
    ) => {
      viewData.value = { ...viewData.value, ...updater(viewData.value) };
    }
  );
  const cellValueChange = vi.fn(
    (rowId: string, propertyId: string, value: unknown) => {
      values.set(`${rowId}:${propertyId}`, value);
      rows.value = [...rows.value];
    }
  );
  const rowAdd = vi.fn(() => {
    const rowId = `r${rows.value.length + 1}`;
    rows.value = [...rows.value, rowId];
    return rowId;
  });
  const readonly$ = signal(options.readonly ?? false);
  const services = new Map<unknown, unknown>();
  const dataSource = {
    rows$: rows,
    properties$: properties,
    readonly$,
    rowsAreDocuments: options.rowsAreDocuments ?? false,
    featureFlags$: signal({
      enable_number_formatting: false,
      enable_table_virtual_scroll: false,
    }),
    provider: { getAll: () => new Map() },
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
    serviceGetOrCreate: (key: unknown, create: () => unknown) => {
      if (!services.has(key)) services.set(key, create());
      return services.get(key);
    },
    viewMetaGet: (mode: string) =>
      mode === 'gallery'
        ? viewPresets.galleryViewMeta
        : mode === 'list'
          ? viewPresets.listViewMeta
          : viewPresets.tableViewMeta,
    cellStatus: () => 'ready',
  };
  const manager = { dataSource, readonly$ } as unknown as ViewManager;
  const view =
    options.mode === 'gallery'
      ? new GallerySingleView(manager, viewId)
      : new ListSingleView(manager, viewId);
  const root = {
    config: { headerWidget: undefined },
    openDetailPanel: vi.fn(),
  };
  return {
    view,
    viewId,
    root,
    dataSource,
    values,
    viewData,
    viewDataUpdate,
    cellValueChange,
    rowAdd,
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
  };
  ui.logic = logic;
  document.body.append(ui);
  await settle(ui);
  return ui;
}

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

const sectionOf = (ui: Element, key: string) =>
  ui.querySelector<HTMLElement>(
    `[data-testid="dv-flat-group"][data-group-key="${key}"]`
  );

const rowIdsIn = (element: Element | null | undefined, mode: string) =>
  [
    ...(element?.querySelectorAll<HTMLElement>(
      itemSelector[mode as 'gallery' | 'list']
    ) ?? []),
  ].map(item => item.dataset.rowId);

/** Done hidden; the stored manual order puts it first, which hiding keeps. */
const doneHidden: GroupProperty[] = [
  { key: 'done', hide: true, manuallyCardSort: [] },
];

describe.each(['gallery', 'list'] as const)('a grouped %s', mode => {
  it('draws each visible group under its header, the hidden ones at the end', async () => {
    const context = setup({
      mode,
      groupBy: byStatus,
      groupProperties: doneHidden,
    });
    const ui = await mount(context);
    const sections = [
      ...ui.querySelectorAll<HTMLElement>('[data-testid="dv-flat-group"]'),
    ].map(section => section.dataset.groupKey);
    expect(sections).toEqual(['Ungroups', 'todo']);
    expect(rowIdsIn(sectionOf(ui, 'todo'), mode)).toEqual(['r1']);
    expect(rowIdsIn(sectionOf(ui, 'Ungroups'), mode)).toEqual(['r3']);
    expect(rowIdsIn(ui, mode)).not.toContain('r2');

    const hidden = ui.querySelector('[data-testid="dv-hidden-groups"]');
    expect(
      [
        ...(hidden?.querySelectorAll<HTMLElement>(
          '[data-testid="dv-hidden-group"]'
        ) ?? []),
      ].map(group => group.dataset.groupKey)
    ).toEqual(['done']);
    // At the end of the view, after every group.
    expect(ui.lastElementChild).toBe(hidden);
  });

  it('writes nothing on mount', async () => {
    const context = setup({
      mode,
      groupBy: byStatus,
      groupProperties: doneHidden,
    });
    const before = structuredClone(context.viewData.value);
    await mount(context);
    expect(context.viewDataUpdate).not.toHaveBeenCalled();
    expect(context.cellValueChange).not.toHaveBeenCalled();
    expect(context.viewData.value).toEqual(before);
  });

  it('shows a hidden group again from the end of the view', async () => {
    const context = setup({
      mode,
      groupBy: byStatus,
      groupProperties: doneHidden,
    });
    const ui = await mount(context);
    ui
      .querySelector<HTMLElement>(
        '[data-group-key="done"] [data-testid="dv-group-show"]'
      )
      ?.click();
    await settle(ui);
    expect(context.viewData.value.groupProperties).toEqual([
      { key: 'done', hide: false, manuallyCardSort: [] },
      { key: 'Ungroups', hide: false, manuallyCardSort: [] },
      { key: 'todo', hide: false, manuallyCardSort: [] },
    ]);
    expect(rowIdsIn(sectionOf(ui, 'done'), mode)).toEqual(['r2']);
    expect(ui.querySelector('[data-testid="dv-hidden-group"]')).toBeNull();
  });

  it('hides a group for everyone in the stored shape, once', async () => {
    const context = setup({ mode, groupBy: byStatus });
    const ui = await mount(context);
    const trait = context.view.groupTrait;
    trait.groupHideSet('todo', true);
    trait.groupHideSet('todo', true);
    await settle(ui);
    expect(context.viewDataUpdate).toHaveBeenCalledTimes(1);
    expect(
      context.viewData.value.groupProperties?.find(g => g.key === 'todo')
    ).toEqual({ key: 'todo', hide: true, manuallyCardSort: [] });
    expect(sectionOf(ui, 'todo')).toBeNull();
  });

  it('folds a group on this device only', async () => {
    const context = setup({ mode, groupBy: byStatus });
    const ui = await mount(context);
    sectionOf(ui, 'todo')
      ?.querySelector<HTMLElement>('[data-testid="dv-group-toggle"]')
      ?.click();
    await settle(ui);
    expect(rowIdsIn(sectionOf(ui, 'todo'), mode)).toEqual([]);
    expect(sectionOf(ui, 'todo')).not.toBeNull();
    expect(context.viewDataUpdate).not.toHaveBeenCalled();
    expect(
      localStorage.getItem(
        `labre:data-view:group-collapsed:${context.viewId}:todo`
      )
    ).toBe('1');
  });

  it('adds a row into the group its "New page" belongs to', async () => {
    const context = setup({ mode, groupBy: byStatus });
    const ui = await mount(context);
    sectionOf(ui, 'todo')
      ?.querySelector<HTMLElement>('[data-testid="dv-flat-new"]')
      ?.click();
    await settle(ui);
    expect(context.rowAdd).toHaveBeenCalledTimes(1);
    expect(context.cellValueChange).toHaveBeenCalledWith(
      'r4',
      'status',
      'todo'
    );
  });

  it('lists hidden groups without a button on a read-only view', async () => {
    const context = setup({
      mode,
      groupBy: byStatus,
      groupProperties: doneHidden,
      readonly: true,
    });
    const ui = await mount(context);
    expect(ui.querySelector('[data-testid="dv-hidden-group"]')).not.toBeNull();
    expect(ui.querySelector('[data-testid="dv-group-show"]')).toBeNull();
  });

  it('draws no group header when ungrouped', async () => {
    const ui = await mount(setup({ mode }));
    expect(ui.querySelector('[data-testid="dv-flat-group"]')).toBeNull();
    expect(ui.querySelector('[data-testid="dv-hidden-group"]')).toBeNull();
    expect(rowIdsIn(ui, mode)).toEqual(['r1', 'r2', 'r3']);
  });
});

describe('the group settings list', () => {
  it('hides and shows a group with its eye, in its place', async () => {
    const context = setup({ mode: 'list', groupBy: byStatus });
    const setting = document.createElement(
      'data-view-group-setting'
    ) as GroupSetting;
    setting.groupTrait = context.view.groupTrait;
    document.body.append(setting);
    await settle(setting);
    const eyes = () =>
      setting.querySelectorAll<HTMLElement>(
        '[data-testid="dv-group-visibility"]'
      );
    expect(eyes()).toHaveLength(3);
    eyes()[1]?.click();
    await settle(setting);
    expect(context.view.groupTrait.hiddenGroups$.value.map(g => g.key)).toEqual(
      ['todo']
    );
    // Still listed, now pressed, so it can be shown again from here.
    expect(eyes()).toHaveLength(3);
    expect(eyes()[1]?.getAttribute('aria-pressed')).toBe('true');
    eyes()[1]?.click();
    expect(context.view.groupTrait.hiddenGroups$.value).toEqual([]);
  });
});

describe('where a view opens its pages (openIn)', () => {
  it('reads side when absent or unknown', () => {
    expect(viewOpenIn(undefined)).toBe('side');
    expect(viewOpenIn({})).toBe('side');
    expect(viewOpenIn({ openIn: 'popup' })).toBe('side');
    expect(viewOpenIn({ openIn: 'full' })).toBe('full');
  });

  it('is written on a pick that changes it, never otherwise', () => {
    const context = setup({ mode: 'gallery' });
    expect(viewOpenInSet(context.view, 'side')).toBe(false);
    expect(context.viewDataUpdate).not.toHaveBeenCalled();
    expect('openIn' in context.viewData.value).toBe(false);

    expect(viewOpenInSet(context.view, 'center')).toBe(true);
    expect(context.viewData.value.openIn).toBe('center');
    expect(viewOpenInSet(context.view, 'center')).toBe(false);
    expect(context.viewDataUpdate).toHaveBeenCalledTimes(1);
  });

  it('is never written on a read-only view', () => {
    const context = setup({ mode: 'list', readonly: true });
    expect(viewOpenInSet(context.view, 'full')).toBe(false);
    expect(context.viewDataUpdate).not.toHaveBeenCalled();
  });

  it('is offered only where rows are pages', () => {
    expect(rowsArePages(setup({ mode: 'list' }).dataSource as never)).toBe(
      false
    );
    expect(
      rowsArePages(
        setup({ mode: 'list', rowsAreDocuments: true }).dataSource as never
      )
    ).toBe(true);
  });
});

describe('a layout switch', () => {
  it.each(['table', 'kanban', 'gallery', 'list'])(
    'from %s into a gallery or a list keeps the grouping',
    from => {
      for (const to of ['gallery', 'list']) {
        if (from === to) continue;
        const convert = viewConverts.find(c => c.from === from && c.to === to);
        expect(convert, `${from} → ${to}`).toBeDefined();
        const result = convert?.convert({
          id: 'v',
          name: 'v',
          mode: from,
          groupBy: byStatus,
          filter: { type: 'group', op: 'and', conditions: [] },
        } as never) as { groupBy?: GroupBy };
        expect(result.groupBy).toEqual(byStatus);
      }
    }
  );

  it('from an ungrouped gallery into a kanban leaves the kanban its own', () => {
    const convert = viewConverts.find(
      c => c.from === 'gallery' && c.to === 'kanban'
    );
    const result = convert?.convert({
      id: 'v',
      name: 'v',
      mode: 'gallery',
      filter: { type: 'group', op: 'and', conditions: [] },
    } as never);
    expect(result && 'groupBy' in result).toBe(false);
  });
});
