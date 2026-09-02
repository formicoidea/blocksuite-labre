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

import { coreDomainCommandIcons, coreDomainCommands } from './commands';
import { CoreDomainRendererExtension } from './core-domain/element-renderer';
import {
  CoreDomainInteraction,
  CoreDomainView,
} from './core-domain/element-view';
import { coreDomainToolbarExtension } from './core-domain/toolbar-config';
import { coreDomainEffects } from './effects';
import { CORE_DOMAIN_MORPH_SPEC } from './morph';
import { CORE_DOMAIN_NUDGES } from './nudges';
import { CORE_DOMAIN_PROFILES } from './profiles';
import { CORE_DOMAIN_ROLES } from './roles';
import { CORE_DOMAIN_RULES } from './rules';
import { coreDomainSeniorTool } from './toolbar/senior-tool';

/**
 * Core Domain Chart rendering — ALWAYS registered, independent of any flag.
 * Disabling `ddd-core-domain` hides only the senior toolbar button (see
 * {@link DddCoreDomainViewExtension}); placed `coreDomain` elements must still
 * paint, stay selectable, and keep their contextual toolbar, and Templates-
 * panel insertion must still render them.
 */
export class DddCoreDomainRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-ddd-core-domain-render-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(CoreDomainView);
    context.register(CoreDomainRendererExtension);
    // The role VOCABULARY, always on. A role is written in the document, not in
    // the tooling: the direction reveal of a typed movement and the inversion
    // command read this, and they have to keep working on a chart drawn while
    // the flag was on and opened while it is off (`docs/adr/0009`,
    // `docs/adr/0010`). The rules that JUDGE those roles stay in the
    // flag-gated extension below.
    context.register(RoleVocabularyExtension(CORE_DOMAIN_ROLES));
    if (this.isEdgeless(context.scope)) {
      context.register(CoreDomainInteraction);
      context.register(coreDomainToolbarExtension);
    }
  }
}

/**
 * Core Domain Chart senior button — independently flag-gated (`ddd-core-domain`)
 * — and, beside it, the validation tooling: the rules, the profiles and the
 * work-quality checklist.
 *
 * Note: its Templates-panel category is registered by the aggregate package's
 * {@link DddTemplatesViewExtension} (gated by `ddd-templates`), so templates
 * stay available even when this senior button is disabled.
 */
export class DddCoreDomainViewExtension extends ViewExtensionProvider {
  override name = 'affine-ddd-core-domain-gfx';

  override effect(): void {
    super.effect();
    coreDomainEffects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(ValidationRuleExtension(CORE_DOMAIN_RULES));
      context.register(ValidationProfileExtension(CORE_DOMAIN_PROFILES));
      context.register(QualityNudgeExtension(CORE_DOMAIN_NUDGES));
      // The Validation dropdown on a selected chart's contextual toolbar. A
      // SECOND module on the same element, through the `custom:` flavour slot:
      // `coreDomainToolbarExtension` is registered always-on because a stored
      // chart must keep its legend action, while choosing how hard to check it
      // is tooling and belongs here. The config itself names no framework — it
      // reads roles and profiles — so it is the very same object Wardley
      // registers on its own flavour.
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier('custom:affine:surface:coreDomain'),
          config: validationToolbarConfig,
        })
      );
      context.register(coreDomainSeniorTool);
      context.register(
        CommandExtension(coreDomainCommands, coreDomainCommandIcons)
      );
      // The "Change type" dropdown on a selected dot's or marker's contextual
      // toolbar — the generic module, parameterized by this framework's two
      // families.
      //
      // ## Why the key carries an owner
      //
      // Both artefacts are native `group`s, so the row the toolbar draws for one
      // is the GROUP's row, merged from `affine:surface:group`,
      // `custom:affine:surface:group` and the surface wildcards. Both group keys
      // are long since claimed — the native group operations on one, Wardley's
      // qualification dropdown on the other, with C4's morph already registered
      // under a suffixed variant — and a second module on either would throw
      // `DuplicateServiceDefinitionError` before the editor finished setting up.
      // `toolbarModuleKey` is what lifts that ceiling: the module is registered
      // under `custom:affine:surface:group#ddd-core-domain-morph` and the
      // registry hands it to the same row.
      //
      // ## Why here
      //
      // In the flag-gated half, because a morph is TOOLING: a dot placed while
      // the flag was on keeps its role, its colour, its caption and its place in
      // every rule when the flag goes off — it just stops being something the
      // toolbar offers to say differently (`docs/adr/0009`).
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier(
            toolbarModuleKey(
              'custom:affine:surface:group',
              'ddd-core-domain-morph'
            )
          ),
          config: morphToolbarConfig(CORE_DOMAIN_MORPH_SPEC),
        })
      );
    }
  }
}
