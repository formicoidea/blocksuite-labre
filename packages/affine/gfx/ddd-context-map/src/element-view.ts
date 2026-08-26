import { FrameworkBackgroundInteractionExtension } from '@labre/affine-block-surface';
import type { ContextMapBoardElementModel } from '@labre/affine-model';
import { GfxElementModelView } from '@labre/std/gfx';

import { CONTEXT_MAP_BACKGROUND } from './background';

/**
 * View for the Context Map board. Registering it ensures `gfx.view.get(model)`
 * returns a view (required so move / select interactions work).
 *
 * No double-click label editor, unlike the Wardley map: the declaration carries
 * no text at all, so there is nothing on the card to hit-test.
 */
export class ContextMapView extends GfxElementModelView<ContextMapBoardElementModel> {
  static override type: string = 'contextMap';
}

/**
 * Resize gating, from the primitive: the handles follow `resizeEnabled`, which
 * the declaration seeds to `true` — a board is a sheet you spread out.
 */
export const ContextMapInteraction = FrameworkBackgroundInteractionExtension(
  CONTEXT_MAP_BACKGROUND
);
