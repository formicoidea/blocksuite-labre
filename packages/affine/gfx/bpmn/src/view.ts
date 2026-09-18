import {
  FrameworkBackgroundInteractionExtension,
  InterchangeExtension,
  morphToolbarConfig,
  ReadingProfileExtension,
  ValidationProfileExtension,
  ValidationRuleExtension,
} from '@labre/affine-block-surface';
import { FrameworkPaletteExtension } from '@labre/affine-components/color-picker';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { TemplateCategoryExtension } from '@labre/affine-gfx-template';
import { ToolbarModuleExtension } from '@labre/affine-shared/services';
import { BlockFlavourIdentifier, CommandExtension } from '@labre/std';
import { RoleVocabularyExtension } from '@labre/std/gfx';

import { BPMN_POOL_BACKGROUND } from './background';
import { bpmnCommandIcons, bpmnCommands } from './commands';
import { effects } from './effects';
import { BPMN_INTERCHANGE } from './interchange';
import { BPMN_MORPH_SPEC } from './morph';
import { BPMN_PROFILES } from './profiles';
import { BPMN_READINGS } from './reading';
import { BPMN_ROLES } from './roles';
import { BPMN_RULES } from './rules';
import { bpmnTemplateCategory } from './templates';
import { BpmnPoolRendererExtension } from './element-renderer';
import { BpmnPoolView } from './element-view';
import { BpmnNodeRendererExtension } from './node/node-renderer';
import { BpmnNodeView } from './node/node-view';
import {
  bpmnPoolToolbarExtension,
  bpmnPoolToolingToolbarExtension,
} from './toolbar/config';
import { BPMN_FRAMEWORK_PALETTE } from './toolbar/palette';
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
      // The Legend button and the Validation dropdown on a selected pool's
      // contextual toolbar. A SECOND module on the same element, through the
      // `custom:` flavour slot, exactly as wardley and the context map register
      // it on theirs: `bpmnPoolToolbarExtension` is registered always-on
      // because a stored pool must keep its lanes and its resize toggle, while
      // GENERATING a legend and choosing how hard to check the process are both
      // tooling and belong here (ADR 0026). One module, because a flavour may
      // carry exactly one — see `bpmnPoolToolingToolbarConfig`.
      context.register(bpmnPoolToolingToolbarExtension);
      // The "Change type" dropdown on a selected NODE's contextual toolbar —
      // the generic module, parameterized by BPMN's own families table.
      //
      // `affine:surface:bpmnNode` is a FREE slot, and class inheritance has
      // nothing to do with it: `renderToolbar` merges by flavour KEY — the
      // element's own, its `custom:` twin and the `affine:surface:*` wildcards
      // — so `shapeToolbarExtension`, which binds `affine:surface:shape`, never
      // reaches a bpmn node however much of `ShapeElementModel` the class
      // inherits. Nothing claimed this key before, so the registration is purely
      // additive: it joins the wildcard entries (tags, validation) that a node
      // already gets, and a second module claiming the same key would throw
      // `DuplicateServiceDefinitionError` before the editor finished setting up.
      //
      // Registered HERE, in the flag-gated half, because a morph is TOOLING: a
      // node drawn while the flag was on keeps its kind, its role, its glyph
      // and its place in every rule when the flag goes off — it just stops
      // being something the toolbar offers to say more precisely
      // (`docs/adr/0009`).
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier('affine:surface:bpmnNode'),
          config: morphToolbarConfig(BPMN_MORPH_SPEC),
        })
      );
      // The reversed reading (MF3): what the process says about an artefact, on
      // demand. Four profiles because BPMN has four parent-less node families
      // (`reading.ts` says why the notation refuses a common root). The CLICK
      // that triggers it is registered once by the surface and gated by the
      // presence of a profile, so it goes with the flag without either side
      // naming the other.
      for (const reading of BPMN_READINGS) {
        context.register(ReadingProfileExtension(reading));
      }
      context.register(bpmnSeniorTool);
      // BPMN's page of the colour pickers' carousel (`docs/adr/0027`). Here,
      // beside the senior tool, because offering hues is TOOLING — the colours
      // already painted on a stored process are content and do not move
      // (`docs/adr/0009`).
      context.register(FrameworkPaletteExtension(BPMN_FRAMEWORK_PALETTE));
      // The Templates-panel category — tooling, so it goes with the flag (#244).
      context.register(TemplateCategoryExtension(bpmnTemplateCategory));
      context.register(CommandExtension(bpmnCommands, bpmnCommandIcons));
    }
  }
}
