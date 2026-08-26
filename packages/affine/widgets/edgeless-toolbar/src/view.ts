import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';

import { artefactCatalogueDefaultExtension } from './catalogue/artefact-catalogue-default';
import { edgelessArtefactCatalogueWidget } from './catalogue/artefact-catalogue-widget';
import { edgelessToolbarWidget } from './edgeless-toolbar';
import { effects } from './effects';

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
    }
  }
}
