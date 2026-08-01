import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { CommandExtension } from '@labre/std';

import { contextMapCommandIcons, contextMapCommands } from './commands';
import { contextMapEffects } from './effects';
import { contextMapSeniorTool } from './toolbar/senior-tool';

/**
 * Context Map — independently flag-gated (`ddd-context-map`).
 *
 * Note: its Templates-panel category is registered by the aggregate package's
 * {@link DddTemplatesViewExtension} (gated by `ddd-templates`), so templates
 * stay available even when this senior button is disabled.
 */
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
      context.register(
        CommandExtension(contextMapCommands, contextMapCommandIcons)
      );
    }
  }
}
