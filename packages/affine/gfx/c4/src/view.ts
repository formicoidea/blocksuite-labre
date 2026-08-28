import {
  FrameworkBackgroundInteractionExtension,
  InterchangeExtension,
  morphToolbarConfig,
  ValidationProfileExtension,
  ValidationRuleExtension,
} from '@labre/affine-block-surface';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import {
  ToolbarModuleExtension,
  toolbarModuleKey,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier, CommandExtension } from '@labre/std';
import { RoleVocabularyExtension } from '@labre/std/gfx';

import { C4_BOARD_BACKGROUND, C4_BOUNDARY_BACKGROUND } from './background';
import { c4CommandIcons, c4Commands } from './commands';
import { effects } from './effects';
import {
  C4BoardRendererExtension,
  C4BoundaryRendererExtension,
} from './element-renderer';
import { C4BoardView, C4BoundaryView } from './element-view';
import { C4_INTERCHANGE } from './interchange';
import { C4_MORPH_SPEC } from './morph';
import { C4NodeRendererExtension } from './node/node-renderer';
import { C4NodeView } from './node/node-view';
import { C4TypeLineWatcher } from './node/type-line-watcher';
import { C4_PROFILES } from './profiles';
import { C4_ROLES } from './roles';
import { C4_RULES } from './rules';
import {
  c4BoardToolbarExtension,
  c4BoardToolingToolbarExtension,
} from './toolbar/config';
import { c4SeniorTool } from './toolbar/senior-tool';

/**
 * C4 rendering — ALWAYS registered, independent of any flag. Boards, boundaries
 * and nodes already drawn must paint, stay selectable, stay editable and keep
 * their resize gating whatever the tooling flag says. See `docs/adr/0009`.
 *
 * This is the RENDER half. The creation tooling — the senior button, its menu
 * and its commands — is {@link C4ViewExtension} below, exactly as
 * `BpmnViewExtension` is separate from `BpmnRenderViewExtension`. Nothing in
 * this class may become flag-gated: a stored document needs every one of these
 * registrations to load and paint.
 */
export class C4RenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-c4-render-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(C4BoardView);
    context.register(C4BoardRendererExtension);
    context.register(C4BoundaryView);
    context.register(C4BoundaryRendererExtension);
    context.register(C4NodeView);
    context.register(C4NodeRendererExtension);
    // The role VOCABULARY, always on. A role is written in the document, not in
    // the tooling: the direction reveal of the relationship, the inversion
    // command and the toolbar entry that must not lie about a typed edge all
    // read this, and they have to keep working on a diagram drawn while the flag
    // was on and opened while it is off (`docs/adr/0009`, `docs/adr/0010`).
    context.register(RoleVocabularyExtension(C4_ROLES));
    if (this.isEdgeless(context.scope)) {
      // Resize gating, driven by the declarations like every other framework
      // background: the handles follow `resizeEnabled`, which both declarations
      // seed to `true` — a diagram and a boundary are both stretched to fit.
      context.register(
        FrameworkBackgroundInteractionExtension(C4_BOARD_BACKGROUND)
      );
      context.register(
        FrameworkBackgroundInteractionExtension(C4_BOUNDARY_BACKGROUND)
      );
      // The selected board's own row — the resize toggle half of it. Always-on
      // for the reason `docs/adr/0009` gives: a stored board must keep its
      // handles usable with the C4 button switched off. The legend button is a
      // second module, registered by the flag-gated half below.
      context.register(c4BoardToolbarExtension);
      // Keeps a component's type line semi-derived while its author types into
      // it: the word from the kind, the technology from them. Always-on for the
      // reason `docs/adr/0009` gives — it authors nothing, it keeps an element
      // already in the document readable, and a diagram drawn while the C4
      // button was on must stay editable when it goes off.
      context.register(C4TypeLineWatcher);
    }
  }
}

/**
 * C4 creation tooling — flag-gated (`c4`): the senior toolbar button, its
 * sub-menu, the thirteen commands behind them, the board's legend button, the
 * component's "Change type" dropdown, and the validation rules and profiles.
 *
 * All of it is tooling in the sense `docs/adr/0009` means: a diagram drawn while
 * the flag was on keeps painting, stays selectable and keeps its contextual
 * toolbar when it goes off — only the ways to add new elements go away, the
 * legend included since generating one CREATES elements, and the checking stops.
 * The profile a board was put on stays written, unread, until the flag comes
 * back.
 */
export class C4ViewExtension extends ViewExtensionProvider {
  override name = 'affine-c4-gfx';

  override effect(): void {
    super.effect();
    // Defines the senior button and its menu — tooling-only custom elements.
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(ValidationRuleExtension(C4_RULES));
      context.register(ValidationProfileExtension(C4_PROFILES));
      // Writing mermaid files, declared rather than assumed (`docs/adr/0012`).
      // Tooling like the rest of this class: with the flag off there is nothing
      // to export WITH, while a stored diagram keeps painting (`docs/adr/0009`).
      context.register(InterchangeExtension(C4_INTERCHANGE));
      context.register(c4SeniorTool);
      context.register(CommandExtension(c4Commands, c4CommandIcons));
      // The flag-gated half of the selected BOARD's row, through the `custom:`
      // flavour slot — the shape wardley, bpmn and the context map all use to
      // hang flag-gated entries off a row whose base is always-on. One module,
      // carrying the legend button AND the Validation dropdown, because the two
      // halves are gated by this one flag and there is no reason to spend a
      // second registration on them (`toolbarModuleKey`, used further down for
      // the group's row, is what a THIRD contributor to one element needs).
      //
      // There is no boundary module, and no rule of this pack goes unarbitrated
      // for want of one: the board alone arbitrates the checklist (PO,
      // 28/08/2026), and a boundary inherits its board's choice in the engine
      // (`inheritChosenProfiles`), so the two boundary-anchored rules harden
      // with the rest. See `toolbar/config.ts`, where every flavour claim of
      // this framework lives.
      context.register(c4BoardToolingToolbarExtension);
      // The "Change type" dropdown on a selected COMPONENT's contextual
      // toolbar — the generic module, parameterized by C4's own families.
      //
      // ## Why the key carries an owner
      //
      // A C4 component is a native `group`, so the row the toolbar draws for it
      // is the GROUP's row, merged from `affine:surface:group`,
      // `custom:affine:surface:group` and the two surface wildcards. Both group
      // keys were already claimed — the first by the native group operations
      // (rename, ungroup), the second by Wardley's qualification dropdown,
      // which is on the group for the very same reason this is — and a second
      // module on either would have thrown `DuplicateServiceDefinitionError`
      // before the editor finished setting up. That ceiling of two contributors
      // per element is what `toolbarModuleKey` lifts: the module is registered
      // under the DISTINCT variant `custom:affine:surface:group#c4-morph` and
      // the registry hands it to the same row (`toolbar-service/registry.ts`).
      //
      // ## Why here
      //
      // In the flag-gated half, because a morph is TOOLING: a component drawn
      // while the flag was on keeps its kind, its role, its colours, its words
      // and its place in every rule when the flag goes off — it just stops
      // being something the toolbar offers to say differently (`docs/adr/0009`).
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier(
            toolbarModuleKey('custom:affine:surface:group', 'c4-morph')
          ),
          config: morphToolbarConfig(C4_MORPH_SPEC),
        })
      );
    }
  }
}
