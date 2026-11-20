import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { CommandExtension } from '@labre/std';

import { templateCommands } from './commands';
import { effects } from './effects';
import { TemplateTool } from './template-tool';
import { templateSeniorTool } from './toolbar/senior-tool';

export class TemplateViewExtension extends ViewExtensionProvider {
  override name = 'affine-template-view';

  override effect(): void {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(TemplateTool);
      context.register(templateSeniorTool);
      // The `l` shortcut to the panel (ADR 0055), with the tool it opens: a
      // `template: false` assembly loses both.
      context.register(CommandExtension(templateCommands));
    }
  }
}
