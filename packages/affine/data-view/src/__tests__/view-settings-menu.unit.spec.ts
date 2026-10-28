import {
  effects as menuEffects,
  menu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import type { BlockStdScope } from '@labre/std';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { coreEffects } from '../core/effect.js';
import type { DataViewUILogicBase } from '../core/index.js';
import type { PropertyMetaConfig } from '../core/property/property-config.js';
import { englishWording } from '../core/utils/wording.js';
import type { ViewManager } from '../core/view-manager/view-manager.js';
import {
  type ViewSettingsMenu,
  ViewSettingsMenuExtension,
  ViewSettingsMenuIdentifier,
} from '../core/view-manager/view-settings-menu.js';
import { propertyPresetsEffects } from '../property-presets/effect.js';
import { propertyPresets } from '../property-presets/index.js';
import { viewPresets } from '../view-presets/index.js';
import { TableSingleView } from '../view-presets/table/table-view-manager.js';
import { popViewOptions } from '../widget-presets/tools/presets/view-options/view-options.js';

/**
 * GUARD — the view settings menu takes entries from above data-view (ADR
 * 0035 amendment of 2026-10-28): `ViewSettingsMenuIdentifier`, which the
 * `core-database` bundle fills with "Source".
 *
 * What it would have caught:
 * - a 0.61 caller of `popViewOptions` (no `std`) drawing anything but the
 *   0.61 menu, or failing to compile once the parameter was added;
 * - an extension's entries drawn outside the Layout group, or before
 *   "Layout" (Notion's order is Layout, then Source);
 * - the menu asking the extension without the context it needs to pop its
 *   own menu: the editor, the view, the anchor and the way back;
 * - the registration not reaching the identifier the menu reads.
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
};

/** A table of one property, as `mobile-sheet-wording.unit.spec.ts` builds it. */
function tableView() {
  const properties = signal(['title']);
  const viewData = signal<Record<string, unknown>>({
    id: 'view-1',
    name: 'View',
    mode: 'table',
    columns: [{ id: 'title', hide: false }],
    filter: { type: 'group', op: 'and', conditions: [] },
  });
  const services = new Map<unknown, unknown>();
  const readonly$ = signal(false);
  const dataSource = {
    rows$: signal([]),
    properties$: properties,
    readonly$,
    featureFlags$: signal({
      enable_number_formatting: false,
      enable_table_virtual_scroll: false,
    }),
    propertyMetas$: signal([metas.title]),
    provider: { getAll: () => new Map() },
    viewDataGet: () => viewData.value,
    viewDataUpdate: vi.fn(),
    cellValueGet: () => undefined,
    propertyTypeGet: () => 'title',
    propertyTypeCanSet: () => false,
    propertyNameGet: (id: string) => id,
    propertyDataGet: () => ({}),
    propertyReadonlyGet: () => false,
    propertyMetaGet: (type: string) => metas[type],
    propertyCanDelete: () => false,
    propertyCanDuplicate: () => false,
    serviceGet: () => null,
    viewMetaGet: () => viewPresets.tableViewMeta,
    serviceGetOrCreate: (key: unknown, create: () => unknown) => {
      if (!services.has(key)) services.set(key, create());
      return services.get(key);
    },
  };
  const manager = {
    dataSource,
    readonly$,
    viewMetas: [viewPresets.tableViewMeta],
  } as unknown as ViewManager;
  return new TableSingleView(manager, 'view-1');
}

const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

function stdWith(settings: ViewSettingsMenu | null): BlockStdScope {
  return {
    getOptional: (id: unknown) =>
      id === ViewSettingsMenuIdentifier ? settings : null,
  } as unknown as BlockStdScope;
}

async function open(std?: BlockStdScope) {
  const anchor = document.createElement('div');
  document.body.append(anchor);
  const logic = {
    view: tableView(),
    eventTrace: vi.fn(),
  } as unknown as DataViewUILogicBase;
  const target = popupTargetFromElement(anchor);
  popViewOptions(target, logic, undefined, englishWording, std);
  await frame();
  return { logic, target };
}

const buttons = () => [
  ...document.querySelectorAll<HTMLElement>('affine-menu-button'),
];
const named = (text: string) =>
  buttons().find(button => button.textContent?.includes(text));

describe('popViewOptions and ViewSettingsMenuIdentifier', () => {
  it('without std draws the 0.61 menu, asking no extension', async () => {
    await open();
    const labels = buttons().map(b => b.textContent?.replace(/\s+/g, ' '));
    expect(named('Layout')).toBeTruthy();
    expect(labels.some(label => label?.includes('Extra'))).toBe(false);
  });

  it("draws an extension's entries in the Layout group, after Layout", async () => {
    const items = vi.fn<ViewSettingsMenu['items']>(() => [
      menu.action({ name: 'Extra', testId: 'extra-entry', select: () => {} }),
    ]);
    const { logic, target } = await open(stdWith({ items }));

    const layout = named('Layout')!;
    const extra = document
      .querySelector('[data-testid="extra-entry"]')!
      .closest('affine-menu-button')!;
    expect(extra).not.toBeNull();
    expect(extra.parentElement).toBe(layout.parentElement);
    const group = [...layout.parentElement!.children];
    expect(group.indexOf(extra)).toBe(group.indexOf(layout) + 1);
    expect(extra.parentElement).not.toBe(named('Properties')?.parentElement);

    expect(items).toHaveBeenCalledTimes(1);
    const context = items.mock.calls[0]![0];
    expect(context.dataViewLogic).toBe(logic);
    expect(context.target).toBe(target);
    expect(context.wording(['com.labre.test', 'Fallback'])).toBe('Fallback');
    // Its "back" reopens the view settings, with the extension still asked.
    context.reopen();
    await frame();
    expect(items).toHaveBeenCalledTimes(2);
  });

  it('an extension answering undefined leaves the 0.61 menu', async () => {
    await open(stdWith({ items: () => undefined }));
    expect(named('Layout')).toBeTruthy();
    expect(document.querySelector('[data-testid="extra-entry"]')).toBeNull();
  });

  it('the extension registers the identifier the menu reads', () => {
    const settings: ViewSettingsMenu = { items: () => undefined };
    const override = vi.fn();
    ViewSettingsMenuExtension(settings).setup({ override } as never);
    expect(override).toHaveBeenCalledWith(
      ViewSettingsMenuIdentifier,
      expect.any(Function)
    );
    expect(override.mock.calls[0]![1]()).toBe(settings);
  });
});
