import {
  createFrameworkBackgroundRenderer,
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import type { CoreDomainChartElementModel } from '@labre/affine-model';

import { CORE_DOMAIN_BACKGROUND } from './background';

/**
 * The Core Domain Chart background renderer — the framework-background
 * primitive, driven by {@link CORE_DOMAIN_BACKGROUND}.
 *
 * There is no chart-specific drawing code any more: the bands, the two axes with
 * their arrowheads, the zone names and the Low/High ticks are all declared, and
 * `__tests__/background.unit.spec.ts` pins the picture against the absolute
 * constants the deleted imperative renderer drew from.
 */
export const coreDomain: ElementRenderer<CoreDomainChartElementModel> =
  createFrameworkBackgroundRenderer(CORE_DOMAIN_BACKGROUND);

export const CoreDomainRendererExtension = ElementRendererExtension(
  'coreDomain',
  coreDomain
);
