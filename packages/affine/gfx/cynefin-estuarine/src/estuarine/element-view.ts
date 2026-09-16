import type { EditableBackgroundLabel } from '@labre/affine-block-surface';
import {
  FrameworkBackgroundView,
  hitTestBackgroundLabel,
} from '@labre/affine-block-surface';
import type { EstuarineElementModel } from '@labre/affine-model';
import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import { GfxViewInteractionExtension } from '@labre/std/gfx';

import { estuarineFit } from './element-renderer';
import { estuarineLabelHits } from './labels';

/**
 * View for the Estuarine background. Registering it ensures `gfx.view.get(model)`
 * returns a view (required so move / select interactions work).
 *
 * Extends {@link FrameworkBackgroundView} rather than
 * `DeclaredBackgroundView`: the map is a reproduction of the official SVG with
 * a stretch of its own and no `FrameworkBackgroundDef` behind it, so it says
 * where its three legends are through the very fit the renderer anchors them
 * with. The gesture itself is the shared one (issue #355).
 */
export class EstuarineView extends FrameworkBackgroundView<EstuarineElementModel> {
  static override type: string = 'estuarine';

  protected override labelAt(
    lx: number,
    ly: number,
    w: number,
    h: number
  ): EditableBackgroundLabel | null {
    const translate = (wording: ChromeWording) =>
      translateKey(this.gfx.std, ...wording);
    const hit = hitTestBackgroundLabel(
      estuarineLabelHits(this.model, estuarineFit(w, h), translate),
      lx,
      ly
    );
    return hit ? { prop: hit.prop, text: hit.text } : null;
  }
}

/**
 * Resize gating: the resize handles are hidden unless `model.resizeEnabled` is
 * true (toggled from the toolbar). Moving / selecting stays available.
 */
export const EstuarineInteraction = GfxViewInteractionExtension<EstuarineView>(
  EstuarineView.type,
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
