import {
  QualityNudgeExtension,
  SpotlightHostExtension,
  ValidationProfileExtension,
  ValidationRuleExtension,
  validationToolbarConfig,
} from '@labre/affine-block-surface';
import { ToolbarModuleExtension } from '@labre/affine-shared/services';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { extendTemplateCategory } from '@labre/affine-gfx-template';
import { BlockFlavourIdentifier, CommandExtension } from '@labre/std';
import { RoleVocabularyExtension } from '@labre/std/gfx';

import { edgyCommandIcons, edgyCommands } from './commands';
import { effects } from './effects';
import { EDGY_NUDGES } from './nudges';
import { EDGY_PROFILES } from './profiles';
import { EdgyRelationResolver } from './relation-resolver';
import { EDGY_ROLES } from './roles';
import { EDGY_RULES } from './rules';
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
    // The role VOCABULARY, always on. A role is written in the document, not in
    // the tooling: the direction reveal of a typed relation, the inversion
    // command and the toolbar entry that must not lie about one all read this,
    // and they have to keep working on a board drawn while the flag was on and
    // opened while it is off (`docs/adr/0009`, `docs/adr/0010`). The rules that
    // JUDGE those roles stay in the flag-gated extension below.
    context.register(RoleVocabularyExtension(EDGY_ROLES));
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
 * EDGY creation tooling — flag-gated (`edgy`): the senior toolbar button, its
 * templates category, and the validation rules, profiles and quality checklist.
 * All of it is tooling: a board drawn while the flag was on keeps rendering when
 * it goes off, it just stops being checked — and the profile it was put on stays
 * written, unread, until the flag comes back (`docs/adr/0009`).
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
      context.register(ValidationRuleExtension(EDGY_RULES));
      context.register(ValidationProfileExtension(EDGY_PROFILES));
      // Work quality (WS1): the four expectations no algorithm can decide —
      // including the two the PO deliberately kept out of `rules.ts` on
      // 26/08/2026 (see `./nudges.ts`).
      context.register(QualityNudgeExtension(EDGY_NUDGES));
      // The Validation dropdown on a selected background's contextual toolbar.
      // A SECOND module on the same element, through the `custom:` flavour slot
      // (the pattern `gfx/wardley` uses on its map): the rendering toolbars are
      // registered always-on because a stored board must keep its toggles,
      // while choosing how hard to check it is tooling and belongs here. The
      // config itself names no framework — it reads roles and profiles — so
      // BOTH EDGY frames register the very same object.
      for (const flavour of [
        'custom:affine:surface:edgy',
        'custom:affine:surface:edgyBoard',
      ]) {
        context.register(
          ToolbarModuleExtension({
            id: BlockFlavourIdentifier(flavour),
            config: validationToolbarConfig,
          })
        );
      }
      // The resolver that turns a hand-drawn `edgy:relation` into the verb the
      // metamodel gives its two ends. It belongs HERE and not in the always-on
      // extension above, and the test is the one `docs/adr/0009` asks: does it
      // paint stored content, or does it author new content? It authors — it
      // writes a role and a label into the document — and the only edges it
      // ever sees are the ones the flag-gated tool below stamps. A board drawn
      // while the flag was on keeps every verb it was given (the vocabulary and
      // the renderers are always on); with the flag off nothing new is named
      // because nothing new is being armed. See `./relation-resolver.ts`.
      context.register(EdgyRelationResolver);
      context.register(edgySeniorTool);
      // The eight EDGY commands: the sub-menu renders them, Settings ›
      // Shortcuts finally lists them, and a host override on an id binds.
      context.register(CommandExtension(edgyCommands, edgyCommandIcons));
    }
  }
}
