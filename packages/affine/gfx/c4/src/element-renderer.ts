import {
  createFrameworkBackgroundRenderer,
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import type {
  C4BoardElementModel,
  C4BoundaryElementModel,
} from '@labre/affine-model';

import { C4_BOARD_BACKGROUND, C4_BOUNDARY_BACKGROUND } from './background';

/**
 * Canvas renderers for the two C4 frames.
 *
 * There is no C4 drawing code here: both are INSTANTIATIONS of the
 * framework-background primitive, configured by the declarations in
 * `background.ts`. Exported as functions as well as extensions because the
 * fidelity suite drives them directly with a canvas stub.
 */

export const c4Board: ElementRenderer<C4BoardElementModel> =
  createFrameworkBackgroundRenderer<C4BoardElementModel>(C4_BOARD_BACKGROUND);

export const C4BoardRendererExtension = ElementRendererExtension(
  C4_BOARD_BACKGROUND.type,
  c4Board
);

export const c4Boundary: ElementRenderer<C4BoundaryElementModel> =
  createFrameworkBackgroundRenderer<C4BoundaryElementModel>(
    C4_BOUNDARY_BACKGROUND
  );

export const C4BoundaryRendererExtension = ElementRendererExtension(
  C4_BOUNDARY_BACKGROUND.type,
  c4Boundary
);
