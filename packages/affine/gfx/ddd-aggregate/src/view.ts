import { ViewExtensionProvider } from '@labre/affine-ext-loader';
import {
  contextMapTemplateCategory,
  coreDomainTemplateCategory,
  eventStormingTemplateCategory,
} from '@labre/affine-gfx-ddd-shared';
import { extendTemplateCategory } from '@labre/affine-gfx-template';

import { aggregateTemplateCategory } from './templates';

/**
 * DDD Templates sections — flag-gated (`ddd-templates`). Registers ALL four DDD
 * Templates-panel categories (Event Storming, Core Domain Chart, Context Map and
 * the standalone Aggregate Design Canvas) under the single `ddd-templates` flag,
 * so the catalogue stays available even when individual senior buttons are off.
 * The three senior-button categories are sourced from the shared package; the
 * aggregate category lives here.
 */
export class DddTemplatesViewExtension extends ViewExtensionProvider {
  override name = 'affine-ddd-templates';

  override effect(): void {
    super.effect();
    extendTemplateCategory(eventStormingTemplateCategory);
    extendTemplateCategory(coreDomainTemplateCategory);
    extendTemplateCategory(contextMapTemplateCategory);
    extendTemplateCategory(aggregateTemplateCategory);
  }
}
