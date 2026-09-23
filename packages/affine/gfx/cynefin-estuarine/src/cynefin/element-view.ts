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

import { cynefinCroppedXYWH } from './crop';
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
 * Resize gating and, when the handle is let go, the crop.
 *
 * ## Gating
 *
 * The resize handles are hidden unless `model.resizeEnabled` is true (toggled
 * from the toolbar). Moving / selecting stays available.
 *
 * ## The crop
 *
 * The diagram is a fixed drawing fitted uniformly into the element, so dragged
 * off its proportion the element letterboxes: 400 model units of nothing either
 * side at 1600 × 600. `onResizeEnd` brings the frame back onto the picture (see
 * `./crop.ts`) — the drawing is neither deformed nor truncated, the element
 * simply stops claiming room it does not paint.
 *
 * ## Why here, and why one undo step
 *
 * A resize STASHES `xywh` on the way in, writes the model on every move, and
 * commits the stash in `onResizeEnd`, inside the manager's own
 * `store.transact` (`std/gfx/interactivity/manager.ts`). Writing the cropped
 * box BEFORE calling `default` therefore changes what is committed rather than
 * adding a second write: the whole gesture stays one Yjs write, and one undo
 * step. `captureSync` would do the opposite here — it would close the step and
 * make the crop a second one.
 *
 * This seam is also what keeps the crop a GESTURE. A cascade watching `xywh`
 * would fire on a peer's resize too and re-crop, on every screen, a frame
 * nobody on that screen touched; and it would fire on a document being loaded.
 * The readonly guard is belt and braces — `handleElementResize` already refuses
 * to start in a readonly store — but it is the invariant, so it is stated.
 */
export const CynefinInteraction = GfxViewInteractionExtension<CynefinView>(
  CynefinView.type,
  {
    handleResize({ std, model }) {
      return {
        beforeResize({ set }) {
          if (!model.resizeEnabled) {
            set({ allowedHandlers: [] });
          }
        },
        onResizeEnd(context) {
          if (!std.store.readonly) {
            const cropped = cynefinCroppedXYWH(model.xywh);
            // No write at all when the frame is already on the drawing: an
            // undo entry for a gesture that changed nothing is a bug.
            if (cropped) model.xywh = cropped;
          }
          context.default(context);
        },
      };
    },
  }
);
