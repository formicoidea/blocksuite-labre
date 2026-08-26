import {
  ArtefactCatalogueProvider,
  type ArtefactCatalogueService,
} from '@labre/affine-shared/services';
import { type BlockStdScope, StdIdentifier } from '@labre/std';
import type { ExtensionType } from '@labre/store';

import {
  EDGELESS_ARTEFACT_CATALOGUE_WIDGET,
  type EdgelessArtefactCatalogueWidget,
} from './artefact-catalogue-widget.js';

/**
 * The widget, found on the editor host — or `null` before it has mounted, and
 * on a page-mode editor where it is not registered at all.
 *
 * A DOM lookup rather than a reference held at registration time, because the
 * widget is created and destroyed by lit as the root block renders: the same
 * lookup `EditorAnchoredPanel` makes for the toolbar it measures against. A
 * `null` here is not an error — it is a catalogue nobody can open yet, and the
 * `open` below is then a no-op rather than a throw in a menu click handler.
 */
function catalogueWidget(
  std: BlockStdScope
): EdgelessArtefactCatalogueWidget | null {
  return (
    std.host.querySelector<EdgelessArtefactCatalogueWidget>(
      EDGELESS_ARTEFACT_CATALOGUE_WIDGET
    ) ?? null
  );
}

/**
 * The DEFAULT `ArtefactCatalogueProvider`: the library's own left sidepanel.
 *
 * Registered next to the widget itself (`EdgelessToolbarViewExtension`), and
 * unconditionally — a catalogue is core chrome, not a framework's tooling. ADR
 * 0009's gating is carried by the frameworks: a framework whose flag is off
 * shows no senior button, so its owner is never passed to `open`, and the panel
 * simply never opens for it.
 *
 * `di.addImpl`, so a host's `ArtefactCatalogueExtension(service)` — which uses
 * `di.override` — wins whatever the registration order.
 */
export const artefactCatalogueDefaultExtension: ExtensionType = {
  setup: di => {
    di.addImpl(ArtefactCatalogueProvider, provider => {
      const std = provider.get(StdIdentifier);
      const service: ArtefactCatalogueService = {
        open: owner => catalogueWidget(std)?.openFor(owner),
        close: () => catalogueWidget(std)?.closePanel(),
      };
      return service;
    });
  },
};
