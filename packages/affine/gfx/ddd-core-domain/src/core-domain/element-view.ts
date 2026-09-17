import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';
import {
  DeclaredBackgroundView,
  FrameworkBackgroundInteractionExtension,
} from '@labre/affine-block-surface';
import type { CoreDomainChartElementModel } from '@labre/affine-model';

import { CORE_DOMAIN_BACKGROUND } from './background';

/**
 * View for the Core Domain Chart background. Registering it ensures
 * `gfx.view.get(model)` returns a view (required so move / select work).
 *
 * Extends {@link DeclaredBackgroundView}, so every word the chart writes on
 * itself — the two axis titles, the four Low/High ticks and the zone names of
 * both readings — is renamed in place by a double-click, aimed by the very
 * declaration the renderer paints (issue #355). The chart had no such gesture
 * before, which is the whole of the bug: the labels were i18n keys and nothing
 * else, so a team that calls its axis something else had nowhere to say so.
 */
export class CoreDomainView extends DeclaredBackgroundView<CoreDomainChartElementModel> {
  static override type: string = 'coreDomain';

  protected override get def(): FrameworkBackgroundDef {
    return CORE_DOMAIN_BACKGROUND;
  }
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
