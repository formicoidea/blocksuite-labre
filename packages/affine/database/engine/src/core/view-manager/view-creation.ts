import {
  menu,
  type MenuConfig,
  popMenu,
  type PopupTarget,
} from '@labre/affine-components/context-menu';
import type {
  DatabaseAllEvents,
  EventTraceFn,
} from '@labre/affine-shared/services';
import { createIdentifier } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import { type ExtensionType, nanoid } from '@labre/store';
import { html } from 'lit';

import type { DataSource } from '../data-source/base.js';
import { viewDefaultName } from '../view/default-name.js';
import type { ViewManager } from './view-manager.js';

/**
 * Set to `true` on a data source (`serviceSet`) whose host switched off the
 * tooling that CREATES views: the views bar then offers no "+" and no
 * "Create …" (ADR 0035 §5, ADR 0009). Absent means offered, so every source
 * that never sets it keeps its 0.48 views bar. The stored views keep
 * rendering, switching layout and being deleted: only creation is tooling.
 */
export const ViewCreationOffKey = createIdentifier<true>(
  'data-view-view-creation-off'
);

/**
 * "Duplicate as table": the way out of a view shown through a fallback
 * preset (`SingleView.shownAsFallback$`). Adds a view of the preset that drew
 * it, under the same name, with that preset's default data, and selects it;
 * the stored view is left exactly as it was, so a client that knows its mode
 * still reads it. Returns the new view's id, or `undefined` when there is no
 * such view or it is not a fallback.
 */
export function duplicateAsShownPreset(
  manager: ViewManager,
  viewId: string
): string | undefined {
  const view = manager.viewGet(viewId);
  if (!view || !view.shownAsFallback$.peek()) return;
  const meta = view.meta;
  const id = manager.dataSource.viewDataAdd({
    ...meta.model.defaultData(manager),
    id: nanoid(),
    name: view.name$.peek(),
    mode: meta.type,
  });
  manager.setCurrentView(id);
  return id;
}

/** What the views bar hands an {@link AddViewMenu} when "+" is clicked. */
export interface AddViewMenuContext {
  /** The editor the bar is mounted in; absent outside one. */
  std: BlockStdScope | undefined;
  dataSource: DataSource;
  viewManager: ViewManager;
  /**
   * The bar's own "add a view of this preset": adds it with the preset's
   * default data and its name resolved at the gesture, selects it and traces
   * `DatabaseViewAdded` once, `source` (default `existing`) saying whether the
   * gesture created the source the view reads. Returns its id.
   */
  addView: (type: string, source?: 'existing' | 'new') => string;
}

/**
 * The "+" menu of the views bar, when something above data-view knows more
 * than the presets (ADR 0035 §1, B11): the `core-database` bundle registers
 * one from its tooling extension to offer "on an existing source" and "with
 * a new source". It is a registry between library packages, never filled by
 * a host. Absent, or answering `undefined` for a data source it does not
 * handle, the bar offers the creatable presets, as in 0.48.
 */
export interface AddViewMenu {
  items(context: AddViewMenuContext): MenuConfig[] | undefined;
  /**
   * The placeholder of the menu's search field, shown from the start when
   * given; absent or `undefined`, the field shows once something is typed.
   */
  searchPlaceholder?(context: AddViewMenuContext): string | undefined;
}

export const AddViewMenuIdentifier = createIdentifier<AddViewMenu>(
  'DataViewAddViewMenu'
);

/**
 * Whether a view may be added to `dataSource` now: it is writable and its
 * host did not switch view creation off (`ViewCreationOffKey`). What the
 * views bar's "+" and the empty state of a database with no view read.
 */
export function canAddView(dataSource: DataSource): boolean {
  return (
    !dataSource.readonly$.value &&
    dataSource.serviceGet(ViewCreationOffKey) !== true
  );
}

/** Who adds a view: the views bar's "+", or the empty state of no view. */
export interface AddViewGesture {
  std: BlockStdScope | undefined;
  dataSource: DataSource;
  eventTrace: EventTraceFn<DatabaseAllEvents>;
  /** After the view is added and made current (the block remembers it). */
  onAdded?: (viewId: string) => void;
}

/**
 * The one "add a view" gesture (ADR 0035 B11, amendment of 2026-11-20): the
 * name is resolved at the gesture and written as is (ADR 0023), the view is
 * made current, and `DatabaseViewAdded` is reported once (B17), `source`
 * saying whether the gesture created the source the view reads. Returns
 * its id.
 */
function addViewOf(gesture: AddViewGesture) {
  return (type: string, source: 'existing' | 'new' = 'existing') => {
    const { dataSource, std } = gesture;
    const manager = dataSource.viewManager;
    const id = manager.viewAdd(
      type,
      viewDefaultName(dataSource.viewMetaGet(type), std)
    );
    manager.setCurrentView(id);
    gesture.onAdded?.(id);
    gesture.eventTrace('DatabaseViewAdded', { viewType: type, source });
    return id;
  };
}

/**
 * Pops what "+" offers: the {@link AddViewMenu} a package above registers
 * (the `core-database` bundle's sources) when it handles this source, the
 * creatable presets otherwise, as in 0.48. Shared by the views bar and the
 * empty state of a database with no view, so both are one gesture.
 */
export function popAddViewMenu(target: PopupTarget, gesture: AddViewGesture) {
  const { std, dataSource } = gesture;
  const addView = addViewOf(gesture);
  const addViewMenu = std?.getOptional(AddViewMenuIdentifier);
  const context: AddViewMenuContext = {
    std,
    dataSource,
    viewManager: dataSource.viewManager,
    addView,
  };
  const items = addViewMenu?.items(context);
  const placeholder = items && addViewMenu?.searchPlaceholder?.(context);
  const presets = () =>
    dataSource.viewMetas.map(meta =>
      menu.action({
        name: viewDefaultName(meta, std),
        testId: 'database-add-view-preset',
        prefix: html`<uni-lit .uni=${meta.renderer.icon}></uni-lit>`,
        select: () => {
          addView(meta.type);
        },
      })
    );
  popMenu(target, {
    options: {
      items: items ?? presets(),
      search: placeholder ? { placeholder } : undefined,
    },
  });
}

export function AddViewMenuExtension(menu: AddViewMenu): ExtensionType {
  return {
    setup: di => {
      di.override(AddViewMenuIdentifier, () => menu);
    },
  };
}
