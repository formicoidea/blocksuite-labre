import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { extendTemplateCategory } from '@labre/affine-gfx-template';

import { CoreDomainRendererExtension } from './core-domain/element-renderer';
import { CoreDomainInteraction, CoreDomainView } from './core-domain/element-view';
import { coreDomainToolbarExtension } from './core-domain/toolbar-config';
import {
  contextMapEffects,
  coreDomainEffects,
  eventStormingEffects,
} from './effects';
import {
  aggregateTemplateCategory,
  contextMapTemplateCategory,
  coreDomainTemplateCategory,
  eventStormingTemplateCategory,
} from './templates';
import {
  contextMapSeniorTool,
  coreDomainSeniorTool,
  eventStormingSeniorTool,
} from './toolbar/senior-tool';

/** Event Storming — independently flag-gated (`ddd-event-storming`). */
export class DddEventStormingViewExtension extends ViewExtensionProvider {
  override name = 'affine-ddd-event-storming-gfx';

  override effect(): void {
    super.effect();
    eventStormingEffects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(eventStormingSeniorTool);
    }
  }
}

/**
 * Core Domain Chart rendering — ALWAYS registered, independent of any flag.
 * Disabling `ddd-core-domain` hides only the senior toolbar button (see
 * {@link DddCoreDomainViewExtension}); placed `coreDomain` elements must still
 * paint, stay selectable, and keep their contextual toolbar, and Templates-
 * panel insertion must still render them.
 */
export class DddCoreDomainRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-ddd-core-domain-render-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(CoreDomainView);
    context.register(CoreDomainRendererExtension);
    if (this.isEdgeless(context.scope)) {
      context.register(CoreDomainInteraction);
      context.register(coreDomainToolbarExtension);
    }
  }
}

/** Core Domain Chart senior button — independently flag-gated (`ddd-core-domain`). */
export class DddCoreDomainViewExtension extends ViewExtensionProvider {
  override name = 'affine-ddd-core-domain-gfx';

  override effect(): void {
    super.effect();
    coreDomainEffects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(coreDomainSeniorTool);
    }
  }
}

/** Context Map — independently flag-gated (`ddd-context-map`). */
export class DddContextMapViewExtension extends ViewExtensionProvider {
  override name = 'affine-ddd-context-map-gfx';

  override effect(): void {
    super.effect();
    contextMapEffects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(contextMapSeniorTool);
    }
  }
}

/** DDD Templates section (Aggregate Design Canvas) — flag-gated (`ddd-templates`). */
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
