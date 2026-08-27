import {
  FrameworkBackgroundInteractionExtension,
  InterchangeExtension,
  ValidationProfileExtension,
  ValidationRuleExtension,
  validationToolbarConfig,
} from '@labre/affine-block-surface';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { extendTemplateCategory } from '@labre/affine-gfx-template';
import { ToolbarModuleExtension } from '@labre/affine-shared/services';
import { BlockFlavourIdentifier, CommandExtension } from '@labre/std';
import { RoleVocabularyExtension } from '@labre/std/gfx';

import { BPMN_POOL_BACKGROUND } from './background';
import { bpmnCommandIcons, bpmnCommands } from './commands';
import { effects } from './effects';
import { BPMN_INTERCHANGE } from './interchange';
import { BPMN_PROFILES } from './profiles';
import { BPMN_ROLES } from './roles';
import { BPMN_RULES } from './rules';
import { bpmnTemplateCategory } from './templates';
import { BpmnPoolRendererExtension } from './element-renderer';
import { BpmnPoolView } from './element-view';
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
    // The role VOCABULARY, always on. A role is written in the document, not in
    // the tooling: the direction reveal of the sequence flow, the inversion
    // command and the toolbar entry that must not lie about a typed edge all
    // read this, and they have to keep working on a process drawn while the flag
    // was on and opened while it is off (`docs/adr/0009`, `docs/adr/0010`).
    context.register(RoleVocabularyExtension(BPMN_ROLES));
    if (this.isEdgeless(context.scope)) {
      // Resize gating, driven by the declaration like every other framework
      // background: the handles stay hidden until `resizeEnabled` says
      // otherwise, and the toolbar toggle is what writes it.
      context.register(
        FrameworkBackgroundInteractionExtension(BPMN_POOL_BACKGROUND)
      );
      context.register(bpmnPoolToolbarExtension);
    }
  }
}

/**
 * BPMN creation tooling — flag-gated (`bpmn`): the senior toolbar button, its
 * templates category, the validation rules and profiles, and the interchange
 * capabilities. All of it is tooling: a process drawn while the flag was on
 * keeps rendering when it goes off, it just stops being checked — the profile
 * its pool was put on stays written, unread, until the flag comes back, and so
 * does anything an import wrote (`docs/adr/0009`, `docs/adr/0012`).
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
      context.register(ValidationRuleExtension(BPMN_RULES));
      context.register(ValidationProfileExtension(BPMN_PROFILES));
      // Reading and writing `.bpmn` files, declared rather than assumed
      // (`docs/adr/0012`). Tooling like the rest of this class: with the flag
      // off there is nothing to export WITH, while a board a past import wrote
      // keeps every element and every byte it was given (`docs/adr/0009`).
      context.register(InterchangeExtension(BPMN_INTERCHANGE));
      // The Validation dropdown on a selected pool's contextual toolbar. A
      // SECOND module on the same element, through the `custom:` flavour slot,
      // exactly as wardley and the context map register it on theirs:
      // `bpmnPoolToolbarExtension` is registered always-on because a stored pool
      // must keep its lanes and its resize toggle, while choosing how hard to
      // check the process is tooling and belongs here. The config names no
      // framework — it reads roles and profiles — so it is the very same object
      // the other two register.
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier('custom:affine:surface:bpmnPool'),
          config: validationToolbarConfig,
        })
      );
      context.register(bpmnSeniorTool);
      context.register(CommandExtension(bpmnCommands, bpmnCommandIcons));
    }
  }
}
