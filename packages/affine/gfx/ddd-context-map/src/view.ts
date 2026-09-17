import {
  QualityNudgeExtension,
  ReadingProfileExtension,
  ValidationProfileExtension,
  ValidationRuleExtension,
} from '@labre/affine-block-surface';
import { FrameworkPaletteExtension } from '@labre/affine-components/color-picker';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { ToolbarModuleExtension } from '@labre/affine-shared/services';
import { TemplateCategoryExtension } from '@labre/affine-gfx-template';
import { BlockFlavourIdentifier, CommandExtension } from '@labre/std';
import { RoleVocabularyExtension } from '@labre/std/gfx';

import { contextMapCommandIcons, contextMapCommands } from './commands';
import { contextMapTemplateCategory } from './templates';
import { contextMapEffects } from './effects';
import { ContextMapRendererExtension } from './element-renderer';
import { ContextMapInteraction, ContextMapView } from './element-view';
import { CONTEXT_MAP_NUDGES } from './nudges';
import { CONTEXT_MAP_PROFILES } from './profiles';
import { CONTEXT_MAP_READING } from './reading';
import { CONTEXT_MAP_ROLES } from './roles';
import { CONTEXT_MAP_RULES } from './rules';
import {
  contextMapBoardToolbarExtension,
  contextMapBoardToolingToolbarConfig,
} from './toolbar/board-config';
import { CONTEXT_MAP_FRAMEWORK_PALETTE } from './toolbar/palette';
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
 * Its Templates-panel category is registered here as well (see `setup`).
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
      // The board's gated row — the Legend button and the Validation dropdown,
      // merged into ONE module because a flavour may carry exactly one
      // (`board-config.ts`). A SECOND module on the same element, through the
      // `custom:` flavour slot: `contextMapBoardToolbarExtension` is registered
      // always-on because a stored board must keep its resize toggle, while
      // generating a legend and choosing how hard to check the map are tooling
      // and belong here.
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier('custom:affine:surface:contextMap'),
          config: contextMapBoardToolingToolbarConfig,
        })
      );
      // The reversed reading (MF3): what the map says about a bounded context,
      // on demand. One declaration — the roles and the relationship edge, both
      // already stated elsewhere in this framework. The CLICK that triggers it
      // is registered once by the surface and gated by the presence of this
      // profile, so it goes with the flag without either side naming the other.
      context.register(ReadingProfileExtension(CONTEXT_MAP_READING));
      context.register(contextMapSeniorTool);
      // The Context Map's page of the colour pickers' carousel
      // (`docs/adr/0027`). Here, beside the senior tool, because offering hues
      // is TOOLING — the colours already painted on a stored map are content
      // and do not move (`docs/adr/0009`).
      context.register(
        FrameworkPaletteExtension(CONTEXT_MAP_FRAMEWORK_PALETTE)
      );
      // The Templates-panel category, gated by this framework's own flag like
      // every other framework's: a template is tooling (`docs/adr/0009`), and it
      // is DERIVED from this package's commands, so it registers where they do.
      context.register(TemplateCategoryExtension(contextMapTemplateCategory));
      context.register(
        CommandExtension(contextMapCommands, contextMapCommandIcons)
      );
    }
  }
}
