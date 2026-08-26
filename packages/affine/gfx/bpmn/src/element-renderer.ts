import {
  createFrameworkBackgroundRenderer,
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import type { BpmnPoolElementModel } from '@labre/affine-model';

import { BPMN_POOL_BACKGROUND } from './background';

/**
 * Canvas renderer for the BPMN pool.
 *
 * There is no BPMN drawing code any more: the pool is an INSTANTIATION of the
 * framework-background primitive, configured by the `BPMN_POOL_BACKGROUND`
 * declaration. What used to be ninety lines of hand-traced rounded rectangle,
 * filled band and rotated name is now a declaration any other framework can
 * write for itself.
 *
 * Exported as a function as well as an extension because the fidelity suite
 * drives it directly with a canvas stub.
 */
export const bpmnPool: ElementRenderer<BpmnPoolElementModel> =
  createFrameworkBackgroundRenderer<BpmnPoolElementModel>(
    BPMN_POOL_BACKGROUND
  );

export const BpmnPoolRendererExtension = ElementRendererExtension(
  BPMN_POOL_BACKGROUND.type,
  bpmnPool
);
