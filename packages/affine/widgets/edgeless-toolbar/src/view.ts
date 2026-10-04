import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';

import { artefactCatalogueDefaultExtension } from './catalogue/artefact-catalogue-default';
import { edgelessArtefactCatalogueWidget } from './catalogue/artefact-catalogue-widget';
import { edgelessToolbarWidget } from './edgeless-toolbar';
import { effects } from './effects';
import { ArtefactPlacementTool } from './placement/artefact-placement-tool';
import { selectionPaneDefaultExtension } from './selection-pane/selection-pane-default';
import { selectionPaneQuickTool } from './selection-pane/selection-pane-tool';
import { edgelessSelectionPaneWidget } from './selection-pane/selection-pane-widget';

export class EdgelessToolbarViewExtension extends ViewExtensionProvider {
  override name = 'affine-edgeless-toolbar-widget';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(edgelessToolbarWidget);
      // The artefact catalogue and the default implementation of the seam that
      // opens it, side by side and unconditionally: the panel is core chrome,
      // and ADR 0009's gating is carried by the frameworks — a framework whose
      // flag is off never passes its owner to `open`. A host with its own
      // sidebar overrides the seam and the widget then never opens.
      context.register(edgelessArtefactCatalogueWidget);
      context.register(artefactCatalogueDefaultExtension);
      // Unconditionally too, and for the same reason: the tool is generic
      // chrome driven by whatever commands are registered, so a framework whose
      // flag is off simply never arms it. See `docs/adr/0009`.
      context.register(ArtefactPlacementTool);
      // The selection pane (ADR 0031), on the catalogue's terms: its panel,
      // the default implementation of its seam, and its toolbar entry, all
      // unconditional. A host replaces or switches it off through
      // `SelectionPaneExtension`; nothing it lists is a flag's business.
      context.register(edgelessSelectionPaneWidget);
      context.register(selectionPaneDefaultExtension);
      context.register(selectionPaneQuickTool);
    }
  }
}
