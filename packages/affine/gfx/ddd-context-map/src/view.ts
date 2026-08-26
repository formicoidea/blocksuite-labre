import {
  QualityNudgeExtension,
  validationToolbarConfig,
  ValidationProfileExtension,
  ValidationRuleExtension,
} from '@labre/affine-block-surface';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { ToolbarModuleExtension } from '@labre/affine-shared/services';
import { BlockFlavourIdentifier, CommandExtension } from '@labre/std';
import { RoleVocabularyExtension } from '@labre/std/gfx';

import { contextMapCommandIcons, contextMapCommands } from './commands';
import { contextMapEffects } from './effects';
import { ContextMapRendererExtension } from './element-renderer';
import { ContextMapInteraction, ContextMapView } from './element-view';
import { CONTEXT_MAP_NUDGES } from './nudges';
import { CONTEXT_MAP_PROFILES } from './profiles';
import { CONTEXT_MAP_ROLES } from './roles';
import { CONTEXT_MAP_RULES } from './rules';
import { contextMapBoardToolbarExtension } from './toolbar/board-config';
import { contextMapSeniorTool } from './toolbar/senior-tool';

/**
 * Context Map rendering — ALWAYS registered, independent of any flag.
 * Disabling `ddd-context-map` hides only the creation tooling (see
 * {@link DddContextMapViewExtension}); boards already drawn must still paint,
 * stay selectable, stay movable and keep their contextual toolbar. See
 * `docs/adr/0009`.
 */
export class DddContextMapRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-ddd-context-map-render-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(ContextMapView);
    context.register(ContextMapRendererExtension);
    // The role VOCABULARY, always on. A role is written in the DOCUMENT, not in
    // the tooling: the direction reveal of a typed relationship, the inversion
    // command and the toolbar entry that must not lie about one all read this,
    // and they have to keep working on a map drawn while the flag was on and
    // opened while it is off (`docs/adr/0009`, `docs/adr/0010`). The rules that
    // JUDGE those roles stay in the flag-gated extension below.
    context.register(RoleVocabularyExtension(CONTEXT_MAP_ROLES));
    if (this.isEdgeless(context.scope)) {
      context.register(ContextMapInteraction);
      context.register(contextMapBoardToolbarExtension);
    }
  }
}

/**
 * Context Map creation tooling — independently flag-gated
 * (`ddd-context-map`): the senior toolbar button, its palette and the
 * validation rules, profiles and quality nudges. Both halves are tooling: a map
 * drawn while the flag was on keeps rendering when it goes off, it just stops
 * being checked — and the profile it was put on stays written, unread, until the
 * flag comes back.
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
      context.register(ValidationRuleExtension(CONTEXT_MAP_RULES));
      context.register(ValidationProfileExtension(CONTEXT_MAP_PROFILES));
      context.register(QualityNudgeExtension(CONTEXT_MAP_NUDGES));
      // The Validation dropdown on a selected board's contextual toolbar. A
      // SECOND module on the same element, through the `custom:` flavour slot:
      // `contextMapBoardToolbarExtension` is registered always-on because a
      // stored board must keep its resize toggle, while choosing how hard to
      // check it is tooling and belongs here. The config names no framework —
      // it reads roles and profiles — so it is the very same object Wardley
      // registers on its own flavour.
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier('custom:affine:surface:contextMap'),
          config: validationToolbarConfig,
        })
      );
      context.register(contextMapSeniorTool);
      context.register(
        CommandExtension(contextMapCommands, contextMapCommandIcons)
      );
    }
  }
}
