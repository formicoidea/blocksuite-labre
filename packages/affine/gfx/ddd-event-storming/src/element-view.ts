import { FrameworkBackgroundInteractionExtension } from '@labre/affine-block-surface';
import type { EventStormingBoardElementModel } from '@labre/affine-model';
import { GfxElementModelView } from '@labre/std/gfx';

import { EVENT_STORMING_BACKGROUND } from './background';

/**
 * View for the Event Storming board. Registering it ensures `gfx.view.get(model)`
 * returns a view (required so move / select interactions work).
 *
 * No double-click label editor, unlike the Wardley map: the only text on the
 * card is the axis word, which the declaration owns and the model carries no
 * prop for — there is nothing here the user edits in place.
 */
export class EventStormingView extends GfxElementModelView<EventStormingBoardElementModel> {
  static override type: string = 'eventStorming';
}

/**
 * Resize gating, from the primitive: the handles follow `resizeEnabled`, which
 * the declaration seeds to `true` — the roll is unspooled as the morning goes.
 */
export const EventStormingInteraction = FrameworkBackgroundInteractionExtension(
  EVENT_STORMING_BACKGROUND
);
