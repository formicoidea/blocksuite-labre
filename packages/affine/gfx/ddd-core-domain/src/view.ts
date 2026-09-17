import {
  morphToolbarConfig,
  QualityNudgeExtension,
  ReadingProfileExtension,
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
import { TemplateCategoryExtension } from '@labre/affine-gfx-template';
import { BlockFlavourIdentifier, CommandExtension } from '@labre/std';
import { RoleVocabularyExtension } from '@labre/std/gfx';

import { coreDomainCommandIcons, coreDomainCommands } from './commands';
import { coreDomainTemplateCategory } from './templates';
import { CoreDomainRendererExtension } from './core-domain/element-renderer';
import {
  CoreDomainInteraction,
  CoreDomainView,
} from './core-domain/element-view';
import { coreDomainChartToolingToolbarConfig } from './core-domain/toolbar-config';
import { coreDomainEffects } from './effects';
import { CORE_DOMAIN_MORPH_SPEC } from './morph';
import { CORE_DOMAIN_NUDGES } from './nudges';
import { CORE_DOMAIN_PROFILES } from './profiles';
import { CORE_DOMAIN_READINGS } from './reading';
import { CORE_DOMAIN_ROLES } from './roles';
import { CORE_DOMAIN_RULES } from './rules';
import { coreDomainSeniorTool } from './toolbar/senior-tool';

/**
 * Core Domain Chart rendering — ALWAYS registered, independent of any flag.
 * Disabling `ddd-core-domain` hides only the tooling (see
 * {@link DddCoreDomainViewExtension}); placed `coreDomain` elements must still
 * paint, stay selectable and stay movable, and Templates-panel insertion must
 * still render them.
 *
 * The chart claims no always-on toolbar module: the legend button was its only
 * contextual entry and it moved to the gated half (`docs/adr/0026`).
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
    }
  }
}

/**
 * Core Domain Chart senior button — independently flag-gated (`ddd-core-domain`)
 * — and, beside it, the validation tooling: the rules, the profiles and the
 * work-quality checklist.
 *
 * Its Templates-panel category is registered here as well (see `setup`).
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
      // The chart's WHOLE contextual row — the Legend button and the Validation
      // dropdown, merged into ONE module because a flavour may carry exactly one
      // (`core-domain/toolbar-config.ts`). Both are tooling: with the flag off a
      // stored chart keeps everything drawn on it and simply offers no button.
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier('custom:affine:surface:coreDomain'),
          config: coreDomainChartToolingToolbarConfig,
        })
      );
      // The reversed reading (MF3): what the chart says about an artefact, on
      // demand. Two profiles, because the vocabulary has two disjoint node
      // families and neither may inherit the other's rules (`reading.ts`). The
      // CLICK that triggers it is registered once by the surface and gated by
      // the presence of a profile.
      for (const reading of CORE_DOMAIN_READINGS) {
        context.register(ReadingProfileExtension(reading));
      }
      context.register(coreDomainSeniorTool);
      // The Templates-panel category, gated by this framework's own flag like
      // every other framework's: a template is tooling (`docs/adr/0009`), and it
      // is DERIVED from this package's commands, so it registers where they do.
      context.register(TemplateCategoryExtension(coreDomainTemplateCategory));
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
