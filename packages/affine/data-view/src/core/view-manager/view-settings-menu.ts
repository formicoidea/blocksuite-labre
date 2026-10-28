import type {
  MenuConfig,
  PopupTarget,
} from '@labre/affine-components/context-menu';
import { createIdentifier } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import type { ExtensionType } from '@labre/store';

import type { Wording } from '../utils/wording.js';
import type { DataViewUILogicBase } from '../view/data-view-base.js';

/** What the view settings menu hands a {@link ViewSettingsMenu} when it opens. */
export interface ViewSettingsMenuContext {
  /** The editor the view is drawn in. */
  std: BlockStdScope;
  dataViewLogic: DataViewUILogicBase;
  /** Where the view settings menu was popped: a setting's own menu pops there too. */
  target: PopupTarget;
  /** Reopens the view settings menu: a setting's "back". */
  reopen(): void;
  /** The view settings' own wordings, resolved through the editor's catalogue. */
  wording: Wording;
}

/**
 * Entries of the view settings menu that something above data-view knows
 * how to offer (ADR 0035 amendment of 2026-10-28): the `core-database`
 * bundle registers one from its tooling extension for "Source", which needs
 * the data-source picker it alone reads. Drawn in the Layout group, after
 * "Layout" (Notion's order: Layout, Source). A registry between library
 * packages, never filled by a host, so it has no row in the seams table.
 * Absent, or answering `undefined` for a view it does not handle, the menu
 * is the 0.61 one.
 */
export interface ViewSettingsMenu {
  items(context: ViewSettingsMenuContext): MenuConfig[] | undefined;
}

export const ViewSettingsMenuIdentifier = createIdentifier<ViewSettingsMenu>(
  'DataViewViewSettingsMenu'
);

export function ViewSettingsMenuExtension(
  menu: ViewSettingsMenu
): ExtensionType {
  return {
    setup: di => {
      di.override(ViewSettingsMenuIdentifier, () => menu);
    },
  };
}
