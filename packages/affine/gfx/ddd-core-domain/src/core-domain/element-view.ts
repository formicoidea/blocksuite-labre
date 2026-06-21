import type { CoreDomainChartElementModel } from '@labre/affine-model';
import {
  GfxElementModelView,
  GfxViewInteractionExtension,
} from '@labre/std/gfx';

/**
 * View for the Core Domain Chart background. Registering it ensures
 * `gfx.view.get(model)` returns a view (required so move / select work).
 */
export class CoreDomainView extends GfxElementModelView<CoreDomainChartElementModel> {
  static override type: string = 'coreDomain';
}

/** Resize gating: handles hidden unless `model.resizeEnabled` (toolbar toggle). */
export const CoreDomainInteraction = GfxViewInteractionExtension<CoreDomainView>(
  CoreDomainView.type,
  {
    handleResize({ model }) {
      return {
        beforeResize({ set }) {
          if (!model.resizeEnabled) {
            set({ allowedHandlers: [] });
          }
        },
      };
    },
  }
);
