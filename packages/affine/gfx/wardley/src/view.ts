import {
  ReadingProfileExtension,
  tagsToolbarConfig,
  validationToolbarConfig,
  QualityNudgeExtension,
  ValidationProfileExtension,
  ValidationRuleExtension,
} from '@labre/affine-block-surface';
import {
  AuditCriterionExtension,
  ToolbarModuleExtension,
  UniverseTagDefsExtension,
} from '@labre/affine-shared/services';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { extendTemplateCategory } from '@labre/affine-gfx-template';
import { BlockFlavourIdentifier, CommandExtension } from '@labre/std';
import { RoleVocabularyExtension } from '@labre/std/gfx';

import { WARDLEY_AUDIT_CRITERIA } from './audit-criteria';
import { wardleyCommandIcons, wardleyCommands } from './commands';
import { effects } from './effects';
import { WARDLEY_TAG_DEFS } from './natures';
import { WARDLEY_PROFILES } from './profiles';
import { WARDLEY_CHECKUP_RULES, WARDLEY_NUDGES } from './quality';
import { WARDLEY_READING } from './reading';
import { WARDLEY_ROLES } from './roles';
import { WARDLEY_RULES } from './rules';
import { wardleyTemplateCategory } from './templates';
import { WardleyElementRendererExtension } from './element-renderer';
import { WardleyInteraction, WardleyView } from './element-view';
import { WardleyNodeRendererExtension } from './node/node-renderer';
import { WardleyNodeView } from './node/node-view';
import { wardleyNodeToolbarExtension } from './toolbar/node-config';
import { wardleyToolbarExtension } from './toolbar/config';
import { wardleySeniorTool } from './toolbar/senior-tool';

/**
 * Wardley rendering — ALWAYS registered, independent of any flag. Disabling
 * `wardley` hides only the creation tooling (see {@link WardleyViewExtension});
 * maps already drawn must still paint, stay selectable, stay editable and keep
 * their contextual toolbar. See `docs/adr/0009`.
 */
export class WardleyRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-wardley-render-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(WardleyView);
    context.register(WardleyElementRendererExtension);
    context.register(WardleyNodeView);
    context.register(WardleyNodeRendererExtension);
    // The role VOCABULARY, always on. A role is written in the document, not in
    // the tooling: the direction reveal of a typed edge, the inversion command
    // and the toolbar entry that must not lie about one all read this, and they
    // have to keep working on a map drawn while the flag was on and opened
    // while it is off (`docs/adr/0009`, `docs/adr/0010`). The rules that
    // JUDGE those roles stay in the flag-gated extension below.
    context.register(RoleVocabularyExtension(WARDLEY_ROLES));
    if (this.isEdgeless(context.scope)) {
      context.register(WardleyInteraction);
      context.register(wardleyToolbarExtension);
      context.register(wardleyNodeToolbarExtension);
    }
  }
}

/**
 * Wardley creation tooling — flag-gated (`wardley`): the senior toolbar button,
 * its templates category, the edgeless chords (w+c, w+l, ...) and the
 * validation rules and profiles. Both are tooling: a map drawn while the flag
 * was on keeps rendering when it goes off, it just stops being checked — and
 * the profile it was put on stays written, unread, until the flag comes back.
 */
export class WardleyViewExtension extends ViewExtensionProvider {
  override name = 'affine-wardley-gfx';

  override effect(): void {
    super.effect();
    // Defines the senior button and its menu — tooling-only custom elements.
    effects();
    extendTemplateCategory(wardleyTemplateCategory);
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(ValidationRuleExtension(WARDLEY_RULES));
      context.register(ValidationProfileExtension(WARDLEY_PROFILES));
      // Map quality (PF13.8 / PF13.9): the four nudges the tool cannot judge,
      // and the two on-demand rules it can. The check-up rules go through the
      // SAME registration as the real-time ones — `moment: 'on-demand'` is what
      // keeps them out of the drawing path, not a separate registry — while
      // staying out of `WARDLEY_RULES`, which is what the 16 ms bench measures.
      context.register(ValidationRuleExtension(WARDLEY_CHECKUP_RULES));
      context.register(QualityNudgeExtension(WARDLEY_NUDGES));
      // A1–A3, the level-3 criteria (PF14.1). Registered HERE, beside the rules
      // and for the same reason: a criterion is tooling, so Wardley switched
      // off contributes none and `map.audit` finds nothing to ask about — while
      // `ai-audit` independently decides whether the command exists at all.
      //
      // Levels 2 and 3 sit one line apart and stay independent: the check-up
      // above is deterministic and runs in-process, the criteria below are
      // handed to a host's model. Neither reads the other's results.
      context.register(AuditCriterionExtension(WARDLEY_AUDIT_CRITERIA));
      // The Validation dropdown on a selected map's contextual toolbar. A
      // SECOND module on the same element, through the `custom:` flavour slot
      // (the pattern `gfx/mindmap` uses on `custom:affine:surface:shape`):
      // `wardleyToolbarExtension` is registered always-on because a stored map
      // must keep its axes and labels, while choosing how hard to check it is
      // tooling and belongs here. The config itself names no framework — it
      // reads roles and profiles — so a second framework registers the very
      // same object on its own flavour.
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier('custom:affine:surface:wardley'),
          config: validationToolbarConfig,
        })
      );
      // The four natures — Wardley's type-3 qualification (MF3, ADR 0007).
      // Seeded on the SAME mechanism a host uses for its own taxonomy: the
      // library ships one real pack, and a client's private extension is a
      // second pack with another `packId` that merges with this one, with no
      // library release. All packs must land in this one DI scope — `getAll`
      // never merges across scopes.
      context.register(UniverseTagDefsExtension(WARDLEY_TAG_DEFS));
      // The qualification dropdown on the selected component's toolbar. A
      // THIRD module on the same element, through a free `custom:` flavour
      // slot. Generic in shape — it names no framework and builds its sections
      // from the seeded packs — but parameterized by this framework's role
      // vocabulary, because ADR 0007 § 2bis deliberately keeps roles out of DI
      // and there is therefore no way to look up "which vocabulary governs this
      // element". Registered on the NODE and on the GROUP: one click on a
      // Wardley component selects the group that holds the circle and its
      // label, and the role lives on the circle.
      for (const flavour of [
        'custom:affine:surface:wardleyNode',
        'custom:affine:surface:group',
      ]) {
        context.register(
          ToolbarModuleExtension({
            id: BlockFlavourIdentifier(flavour),
            config: tagsToolbarConfig(WARDLEY_ROLES),
          })
        );
      }
      // The reversed reading (MF3): what the map says about a component, on
      // demand. One declaration — the roles, the nature tag, the dependency
      // edge and the map's own zones, all of them already stated elsewhere in
      // this framework — is the whole of what makes the generic engine able to
      // read a Wardley map. The CLICK that triggers it is registered once by
      // the surface and gated by the presence of this profile, so it goes with
      // the flag without either side naming the other.
      context.register(ReadingProfileExtension(WARDLEY_READING));
      context.register(wardleySeniorTool);
      // The 13 Wardley commands, ONE registration for both faces: the
      // enumerable registry the sub-menu renders from, and — through
      // `toShortcutDescriptor` — the edgeless chords (w+c, w+l, ...).
      // Registering here inherits both the wardley flag gating and the
      // edgeless-only availability; the keymap installer is
      // ShortcutKeymapExtension('edgeless') in root.
      context.register(CommandExtension(wardleyCommands, wardleyCommandIcons));
    }
  }
}
