import type { EdgyBoardElementModel } from '@labre/affine-model';
import {
  GfxElementModelView,
  GfxViewInteractionExtension,
} from '@labre/std/gfx';

export class EdgyBoardView extends GfxElementModelView<EdgyBoardElementModel> {
  static override type: string = 'edgyBoard';
}

/**
 * Resize gating: the resize handles are hidden unless `model.resizeEnabled` is
 * true. Moving/selecting stays available throughout (same as the facets
 * diagram).
 */
export const EdgyBoardInteraction = GfxViewInteractionExtension<EdgyBoardView>(
  EdgyBoardView.type,
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
