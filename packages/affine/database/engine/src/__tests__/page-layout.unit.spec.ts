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
 * GUARD — a table follows `PageLayoutKey`, the measure the database block
 * hands it (ADR 0035 amendment of 2026-10-28), and nothing else.
 *
 * What it would have caught:
 * - the table missing `data-page-layout` when its views are the page (its
 *   wrappers kept scrolling sideways inside the page: two scrollbars, labre
 *   recette of 2026-10-26), or keeping it once they are no longer the page;
 * - the column header's script translating a header that sticks natively
 *   on the page, a frame late, so it jumped while the page scrolled (it
 *   read the header's computed `position` before; a header whose rule had
 *   not applied yet was translated anyway);
 * - the inline table losing that script: absent or `false`, the 0.61 table.
 */

const autoUpdates = vi.hoisted(
  () => [] as { reference: unknown; floating: unknown; update: () => void }[]
);

vi.mock('@floating-ui/dom', async importOriginal => ({
  ...(await importOriginal<typeof import('@floating-ui/dom')>()),
  autoUpdate: (reference: unknown, floating: unknown, update: () => void) => {
    autoUpdates.push({ reference, floating, update });
    return () => {};
  },
}));

import { coreEffects } from '../core/effect.js';
import type { PropertyMetaConfig } from '../core/property/property-config.js';
import { PageLayoutKey } from '../core/view-manager/page-layout.js';
import type { ViewManager } from '../core/view-manager/view-manager.js';
import { propertyPresetsEffects } from '../property-presets/effect.js';
import { propertyPresets } from '../property-presets/index.js';
import { viewPresets } from '../view-presets/index.js';
import { pcEffects } from '../view-presets/table/pc/effect.js';
import type { DatabaseColumnHeader } from '../view-presets/table/pc/header/column-header.js';
import { TableViewUILogic } from '../view-presets/table/pc/table-view-ui-logic.js';
import { TableSingleView } from '../view-presets/table/table-view-manager.js';

beforeAll(() => {
  if (!customElements.get('uni-lit')) coreEffects();
  if (!customElements.get('affine-database-text-cell')) {
    propertyPresetsEffects();
  }
  if (!customElements.get('dv-table-view-ui')) pcEffects();
});

beforeEach(() => {
  autoUpdates.length = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const text =
  propertyPresets.textPropertyConfig as unknown as PropertyMetaConfig;

/** A source of two rows and two text properties; `pageLayout` is the key. */
function source(pageLayout?: ReturnType<typeof signal<boolean>>) {
  const properties = signal(['title', 'notes']);
  const viewData = signal<Record<string, unknown>>({
    id: 'view-1',
    name: 'View',
    mode: 'table',
    columns: properties.value.map(id => ({ id, hide: false })),
    filter: { type: 'group', op: 'and', conditions: [] },
  });
  const services = new Map<unknown, unknown>();
  const dataSource = {
    rows$: signal(['r1', 'r2']),
    properties$: properties,
    readonly$: signal(false),
    featureFlags$: signal({
      enable_number_formatting: false,
      enable_table_virtual_scroll: false,
    }),
    propertyMetas$: signal([text]),
    provider: { getAll: () => new Map() },
    viewDataGet: () => viewData.value,
    viewDataUpdate: vi.fn(),
    cellValueGet: () => undefined,
    cellValueChange: vi.fn(),
    propertyTypeGet: () => 'text',
    propertyTypeCanSet: () => true,
    propertyNameGet: (id: string) => id,
    propertyDataGet: () => ({}),
    propertyReadonlyGet: () => false,
    propertyMetaGet: () => text,
    propertyCanDelete: () => true,
    propertyCanDuplicate: () => true,
    serviceGet: (key: unknown) =>
      key === PageLayoutKey ? (pageLayout ?? null) : null,
    serviceGetOrCreate: (key: unknown, create: () => unknown) => {
      if (!services.has(key)) services.set(key, create());
      return services.get(key);
    },
    viewMetaGet: () => viewPresets.tableViewMeta,
    cellStatus: () => 'ready',
  };
  const readonly$ = dataSource.readonly$;
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
      handleEvent: () => ({ dispose: () => {} }),
      bindHotkey: () => ({ dispose: () => {} }),
    },
    selection$,
    setSelection: (selection: unknown) => {
      selection$.value = selection;
    },
    openDetailPanel: vi.fn(),
  };
  return { manager, root };
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

async function mountTable(pageLayout?: ReturnType<typeof signal<boolean>>) {
  const { manager, root } = source(pageLayout);
  const view = new TableSingleView(manager, 'view-1');
  const logic = new TableViewUILogic(root as never, view);
  const ui = document.createElement('dv-table-view-ui');
  ui.logic = logic;
  document.body.append(ui);
  await settle();
  const header = ui.querySelector<DatabaseColumnHeader>(
    'affine-database-column-header'
  )!;
  const update = autoUpdates.find(entry => entry.floating === header)!.update;
  return { ui, header, update };
}

/** The group scrolled 100px above the scroll container's top. */
function scrolledPast(header: DatabaseColumnHeader) {
  const group = header.closest('affine-data-view-table-group')!;
  const rect = (top: number, height: number) =>
    ({
      top,
      bottom: top + height,
      height,
      left: 0,
      right: 0,
      width: 0,
    }) as DOMRect;
  vi.spyOn(group, 'getBoundingClientRect').mockReturnValue(rect(-100, 500));
  vi.spyOn(header, 'getBoundingClientRect').mockReturnValue(rect(-100, 30));
  vi.spyOn(document.body, 'getBoundingClientRect').mockReturnValue(
    rect(0, 400)
  );
  vi.spyOn(header, 'getScale').mockReturnValue(1);
}

describe('a table and its page layout', () => {
  it('is marked data-page-layout while the key is true, and follows it', async () => {
    const pageLayout = signal(true);
    const { ui } = await mountTable(pageLayout);
    expect(ui.hasAttribute('data-page-layout')).toBe(true);

    pageLayout.value = false;
    await settle();
    expect(ui.hasAttribute('data-page-layout')).toBe(false);

    pageLayout.value = true;
    await settle();
    expect(ui.hasAttribute('data-page-layout')).toBe(true);
  });

  it('is not marked without the key, the inline table of 0.61', async () => {
    const { ui } = await mountTable();
    expect(ui.hasAttribute('data-page-layout')).toBe(false);
  });

  it('leaves the column header alone while the key is true', async () => {
    const { header, update } = await mountTable(signal(true));
    scrolledPast(header);
    update();
    expect(header.style.transform).toBe('');
  });

  it('translates the column header of an inline table', async () => {
    const { header, update } = await mountTable(signal(false));
    scrolledPast(header);
    update();
    expect(header.style.transform).toBe('translate3d(0,100px,0)');
  });

  it('drops a translate left from before the page layout applied', async () => {
    const pageLayout = signal(false);
    const { header, update } = await mountTable(pageLayout);
    scrolledPast(header);
    update();
    expect(header.style.transform).not.toBe('');

    pageLayout.value = true;
    update();
    expect(header.style.transform).toBe('');
  });
});
