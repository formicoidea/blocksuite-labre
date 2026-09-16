import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';
import {
  DeclaredBackgroundView,
  FrameworkBackgroundInteractionExtension,
} from '@labre/affine-block-surface';
import type { EventStormingBoardElementModel } from '@labre/affine-model';

import { EVENT_STORMING_BACKGROUND } from './background';

/**
 * View for the Event Storming board. Registering it ensures `gfx.view.get(model)`
 * returns a view (required so move / select interactions work).
 *
 * Extends {@link DeclaredBackgroundView}, so the one word the board writes on
 * itself — the time axis title — is renamed in place by a double-click, like
 * every other framework background (issue #355). This file used to say the
 * board had nothing to edit because the declaration bound no prop; binding one
 * is the fix, and the gesture then comes for free.
 */
export class EventStormingView extends DeclaredBackgroundView<EventStormingBoardElementModel> {
  static override type: string = 'eventStorming';

  protected override get def(): FrameworkBackgroundDef {
    return EVENT_STORMING_BACKGROUND;
  }
}

/**
 * Resize gating, from the primitive: the handles follow `resizeEnabled`, which
 * the declaration seeds to `true` — the roll is unspooled as the morning goes.
 */
export const EventStormingInteraction = FrameworkBackgroundInteractionExtension(
  EVENT_STORMING_BACKGROUND
);
