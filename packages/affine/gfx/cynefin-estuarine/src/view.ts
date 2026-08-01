import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { extendTemplateCategory } from '@labre/affine-gfx-template';
import { CommandExtension } from '@labre/std';

import {
  cynefinEstuarineCommandIcons,
  cynefinEstuarineCommands,
} from './commands';
import { CynefinRendererExtension } from './cynefin/element-renderer';
import { CynefinInteraction, CynefinView } from './cynefin/element-view';
import { cynefinToolbarExtension } from './cynefin/toolbar/config';
import { effects } from './effects';
import { EstuarineRendererExtension } from './estuarine/element-renderer';
import { EstuarineInteraction, EstuarineView } from './estuarine/element-view';
import { estuarineToolbarExtension } from './estuarine/toolbar/config';
import {
  cynefinTemplateCategory,
  estuarineTemplateCategory,
} from './templates';
import { cynefinEstuarineSeniorTool } from './toolbar/senior-tool';

/**
 * Cynefin / Estuarine rendering — ALWAYS registered, independent of any flag.
 * Disabling `cynefin-estuarine` hides only the creation tooling (see
 * {@link CynefinEstuarineViewExtension}); frames already drawn must still
 * paint, stay selectable, stay editable and keep their contextual toolbar. See
 * `docs/adr/0009`.
 */
export class CynefinEstuarineRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-cynefin-estuarine-render-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(CynefinView);
    context.register(CynefinRendererExtension);
    context.register(EstuarineView);
    context.register(EstuarineRendererExtension);
    if (this.isEdgeless(context.scope)) {
      context.register(CynefinInteraction);
      context.register(EstuarineInteraction);
      context.register(cynefinToolbarExtension);
      context.register(estuarineToolbarExtension);
    }
  }
}

/**
 * Cynefin / Estuarine creation tooling — flag-gated (`cynefin-estuarine`): the
 * senior toolbar button and both templates categories.
 */
export class CynefinEstuarineViewExtension extends ViewExtensionProvider {
  override name = 'affine-cynefin-estuarine-gfx';

  override effect(): void {
    super.effect();
    // Defines the senior button and its menu — tooling-only custom elements.
    effects();
    extendTemplateCategory(cynefinTemplateCategory);
    extendTemplateCategory(estuarineTemplateCategory);
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(cynefinEstuarineSeniorTool);
      context.register(
        CommandExtension(
          cynefinEstuarineCommands,
          cynefinEstuarineCommandIcons
        )
      );
    }
  }
}
