import {
  type PopupTarget,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import {
  type ChromeWording,
  DataSourcePickerProvider,
} from '@labre/affine-shared/services';
import { type DataSource, ViewSettingsMenuIdentifier } from '@labre/data-view';
import type { AnyCommandDescriptor, BlockStdScope } from '@labre/std';
import type { ReadonlySignal } from '@preact/signals-core';

import {
  PROPERTIES_PANEL_TITLE,
  VIEW_MENU_COLOR_RULES,
  VIEW_MENU_GROUP,
  VIEW_MENU_IMPORT,
  VIEW_MENU_LAYOUT,
  VIEW_MENU_OPEN_IN,
  VIEW_MENU_SAVE_TEMPLATE,
  VIEW_SETTINGS_SOURCE,
} from '../translations.js';
import {
  changeSourceTarget,
  popChangeSourcePicker,
} from '../view-settings/source-entry.js';
import {
  canImportView,
  currentViewTemplate,
  requestViewImport,
} from '../view-transfer/import-view.js';

/**
 * The full page's "This view" (labre PRD REQ-DB-10, ADR 0035 amendment of
 * 2026-10-14): the settings of the view the page shows, as commands on the
 * `'view-menu'` surface, so a host lists them with `getViewActions` and runs
 * them with `runViewAction` (`@labre/affine/host-panels`), as it does the
 * canvas grid. They are a projection, not a second implementation: a setting
 * opens the very menu the view settings' entry opens (`openSetting` of the
 * view's options button, `popViewSetting` in `@labre/data-view`), anchored on
 * that button, its "back" leading to the view settings.
 *
 * Registered by `databasePageRootExtension` only, so they exist on the full
 * page of a database and nowhere else: an inline database keeps its own
 * menu, and the host's header lists nothing of it (ui-principles §1 of the
 * Labre app: the header carries only what serves the open object).
 *
 * Not in `@labre/affine`'s `getCommands()`: core never imports this bundle
 * (`core-database-boundary.unit.spec.ts`), and these commands have no
 * meaning without an editor showing the page; with no default chord they
 * bind nothing. `scope: 'page'`: the page is a page editor.
 *
 * A read-only page lists none of them, as the view settings button is not
 * drawn there; a fallback view (ADR 0035 §6) has no settings either.
 */

/**
 * `DataViewHeaderToolsViewOptions` and `ViewSettingKey` of
 * `@labre/data-view/widget-presets`, by shape: this bundle reaches data-view
 * through core's root shim only (`core-database-boundary.unit.spec.ts`).
 * The integration spec `database-page-view-menu.spec.ts` holds the shape.
 */
type ViewSettingKey =
  | 'layout'
  | 'properties'
  | 'group'
  | 'open-in'
  | 'color-rules';
interface ViewOptionsElement extends HTMLElement {
  dataViewLogic: {
    view: {
      id: string;
      readonly$: ReadonlySignal<boolean>;
      shownAsFallback$: ReadonlySignal<boolean>;
      manager: { dataSource: DataSource };
    };
  };
  settingAvailable(key: ViewSettingKey): boolean;
  openSetting(key: ViewSettingKey): void;
  openMoreAction(target: PopupTarget): void;
}

/** The current view's options button on the page: what knows the view. */
function viewOptions(std: BlockStdScope, hostBlockId: string) {
  const block = std.view.getBlock(hostBlockId);
  return (
    block?.querySelector<ViewOptionsElement>(
      'data-view-header-tools-view-options'
    ) ?? null
  );
}

function dataSourceOf(std: BlockStdScope, hostBlockId: string) {
  return viewOptions(std, hostBlockId)?.dataViewLogic.view.manager.dataSource;
}

/**
 * The current view's "Source", where the view settings offer it: the same
 * predicate (`changeSourceTarget`), and only with the tooling extension's
 * entry registered, so `{ database: false }` drops both.
 */
function sourceChange(std: BlockStdScope, hostBlockId: string) {
  if (!std.getOptional(ViewSettingsMenuIdentifier)) return;
  const options = viewOptions(std, hostBlockId);
  if (!options) return;
  const view = options.dataViewLogic.view;
  const change = changeSourceTarget(std, view.manager.dataSource, view);
  return change && { options, change };
}

function setting(
  hostBlockId: string,
  key: ViewSettingKey,
  wording: ChromeWording,
  order: number
): AnyCommandDescriptor {
  return {
    id: `database.view.${key}`,
    owner: 'core',
    kind: 'action',
    labelKey: wording[0],
    labelFallback: wording[1],
    category: 'view',
    surfaces: ['view-menu'],
    order,
    scope: 'page',
    defaultKeys: { mac: [], other: [] },
    // The view settings menu's own rule (`settingAvailable`): grouping
    // needs the group trait, "Open pages in" rows that are pages.
    when: std => !!viewOptions(std, hostBlockId)?.settingAvailable(key),
    run: std => {
      viewOptions(std, hostBlockId)?.openSetting(key);
    },
  };
}

export function databasePageViewCommands(
  hostBlockId: string
): AnyCommandDescriptor[] {
  const picker = (std: BlockStdScope) =>
    std.getOptional(DataSourcePickerProvider);
  return [
    setting(hostBlockId, 'layout', VIEW_MENU_LAYOUT, 0),
    {
      id: 'database.view.source',
      owner: 'core',
      kind: 'action',
      labelKey: VIEW_SETTINGS_SOURCE[0],
      labelFallback: VIEW_SETTINGS_SOURCE[1],
      category: 'view',
      surfaces: ['view-menu'],
      order: 1,
      scope: 'page',
      defaultKeys: { mac: [], other: [] },
      when: std => !!sourceChange(std, hostBlockId),
      // The picker the entry opens, anchored on the options button, its
      // "back" opening the view settings there.
      run: std => {
        const found = sourceChange(std, hostBlockId);
        if (!found) return;
        const target = popupTargetFromElement(found.options);
        popChangeSourcePicker(std, target, found.change, () =>
          found.options.openMoreAction(target)
        );
      },
    },
    setting(hostBlockId, 'group', VIEW_MENU_GROUP, 2),
    setting(hostBlockId, 'open-in', VIEW_MENU_OPEN_IN, 3),
    setting(hostBlockId, 'properties', PROPERTIES_PANEL_TITLE, 4),
    setting(hostBlockId, 'color-rules', VIEW_MENU_COLOR_RULES, 5),
    {
      id: 'database.view.save-template',
      owner: 'core',
      kind: 'action',
      labelKey: VIEW_MENU_SAVE_TEMPLATE[0],
      labelFallback: VIEW_MENU_SAVE_TEMPLATE[1],
      category: 'view',
      surfaces: ['view-menu'],
      order: 6,
      scope: 'page',
      defaultKeys: { mac: [], other: [] },
      when: std => {
        const dataSource = dataSourceOf(std, hostBlockId);
        return (
          !!picker(std)?.saveViewTemplate &&
          !!dataSource &&
          !dataSource.readonly$.value &&
          currentViewTemplate(dataSource) !== null
        );
      },
      run: async std => {
        const save = picker(std)?.saveViewTemplate;
        const dataSource = dataSourceOf(std, hostBlockId);
        const template = dataSource && currentViewTemplate(dataSource);
        if (!save || !template) return;
        await save.call(picker(std), template);
      },
    },
    {
      id: 'database.view.import',
      owner: 'core',
      kind: 'action',
      labelKey: VIEW_MENU_IMPORT[0],
      labelFallback: VIEW_MENU_IMPORT[1],
      category: 'transfer',
      surfaces: ['view-menu'],
      order: 7,
      scope: 'page',
      defaultKeys: { mac: [], other: [] },
      when: std => {
        const dataSource = dataSourceOf(std, hostBlockId);
        return !!dataSource && canImportView(picker(std), dataSource);
      },
      run: std => {
        const dataSource = dataSourceOf(std, hostBlockId);
        if (dataSource) requestViewImport(picker(std), dataSource);
      },
    },
  ];
}
