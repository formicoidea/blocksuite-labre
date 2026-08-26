import { FrameworkBackgroundInteractionExtension } from '@labre/affine-block-surface';
import type { CoreDomainChartElementModel } from '@labre/affine-model';
import { GfxElementModelView } from '@labre/std/gfx';

import { CORE_DOMAIN_BACKGROUND } from './background';

/**
 * View for the Core Domain Chart background. Registering it ensures
 * `gfx.view.get(model)` returns a view (required so move / select work).
 */
export class CoreDomainView extends GfxElementModelView<CoreDomainChartElementModel> {
  static override type: string = 'coreDomain';
}

/**
 * Resize gating, driven by the declaration: the handles are offered while
 * `model.resizeEnabled` says so (the toolbar toggle), and an element carrying no
 * such prop falls back to `geometry.resizable` — the same behaviour the
 * hand-written extension had, minus the hand.
 */
export const CoreDomainInteraction = FrameworkBackgroundInteractionExtension(
  CORE_DOMAIN_BACKGROUND
);
