import {
  SelectionPaneProvider,
  type SelectionPaneService,
} from '@labre/affine-shared/services';
import { type BlockStdScope, StdIdentifier } from '@labre/std';
import type { ExtensionType } from '@labre/store';

import {
  EDGELESS_SELECTION_PANE_WIDGET,
  type EdgelessSelectionPaneWidget,
} from './selection-pane-widget.js';

/**
 * The widget, found on the editor host — or `null` before it has mounted.
 * A DOM lookup for the reason `artefact-catalogue-default.ts` gives: lit
 * creates and destroys the widget as the root block renders.
 */
function paneWidget(std: BlockStdScope): EdgelessSelectionPaneWidget | null {
  return (
    std.host.querySelector<EdgelessSelectionPaneWidget>(
      EDGELESS_SELECTION_PANE_WIDGET
    ) ?? null
  );
}

/**
 * The DEFAULT `SelectionPaneProvider`: the library's own left panel.
 *
 * Mirrors `artefactCatalogueDefaultExtension` line for line: registered next
 * to the widget, unconditionally (the pane is core chrome, and nothing it
 * lists is a flag's business), with `di.addImpl` so a host's
 * `SelectionPaneExtension(service | null)` — `di.override` — always wins.
 */
export const selectionPaneDefaultExtension: ExtensionType = {
  setup: di => {
    di.addImpl(SelectionPaneProvider, provider => {
      const std = provider.get(StdIdentifier);
      const service: SelectionPaneService = {
        open: () => paneWidget(std)?.openPanel(),
        close: () => paneWidget(std)?.closePanel(),
      };
      return service;
    });
  },
};
