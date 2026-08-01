import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { extendTemplateCategory } from '@labre/affine-gfx-template';

import { effects } from './effects';
import { bpmnTemplateCategory } from './templates';
import { BpmnPoolRendererExtension } from './element-renderer';
import { BpmnPoolInteraction, BpmnPoolView } from './element-view';
import { BpmnNodeRendererExtension } from './node/node-renderer';
import { BpmnNodeView } from './node/node-view';
import { bpmnPoolToolbarExtension } from './toolbar/config';
import { bpmnSeniorTool } from './toolbar/senior-tool';

/**
 * BPMN rendering — ALWAYS registered, independent of any flag. Disabling `bpmn`
 * hides only the creation tooling (see {@link BpmnViewExtension}); pools and
 * nodes already drawn must still paint, stay selectable, stay editable and keep
 * their contextual toolbar. See `docs/adr/0009`.
 */
export class BpmnRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-bpmn-render-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(BpmnPoolView);
    context.register(BpmnPoolRendererExtension);
    context.register(BpmnNodeView);
    context.register(BpmnNodeRendererExtension);
    if (this.isEdgeless(context.scope)) {
      context.register(BpmnPoolInteraction);
      context.register(bpmnPoolToolbarExtension);
    }
  }
}

/**
 * BPMN creation tooling — flag-gated (`bpmn`): the senior toolbar button and
 * its templates category.
 */
export class BpmnViewExtension extends ViewExtensionProvider {
  override name = 'affine-bpmn-gfx';

  override effect(): void {
    super.effect();
    // Defines the senior button and its menu — tooling-only custom elements.
    effects();
    extendTemplateCategory(bpmnTemplateCategory);
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(bpmnSeniorTool);
    }
  }
}
