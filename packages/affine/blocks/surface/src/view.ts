import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { BlockViewExtension, FlavourExtension } from '@labre/std';
import { literal } from 'lit/static-html.js';

import { effects } from './effects';
import {
  EdgelessCRUDExtension,
  EdgelessLegacySlotExtension,
  EditPropsMiddlewareBuilder,
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
    } else {
      context.register(
        BlockViewExtension('affine:surface', literal`affine-surface-void`)
      );
    }
  }
}
