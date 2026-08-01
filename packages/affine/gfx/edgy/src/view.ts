import { SpotlightHostExtension } from '@labre/affine-block-surface';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { extendTemplateCategory } from '@labre/affine-gfx-template';

import { effects } from './effects';
import { edgyTemplateCategory } from './templates';
import { EdgyBoardRendererExtension } from './board-renderer';
import { EdgyBoardInteraction, EdgyBoardView } from './board-view';
import { EdgyFacetsRendererExtension } from './element-renderer';
import { EdgyInteraction, EdgyView } from './element-view';
import { EdgyNodeRendererExtension } from './node/node-renderer';
import { EdgyNodeView } from './node/node-view';
import {
  edgyBoardToolbarExtension,
  edgyToolbarExtension,
} from './toolbar/config';
import { edgyNodeToolbarExtension } from './toolbar/node-config';
import { edgySeniorTool } from './toolbar/senior-tool';

/**
 * EDGY rendering — ALWAYS registered, independent of any flag. Disabling `edgy`
 * hides only the creation tooling (see {@link EdgyViewExtension}); boards and
 * facets already drawn must still paint, stay selectable, stay editable, keep
 * their contextual toolbar and keep the dependency spotlight. See
 * `docs/adr/0009`.
 */
export class EdgyRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-edgy-render-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(EdgyView);
    context.register(EdgyFacetsRendererExtension);
    context.register(EdgyBoardView);
    context.register(EdgyBoardRendererExtension);
    context.register(EdgyNodeView);
    context.register(EdgyNodeRendererExtension);
    if (this.isEdgeless(context.scope)) {
      context.register(EdgyInteraction);
      context.register(EdgyBoardInteraction);
      context.register(edgyToolbarExtension);
      context.register(edgyBoardToolbarExtension);
      context.register(edgyNodeToolbarExtension);
      // Both EDGY backgrounds grant the dependency spotlight on hover.
      context.register(SpotlightHostExtension('edgy'));
      context.register(SpotlightHostExtension('edgyBoard'));
    }
  }
}

/**
 * EDGY creation tooling — flag-gated (`edgy`): the senior toolbar button and
 * its templates category.
 */
export class EdgyViewExtension extends ViewExtensionProvider {
  override name = 'affine-edgy-gfx';

  override effect(): void {
    super.effect();
    // Defines the senior button and its menu — tooling-only custom elements.
    effects();
    extendTemplateCategory(edgyTemplateCategory);
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(edgySeniorTool);
    }
  }
}
