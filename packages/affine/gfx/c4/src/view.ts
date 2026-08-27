import { FrameworkBackgroundInteractionExtension } from '@labre/affine-block-surface';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { CommandExtension } from '@labre/std';
import { RoleVocabularyExtension } from '@labre/std/gfx';

import { C4_BOARD_BACKGROUND, C4_BOUNDARY_BACKGROUND } from './background';
import { c4CommandIcons, c4Commands } from './commands';
import { effects } from './effects';
import {
  C4BoardRendererExtension,
  C4BoundaryRendererExtension,
} from './element-renderer';
import { C4BoardView, C4BoundaryView } from './element-view';
import { C4NodeRendererExtension } from './node/node-renderer';
import { C4NodeView } from './node/node-view';
import { C4_ROLES } from './roles';
import { c4BoardToolbarExtension } from './toolbar/config';
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
      // The selected board's own row. Always-on for the reason `docs/adr/0009`
      // gives — a stored board must keep its resize toggle with the C4 button
      // switched off. The legend entry on that row invokes a flag-gated
      // command and asks the registry for it, so with the flag off it hides
      // rather than becoming a button that does nothing (`toolbar/config.ts`).
      context.register(c4BoardToolbarExtension);
    }
  }
}

/**
 * C4 creation tooling — flag-gated (`c4`): the senior toolbar button, its
 * sub-menu and the thirteen commands behind them, plus the legend command the
 * board's always-on toolbar invokes.
 *
 * All of it is tooling in the sense `docs/adr/0009` means: a diagram drawn while
 * the flag was on keeps painting, stays selectable and keeps its contextual
 * toolbar when it goes off — only the ways to add new elements go away.
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
      context.register(c4SeniorTool);
      context.register(CommandExtension(c4Commands, c4CommandIcons));
    }
  }
}
