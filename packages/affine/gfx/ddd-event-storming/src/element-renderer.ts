import {
  createFrameworkBackgroundRenderer,
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import type { EventStormingBoardElementModel } from '@labre/affine-model';

import { EVENT_STORMING_BACKGROUND } from './background';

/**
 * Canvas renderer for the Event Storming board.
 *
 * There is no Event Storming drawing code: the board is an INSTANTIATION of the
 * framework-background primitive, configured by the
 * {@link EVENT_STORMING_BACKGROUND} declaration — a white card with one axis
 * along the bottom.
 *
 * Exported as a function as well as an extension so a test can drive it with a
 * canvas stub.
 */
export const eventStorming: ElementRenderer<EventStormingBoardElementModel> =
  createFrameworkBackgroundRenderer<EventStormingBoardElementModel>(
    EVENT_STORMING_BACKGROUND
  );

export const EventStormingRendererExtension = ElementRendererExtension(
  EVENT_STORMING_BACKGROUND.type,
  eventStorming
);
