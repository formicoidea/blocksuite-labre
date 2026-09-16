import type { EditableBackgroundLabel } from '@labre/affine-block-surface';
import {
  FrameworkBackgroundView,
  hitTestBackgroundLabel,
} from '@labre/affine-block-surface';
import type { CynefinElementModel } from '@labre/affine-model';
import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import { GfxViewInteractionExtension } from '@labre/std/gfx';

import { cynefinLabelHits } from './labels';

/**
 * View for the Cynefin background. Registering it ensures `gfx.view.get(model)`
 * returns a view (required so move / select interactions work).
 *
 * Extends {@link FrameworkBackgroundView} rather than
 * `DeclaredBackgroundView`: this diagram is a figurative reproduction of the
 * official SVG and has no `FrameworkBackgroundDef` behind it, so it says where
 * its labels are in its own reference space. The gesture itself — where a
 * double-click is allowed to land, the in-place `<input>`, the commit that
 * refuses to write an untouched value — is the shared one (issue #355).
 */
export class CynefinView extends FrameworkBackgroundView<CynefinElementModel> {
  static override type: string = 'cynefin';

  protected override labelAt(
    lx: number,
    ly: number,
    w: number,
    h: number
  ): EditableBackgroundLabel | null {
    const translate = (wording: ChromeWording) =>
      translateKey(this.gfx.std, ...wording);
    const hit = hitTestBackgroundLabel(
      cynefinLabelHits(this.model, w, h, translate),
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
export const CynefinInteraction = GfxViewInteractionExtension<CynefinView>(
  CynefinView.type,
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
