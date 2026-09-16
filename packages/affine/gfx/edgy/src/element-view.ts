import type { EditableBackgroundLabel } from '@labre/affine-block-surface';
import { FrameworkBackgroundView } from '@labre/affine-block-surface';
import type { EdgyFacetsElementModel } from '@labre/affine-model';
import { GfxViewInteractionExtension } from '@labre/std/gfx';

import { cropLabeledScale, refScale } from './consts';
import { getEdgyLabelHits, hitTestEdgyLabel } from './label-layout';

/**
 * The EDGY facets diagram's view: the shared background gesture, aimed by this
 * framework's own label layout.
 *
 * The three facet names are NOT declared in a `FrameworkBackgroundDef` — the
 * diagram is a Venn figure fitted into a reference space, and its labels hang
 * off the circles rather than off a plot — so the hit test stays here, mapped
 * with the SAME fit the renderer used. Everything above it (where a
 * double-click is allowed to land, the in-place `<input>`, the commit that
 * refuses to write an untouched value) comes from
 * {@link FrameworkBackgroundView}, which is where this diagram's own copy of it
 * went — see issue #355.
 */
export class EdgyView extends FrameworkBackgroundView<EdgyFacetsElementModel> {
  static override type: string = 'edgy';

  /**
   * A diagram is SELECTED by its border (`EdgyFacetsElementModel`), and the
   * three facet labels widen that for the pointer — the base class' doing; this
   * method only says where they are.
   */
  protected override labelAt(
    lx: number,
    ly: number,
    w: number,
    h: number
  ): EditableBackgroundLabel | null {
    // No labels shown → nothing to edit (and the cropped mapping differs).
    if (!this.model.showLabels) return null;

    // Map element-local coords into the fixed reference space the labels live
    // in — with the SAME fit the renderer used (cropped or letterboxed).
    const { s, ox, oy } = this.model.cropToCircles
      ? cropLabeledScale(w, h)
      : refScale(w, h);
    const rx = (lx - ox) / s;
    const ry = (ly - oy) / s;

    const hit = hitTestEdgyLabel(getEdgyLabelHits(this.model), rx, ry);
    if (!hit) return null;
    // The facet names carry a hard default, so the drawn words ARE the prop.
    return { prop: hit.field, text: String(this.model[hit.field] ?? '') };
  }
}

/**
 * Resize gating: the resize handles are hidden unless `model.resizeEnabled` is
 * true (toggled from the toolbar). Moving/selecting stays available throughout.
 */
export const EdgyInteraction = GfxViewInteractionExtension<EdgyView>(
  EdgyView.type,
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
