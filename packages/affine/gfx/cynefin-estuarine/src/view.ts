import {
  QualityNudgeExtension,
  ValidationFrameworkExtension,
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

import {
  cynefinEstuarineCommandIcons,
  cynefinEstuarineCommands,
} from './commands';
import { CynefinRendererExtension } from './cynefin/element-renderer';
import { CynefinInteraction, CynefinView } from './cynefin/element-view';
import { cynefinToolbarExtension } from './cynefin/toolbar/config';
import { effects } from './effects';
import { EstuarineRendererExtension } from './estuarine/element-renderer';
import { EstuarineInteraction, EstuarineView } from './estuarine/element-view';
import {
  EstuarineGhostManager,
  EstuarineGhostOverlay,
} from './estuarine/ghost-overlay';
import { ESTUARINE_NUDGES } from './estuarine/nudges';
import { ESTUARINE_ROLE, ESTUARINE_ROLES } from './estuarine/roles';
import { estuarineToolbarExtension } from './estuarine/toolbar/config';
import {
  cynefinTemplateCategory,
  estuarineTemplateCategory,
} from './templates';
import { cynefinEstuarineSeniorTool } from './toolbar/senior-tool';

/**
 * Cynefin / Estuarine rendering — ALWAYS registered, independent of any flag.
 * Disabling `cynefin-estuarine` hides only the creation tooling (see
 * {@link CynefinEstuarineViewExtension}); frames already drawn must still
 * paint, stay selectable, stay editable and keep their contextual toolbar. See
 * `docs/adr/0009`.
 */
export class CynefinEstuarineRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-cynefin-estuarine-render-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(CynefinView);
    context.register(CynefinRendererExtension);
    context.register(EstuarineView);
    context.register(EstuarineRendererExtension);
    // The role VOCABULARY, always on. A role is written in the document, not in
    // the tooling: a map drawn while the flag was on and opened while it is off
    // still carries `estuarine:map`, and anything that READS a role — the
    // qualification toolbar, a host panel — has to keep working
    // (`docs/adr/0009`). What JUDGES those roles stays flag-gated below.
    // Cynefin contributes nothing here and never will (`estuarine/roles.ts`).
    context.register(RoleVocabularyExtension(ESTUARINE_ROLES));
    if (this.isEdgeless(context.scope)) {
      context.register(CynefinInteraction);
      context.register(EstuarineInteraction);
      context.register(cynefinToolbarExtension);
      context.register(estuarineToolbarExtension);
      // The reveal animation of a curve toggle. ALWAYS on, with the renderer
      // it animates: the permanent ghost is how a shown curve looks now, so
      // the ~600 ms that makes its arrival visible is part of painting the
      // element, not part of the creation tooling. It writes nothing, and it
      // costs one media query plus one map lookup on a board with no
      // Estuarine map at all.
      context.register(EstuarineGhostOverlay);
      context.register(EstuarineGhostManager);
    }
  }
}

/**
 * Cynefin / Estuarine creation tooling — flag-gated (`cynefin-estuarine`): the
 * senior toolbar button and both templates categories.
 */
export class CynefinEstuarineViewExtension extends ViewExtensionProvider {
  override name = 'affine-cynefin-estuarine-gfx';

  override effect(): void {
    super.effect();
    // Defines the senior button and its menu — tooling-only custom elements.
    effects();
    extendTemplateCategory(cynefinTemplateCategory);
    extendTemplateCategory(estuarineTemplateCategory);
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      // Estuarine's ROOT INSTANCE declaration (WS0.3). Every other framework
      // derives "this element is my frame" from a rule naming the role as its
      // background; Estuarine ships no rule at all — by arbitration, not by
      // omission (see `estuarine/nudges.ts`) — so it says so explicitly rather
      // than inventing a rule that fires on nothing just to open a gate.
      context.register(
        ValidationFrameworkExtension([
          {
            framework: 'estuarine',
            backgroundRole: ESTUARINE_ROLE.map,
            roles: ESTUARINE_ROLES,
          },
        ])
      );
      // Map quality: the four expectations no algorithm can check. This is the
      // whole of what validation offers on an Estuarine map — no rules, and
      // therefore NO profiles: a severity dial over an empty rule set is a
      // control that decides nothing.
      context.register(QualityNudgeExtension(ESTUARINE_NUDGES));
      // The Validation dropdown on a selected map's contextual toolbar — a
      // SECOND module on the same element, through the free `custom:` flavour
      // slot (`estuarineToolbarExtension` owns the plain one and is always-on,
      // because a stored map must keep its curve toggles). The config names no
      // framework: it reads roles, profiles and nudges, so here it renders the
      // checklist entry and no profile picker.
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier('custom:affine:surface:estuarine'),
          config: validationToolbarConfig,
        })
      );
      context.register(cynefinEstuarineSeniorTool);
      context.register(
        CommandExtension(cynefinEstuarineCommands, cynefinEstuarineCommandIcons)
      );
    }
  }
}
