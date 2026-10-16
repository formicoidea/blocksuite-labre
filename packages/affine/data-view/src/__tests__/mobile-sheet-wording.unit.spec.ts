import {
  effects as menuEffects,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import {
  TOOLBAR_DELETE,
  TOOLBAR_DUPLICATE,
  TranslationProvider,
} from '@labre/affine-shared/services';
import { type BlockStdScope, stdContext } from '@labre/std';
import { ContextProvider } from '@lit/context';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * The base's two phone sheets speak the host's catalogue (P7, "Vues de base
 * sur mobile", 390px): "View settings" (the view's "..." button) and
 * "Property settings" (a column header). A phone's sheet hangs from the
 * body, out of the editor's DOM, so it cannot ask for `std` on its own.
 *
 * What it would have caught:
 * - the sheets' entries written as English literals (Layout, "5 shown",
 *   Filter, Sort, Group, Insert left/right column, Move right, Duplicate,
 *   Delete), which a French host showed untranslated;
 * - "Done" in English although its key exists, because the sheet found no
 *   editor to translate it with, on the sheet and on a sub-sheet it opens;
 * - a sheet opened outside any editor that stops reading English.
 */
vi.mock('@labre/global/env', async importOriginal => ({
  ...(await importOriginal<typeof import('@labre/global/env')>()),
  IS_MOBILE: true,
}));

import { coreEffects } from '../core/effect.js';
import type { DataViewUILogicBase } from '../core/index.js';
import type { PropertyMetaConfig } from '../core/property/property-config.js';
import { wordingOf } from '../core/utils/wording.js';
import type { ViewManager } from '../core/view-manager/view-manager.js';
import { propertyPresetsEffects } from '../property-presets/effect.js';
import { propertyPresets } from '../property-presets/index.js';
import { viewPresets } from '../view-presets/index.js';
import { MobileTableColumnHeader } from '../view-presets/table/mobile/column-header.js';
import { TableSingleView } from '../view-presets/table/table-view-manager.js';
import {
  DATA_VIEW_COLOR_RULES,
  DATA_VIEW_FILTER,
  DATA_VIEW_FILTER_COUNT,
  DATA_VIEW_GROUP,
  DATA_VIEW_INSERT_LEFT,
  DATA_VIEW_INSERT_RIGHT,
  DATA_VIEW_LAYOUT,
  DATA_VIEW_PROPERTIES,
  DATA_VIEW_PROPERTIES_SHOWN,
  DATA_VIEW_PROPERTY_HIDE_IN_VIEW,
  DATA_VIEW_PROPERTY_NAME,
  DATA_VIEW_PROPERTY_SETTINGS,
  DATA_VIEW_PROPERTY_TYPE,
  DATA_VIEW_PROPERTY_TYPE_ENTRY,
  DATA_VIEW_SORT,
  DATA_VIEW_SORT_COUNT,
  DATA_VIEW_VIEW_SETTINGS,
  DATA_VIEW_WORDINGS,
  VIEWS_BAR_MOVE_LEFT,
  VIEWS_BAR_MOVE_RIGHT,
  VIEW_NAME_TABLE,
} from '../translations.js';
import { popViewOptions } from '../widget-presets/tools/presets/view-options/view-options.js';

const DONE = 'com.labre.context-menu.done';

const french: Record<string, string> = {
  [DONE]: 'Terminé',
  [DATA_VIEW_VIEW_SETTINGS[0]]: 'Paramètres de la vue',
  [DATA_VIEW_LAYOUT[0]]: 'Disposition',
  [DATA_VIEW_PROPERTIES[0]]: 'Propriétés',
  [DATA_VIEW_PROPERTIES_SHOWN[0]]: '{{count}} affichée(s)',
  [DATA_VIEW_FILTER[0]]: 'Filtrer',
  [DATA_VIEW_FILTER_COUNT[0]]: '{{count}} filtre(s)',
  [DATA_VIEW_SORT[0]]: 'Trier',
  [DATA_VIEW_SORT_COUNT[0]]: '{{count}} tri(s)',
  [DATA_VIEW_GROUP[0]]: 'Grouper',
  [DATA_VIEW_COLOR_RULES[0]]: 'Couleurs conditionnelles',
  [VIEW_NAME_TABLE[0]]: 'Vue tableau',
  [TOOLBAR_DUPLICATE[0]]: 'Dupliquer',
  [TOOLBAR_DELETE[0]]: 'Supprimer',
  [DATA_VIEW_PROPERTY_SETTINGS[0]]: 'Paramètres de la propriété',
  [DATA_VIEW_PROPERTY_TYPE_ENTRY[0]]: 'Type',
  [DATA_VIEW_PROPERTY_TYPE[0]]: 'Type de propriété',
  [DATA_VIEW_PROPERTY_HIDE_IN_VIEW[0]]: 'Masquer dans cette vue',
  [DATA_VIEW_INSERT_LEFT[0]]: 'Insérer une colonne à gauche',
  [DATA_VIEW_INSERT_RIGHT[0]]: 'Insérer une colonne à droite',
  [VIEWS_BAR_MOVE_LEFT[0]]: 'Déplacer à gauche',
  [VIEWS_BAR_MOVE_RIGHT[0]]: 'Déplacer à droite',
};

const frenchStd = {
  getOptional: (id: unknown) =>
    id === TranslationProvider
      ? {
          t: (key: string, params?: Record<string, string | number>) =>
            french[key]?.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
              String(params?.[name])
            ),
          language: 'fr',
        }
      : null,
} as unknown as BlockStdScope;

