import {
  createFrameworkBackgroundRenderer,
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import type { ContextMapBoardElementModel } from '@labre/affine-model';

import { CONTEXT_MAP_BACKGROUND } from './background';

/**
 * Canvas renderer for the Context Map board.
 *
 * There is no Context Map drawing code: the board is an INSTANTIATION of the
 * framework-background primitive, configured by the `CONTEXT_MAP_BACKGROUND`
 * declaration — which, having no axes and no zones, paints the primitive's own
 * default: a white card with a hairline border.
 *
 * Exported as a function as well as an extension so a test can drive it with a
 * canvas stub.
 */
export const contextMap: ElementRenderer<ContextMapBoardElementModel> =
  createFrameworkBackgroundRenderer<ContextMapBoardElementModel>(
    CONTEXT_MAP_BACKGROUND
  );

export const ContextMapRendererExtension = ElementRendererExtension(
  CONTEXT_MAP_BACKGROUND.type,
  contextMap
);
