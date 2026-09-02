import {
  morphToolbarConfig,
  QualityNudgeExtension,
  validationToolbarConfig,
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

import { eventStormingCommandIcons, eventStormingCommands } from './commands';
import { eventStormingEffects } from './effects';
import { EventStormingRendererExtension } from './element-renderer';
import { EventStormingInteraction, EventStormingView } from './element-view';
import { EVENT_STORMING_MORPH_SPEC } from './morph';
import { EVENT_STORMING_NUDGES } from './nudges';
import { EVENT_STORMING_PROFILES } from './profiles';
import { EVENT_STORMING_ROLES } from './roles';
import { EVENT_STORMING_RULES } from './rules';
import { eventStormingBoardToolbarExtension } from './toolbar/board-config';
import { eventStormingSeniorTool } from './toolbar/senior-tool';

/**
 * Event Storming rendering — ALWAYS registered, independent of any flag.
 * Disabling `ddd-event-storming` hides only the creation tooling (see
 * {@link DddEventStormingViewExtension}); boards already stormed must still
 * paint, stay selectable, stay movable and keep their contextual toolbar. See
 * `docs/adr/0009`.
 */
export class DddEventStormingRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-ddd-event-storming-render-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(EventStormingView);
    context.register(EventStormingRendererExtension);
    // The role VOCABULARY, always on. A role is written in the DOCUMENT, not in
    // the tooling: the direction reveal of a typed flow, the inversion command
    // and the toolbar entry that must not lie about one all read this, and they
    // have to keep working on a board stormed while the flag was on and opened
    // while it is off (`docs/adr/0009`, `docs/adr/0010`). The rules that JUDGE
    // those roles stay in the flag-gated extension below.
    context.register(RoleVocabularyExtension(EVENT_STORMING_ROLES));
    if (this.isEdgeless(context.scope)) {
      context.register(EventStormingInteraction);
      context.register(eventStormingBoardToolbarExtension);
    }
  }
}

/**
 * Event Storming creation tooling — independently flag-gated
 * (`ddd-event-storming`): the senior toolbar button, its palette and the
 * validation rules, profiles and quality nudges. Both halves are tooling: a
 * board stormed while the flag was on keeps rendering when it goes off, it just
 * stops being checked — and the profile it was put on stays written, unread,
 * until the flag comes back.
 *
 * Note: its Templates-panel category is registered by the aggregate package's
 * {@link DddTemplatesViewExtension} (gated by `ddd-templates`), so templates
 * stay available even when this senior button is disabled.
 */
export class DddEventStormingViewExtension extends ViewExtensionProvider {
  override name = 'affine-ddd-event-storming-gfx';

  override effect(): void {
    super.effect();
    eventStormingEffects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(ValidationRuleExtension(EVENT_STORMING_RULES));
      context.register(ValidationProfileExtension(EVENT_STORMING_PROFILES));
      context.register(QualityNudgeExtension(EVENT_STORMING_NUDGES));
      // The Validation dropdown on a selected board's contextual toolbar. A
      // SECOND module on the same element, through the `custom:` flavour slot:
      // `eventStormingBoardToolbarExtension` is registered always-on because a
      // stored board must keep its resize toggle, while choosing how hard to
      // check it is tooling and belongs here. The config names no framework —
      // it reads roles and profiles — so it is the very same object Wardley
      // registers on its own flavour.
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier('custom:affine:surface:eventStorming'),
          config: validationToolbarConfig,
        })
      );
      context.register(eventStormingSeniorTool);
      context.register(
        CommandExtension(eventStormingCommands, eventStormingCommandIcons)
      );
      // The "Change type" dropdown on a selected STICKY's contextual toolbar —
      // the generic module, parameterized by Event Storming's own family.
      //
      // ## Why the key carries an owner
      //
      // A sticky is a native `group` (the shadow and the face), so the row the
      // toolbar draws for it is the GROUP's row, merged by the registry from
      // every module registered on that flavour. Both plain group keys were
      // claimed long ago — `affine:surface:group` by the native operations
      // (rename, ungroup), `custom:affine:surface:group` by Wardley's
      // qualification dropdown — and C4's morph already took the
      // `#c4-morph` variant. `toolbarModuleKey` is what lifts the ceiling of
      // one module per flavour: this one is registered under
      // `custom:affine:surface:group#ddd-event-storming-morph` and the registry
      // hands it to the same row (`toolbar-service/registry.ts`).
      //
      // ## Why here
      //
      // In the flag-gated half, because a morph is TOOLING: a sticky placed
      // while the flag was on keeps its role, its colours, its words, its
      // shadow and its place in every rule when the flag goes off — it just
      // stops being something the toolbar offers to say differently
      // (`docs/adr/0009`).
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier(
            toolbarModuleKey(
              'custom:affine:surface:group',
              'ddd-event-storming-morph'
            )
          ),
          config: morphToolbarConfig(EVENT_STORMING_MORPH_SPEC),
        })
      );
    }
  }
}