beforeAll(() => {
  if (!customElements.get('uni-lit')) coreEffects();
  if (!customElements.get('affine-database-text-cell')) {
    propertyPresetsEffects();
  }
  if (!customElements.get('mobile-menu')) menuEffects();
  if (!customElements.get('test-mobile-column-header')) {
    customElements.define('test-mobile-column-header', MobileTableColumnHeader);
  }
});

afterEach(() => {
  document.body.innerHTML = '';
});

const metas: Record<string, PropertyMetaConfig> = {
  title: propertyPresets.textPropertyConfig as unknown as PropertyMetaConfig,
  text: propertyPresets.textPropertyConfig as unknown as PropertyMetaConfig,
  number: propertyPresets.numberPropertyConfig as unknown as PropertyMetaConfig,
};

/** A table of three properties, one filter and two sorts. */
function tableView() {
  const properties = signal(['title', 'note', 'size']);
  const types: Record<string, string> = {
    title: 'title',
    note: 'text',
    size: 'number',
  };
  const viewData = signal<Record<string, unknown>>({
    id: 'view-1',
    name: 'View',
    mode: 'table',
    columns: properties.value.map(id => ({ id, hide: false })),
    filter: {
      type: 'group',
      op: 'and',
      conditions: [
        {
          type: 'filter',
          left: { type: 'ref', name: 'note' },
          function: 'is-not-empty',
          args: [],
        },
      ],
    },
    sort: {
      sortBy: [
        { ref: { type: 'ref', name: 'note' }, desc: false },
        { ref: { type: 'ref', name: 'size' }, desc: true },
      ],
    },
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
    propertyMetas$: signal([metas.text, metas.number]),
    provider: { getAll: () => new Map() },
    viewDataGet: () => viewData.value,
    viewDataUpdate: vi.fn(),
    cellValueGet: () => undefined,
    propertyTypeGet: (id: string) => types[id],
    propertyTypeCanSet: (id: string) => types[id] !== 'title',
    propertyTypeSet: vi.fn(),
    propertyNameGet: (id: string) => id,
    propertyNameSet: vi.fn(),
    propertyDataGet: () => ({}),
    propertyReadonlyGet: () => false,
    propertyMetaGet: (type: string) => metas[type],
    propertyAdd: vi.fn(),
    propertyDelete: vi.fn(),
    propertyCanDelete: (id: string) => types[id] !== 'title',
    propertyDuplicate: vi.fn(),
    propertyCanDuplicate: (id: string) => types[id] !== 'title',
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

const sheets = () =>
  [...document.body.querySelectorAll('mobile-menu')].map(
    sheet => sheet.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  );

async function openPropertySheet(propertyId: string, std?: BlockStdScope) {
  const view = tableView();
  const header = document.createElement(
    'test-mobile-column-header'
  ) as MobileTableColumnHeader;
  header.column = view.propertyGetOrCreate(propertyId);
  header.tableViewManager = view;
  inEditor(std).append(header);
  await settle();
  header.editTitle();
  await settle();
  return header;
}

async function openViewSettings(std?: BlockStdScope) {
  const view = tableView();
  const anchor = document.createElement('div');
  inEditor(std).append(anchor);
  const logic = { view, eventTrace: vi.fn() } as unknown as DataViewUILogicBase;
  popViewOptions(
    popupTargetFromElement(anchor),
    logic,
    undefined,
    wordingOf(std)
  );
  await settle();
}

describe('the property settings sheet', () => {
  it('speaks the catalogue of the editor its column sits in', async () => {
    await openPropertySheet('note', frenchStd);
    const [sheet] = sheets();
    for (const word of [
      'Paramètres de la propriété',
      'Terminé',
      'Type',
      'Masquer dans cette vue',
      'Insérer une colonne à gauche',
      'Insérer une colonne à droite',
      'Déplacer à gauche',
      'Déplacer à droite',
      'Dupliquer',
      'Supprimer',
    ]) {
      expect(sheet).toContain(word);
    }
    expect(sheet).not.toMatch(/\b(Done|Insert|Move|Duplicate|Delete|Hide)\b/);
  });

  it('a sub-sheet it opens finds the same editor', async () => {
    await openPropertySheet('note', frenchStd);
    const type = [
      ...document.body.querySelectorAll<HTMLElement>('mobile-sub-menu'),
    ].find(entry => entry.textContent?.includes('Type'));
    type!.click();
    await settle();
    const all = sheets();
    expect(all).toHaveLength(2);
    expect(all[1]).toContain('Type de propriété');
    expect(all[1]).toContain('Terminé');
  });

  it('reads English outside an editor', async () => {
    await openPropertySheet('note');
    const [sheet] = sheets();
    for (const word of [
      'Property settings',
      'Done',
      'Insert left column',
      'Move right',
      'Duplicate',
      'Delete',
    ]) {
      expect(sheet).toContain(word);
    }
  });
});

describe('the view settings sheet', () => {
  it('speaks the catalogue of the editor its button sits in', async () => {
    await openViewSettings(frenchStd);
    const [sheet] = sheets();
    for (const word of [
      'Paramètres de la vue',
      'Terminé',
      'Disposition',
      'Vue tableau',
      'Propriétés',
      '3 affichée(s)',
      'Filtrer',
      '1 filtre(s)',
      'Trier',
      '2 tri(s)',
      'Grouper',
      'Dupliquer',
      'Supprimer',
    ]) {
      expect(sheet).toContain(word);
    }
    expect(sheet).not.toMatch(
      /\b(Done|Layout|Table|shown|Filter|Sort|Group|Duplicate|Delete)\b/
    );
  });

  it('reads English outside an editor', async () => {
    await openViewSettings();
    const [sheet] = sheets();
    for (const word of [
      'View settings',
      'Done',
      'Layout',
      'Table View',
      '3 shown',
      'Filter',
      '1 filter(s)',
      'Sort',
      '2 sort(s)',
      'Group',
    ]) {
      expect(sheet).toContain(word);
    }
  });
});

it('every word of the two sheets is a key the manifest walks', () => {
  for (const word of [
    DATA_VIEW_VIEW_SETTINGS,
    DATA_VIEW_LAYOUT,
    DATA_VIEW_GROUP,
    DATA_VIEW_SORT,
    DATA_VIEW_PROPERTIES_SHOWN,
    DATA_VIEW_FILTER_COUNT,
    DATA_VIEW_SORT_COUNT,
    DATA_VIEW_PROPERTY_SETTINGS,
    DATA_VIEW_PROPERTY_NAME,
    DATA_VIEW_PROPERTY_TYPE_ENTRY,
    DATA_VIEW_INSERT_LEFT,
    DATA_VIEW_INSERT_RIGHT,
  ]) {
    expect(word[0]).toMatch(/^com\.labre\./);
    expect(DATA_VIEW_WORDINGS).toContain(word);
  }
  // Declared by the selection pane, restated here: one word, one key.
  expect(DATA_VIEW_WORDINGS).not.toContain(DATA_VIEW_FILTER);
});
