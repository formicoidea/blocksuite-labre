import type { MenuConfig } from '@labre/affine-components/context-menu';
import { createIdentifier } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import { type ExtensionType, nanoid } from '@labre/store';

import type { DataSource } from '../data-source/base.js';
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
   * default data, selects it and traces `AddDatabaseView`. Returns its id.
   */
  addView: (type: string) => string;
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
}

export const AddViewMenuIdentifier = createIdentifier<AddViewMenu>(
  'DataViewAddViewMenu'
);

export function AddViewMenuExtension(menu: AddViewMenu): ExtensionType {
  return {
    setup: di => {
      di.override(AddViewMenuIdentifier, () => menu);
    },
  };
}
