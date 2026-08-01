import {
  createFrameworkBackgroundRenderer,
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import type { WardleyBackgroundElementModel } from '@labre/affine-model';

import { WARDLEY_BACKGROUND } from './background';

/**
 * Canvas renderer for the Wardley map background.
 *
 * There is no Wardley drawing code any more (PF2.12): the map is an
 * INSTANTIATION of the framework-background primitive, configured by the
 * `WARDLEY_BACKGROUND` declaration. What used to be two hundred lines of
 * `ctx.fillText` is now a declaration any other framework can write for itself.
 *
 * Exported as a function as well as an extension because the non-regression
 * suite drives it directly with a canvas stub.
 */
export const wardley: ElementRenderer<WardleyBackgroundElementModel> =
  createFrameworkBackgroundRenderer<WardleyBackgroundElementModel>(
    WARDLEY_BACKGROUND
  );

export const WardleyElementRendererExtension = ElementRendererExtension(
  WARDLEY_BACKGROUND.type,
  wardley
);
