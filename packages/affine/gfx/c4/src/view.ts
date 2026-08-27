import { FrameworkBackgroundInteractionExtension } from '@labre/affine-block-surface';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { RoleVocabularyExtension } from '@labre/std/gfx';

import { C4_BOARD_BACKGROUND, C4_BOUNDARY_BACKGROUND } from './background';
import {
  C4BoardRendererExtension,
  C4BoundaryRendererExtension,
} from './element-renderer';
import { C4BoardView, C4BoundaryView } from './element-view';
import { C4NodeRendererExtension } from './node/node-renderer';
import { C4NodeView } from './node/node-view';
import { C4_ROLES } from './roles';

/**
 * C4 rendering — ALWAYS registered, independent of any flag. Boards, boundaries
 * and nodes already drawn must paint, stay selectable, stay editable and keep
 * their resize gating whatever the tooling flag says. See `docs/adr/0009`.
 *
 * This is the RENDER half only. The creation tooling — the senior button, its
 * commands, the templates category and the flag that gates them — is a separate
 * extension in a later slice, exactly as `BpmnViewExtension` is separate from
 * `BpmnRenderViewExtension`. Nothing in this file may become flag-gated: a
 * stored document needs every one of these registrations to load and paint.
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
    }
  }
}
