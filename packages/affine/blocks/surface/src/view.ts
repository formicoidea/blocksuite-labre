import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import {
  BlockViewExtension,
  CommandExtension,
  FlavourExtension,
} from '@labre/std';
import { literal } from 'lit/static-html.js';

import { effects } from './effects';
import {
  auditCommands,
  EdgelessCRUDExtension,
  EdgelessLegacySlotExtension,
  EditPropsMiddlewareBuilder,
  mapQualityCommands,
  mapQualityWidget,
  SpotlightManager,
  ValidationManager,
  validationExceptionToolbarExtension,
  ValidationOverlay,
  violationDetailWidget,
} from './extensions';
import { ExportManagerExtension } from './extensions/export-manager/export-manager';
import { DefaultTool } from './tool/default-tool';

export class SurfaceViewExtension extends ViewExtensionProvider {
  override name = 'affine-surface-block';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      FlavourExtension('affine:surface'),
      EdgelessCRUDExtension,
      EdgelessLegacySlotExtension,
      ExportManagerExtension,
    ]);
    if (this.isEdgeless(context.scope)) {
      context.register(DefaultTool);
      context.register(
        BlockViewExtension('affine:surface', literal`affine-surface`)
      );
      context.register(EditPropsMiddlewareBuilder);
      // No-op until a framework registers a SpotlightHostExtension.
      context.register(SpotlightManager);
      // No-op until a framework registers a ValidationRuleExtension — which
      // only its FLAG-GATED view extension does, so a disabled framework
      // costs no evaluation at all.
      context.register(ValidationManager);
      context.register(ValidationOverlay);
      // The persistent badge and its detail bubble. Renders nothing until the
      // manager reports a violation, which it cannot do without a rule.
      context.register(violationDetailWidget);
      // "Revoke exception" on the contextual toolbar of whichever element
      // answers for it. Shows nothing until an element carries an exception a
      // REGISTERED rule can be arbitrated on, so a board with no framework
      // enabled never sees it.
      context.register(validationExceptionToolbarExtension);
      // The Map quality panel (PF7.11) and the one command that opens it.
      // Both are generic: they render and offer nothing until a framework
      // registers a nudge or an on-demand rule, which only its FLAG-GATED view
      // extension does.
      context.register(mapQualityWidget);
      context.register(CommandExtension(mapQualityCommands));
    } else {
      context.register(
        BlockViewExtension('affine:surface', literal`affine-surface-void`)
      );
    }
  }
}

/**
 * The AI audit seam — gated by the `ai-audit` capability switch (PF14.1).
 *
 * Its own extension, registered from `getInternalViewExtensions` only when the
 * switch is on, because that is what makes the gate REAL: off, `map.audit` is
 * never registered, so it is absent from the command registry, from both
 * manifests and from the keymap at once — the same two-sided gating a framework
 * flag gets, asserted by the same test.
 *
 * Nothing here is registered by {@link SurfaceViewExtension}: the audit is not
 * part of a surface's job, and folding it in would make the switch a filter
 * over something already wired instead of a decision not to wire it.
 */
export class AuditViewExtension extends ViewExtensionProvider {
  override name = 'affine-audit-seam';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    // Edgeless only: an audit is about a map, and a map is a canvas artefact.
    if (!this.isEdgeless(context.scope)) return;
    context.register(CommandExtension(auditCommands));
  }
}
