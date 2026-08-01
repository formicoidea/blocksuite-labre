import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { CommandExtension } from '@labre/std';

import { coreDomainCommandIcons, coreDomainCommands } from './commands';
import { CoreDomainRendererExtension } from './core-domain/element-renderer';
import { CoreDomainInteraction, CoreDomainView } from './core-domain/element-view';
import { coreDomainToolbarExtension } from './core-domain/toolbar-config';
import { coreDomainEffects } from './effects';
import { coreDomainSeniorTool } from './toolbar/senior-tool';

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

/**
 * Core Domain Chart senior button — independently flag-gated (`ddd-core-domain`).
 *
 * Note: its Templates-panel category is registered by the aggregate package's
 * {@link DddTemplatesViewExtension} (gated by `ddd-templates`), so templates
 * stay available even when this senior button is disabled.
 */
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
      context.register(
        CommandExtension(coreDomainCommands, coreDomainCommandIcons)
      );
    }
  }
}
