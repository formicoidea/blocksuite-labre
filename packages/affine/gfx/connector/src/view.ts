import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';

import { CommandExtension } from '@labre/std';

import { ConnectionOverlay } from './connector-manager';
import { ConnectorTool } from './connector-tool';
import {
  edgeDirectionCommands,
  EdgeDirectionManager,
  EdgeDirectionOverlay,
  edgeDirectionWidget,
} from './direction';
import { effects } from './effects';
import { ConnectorElementRendererExtension } from './element-renderer';
import { ConnectorDomRendererExtension } from './element-renderer/connector-dom';
import { ConnectorFilter } from './element-transform';
import { connectorToolbarExtension } from './toolbar/config';
import { connectorQuickTool } from './toolbar/quick-tool';
import { ConnectorElementView, ConnectorInteraction } from './view/view';

export class ConnectorViewExtension extends ViewExtensionProvider {
  override name = 'affine-connector-gfx';

  override effect(): void {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(ConnectorElementView);
    context.register(ConnectorElementRendererExtension);
    context.register(ConnectorDomRendererExtension);
    if (this.isEdgeless(context.scope)) {
      context.register(ConnectorTool);
      context.register(ConnectorFilter);
      context.register(connectorQuickTool);
      context.register(connectorToolbarExtension);
      context.register(ConnectionOverlay);
      context.register(ConnectorInteraction);
      // The direction affordance of `docs/adr/0010`, registered ALWAYS-ON with
      // the rest of the connector view: a typed edge is document content, so
      // what shows its orientation (M2) and what lets the user reverse it (M3)
      // must keep working when the framework that minted it is flagged off —
      // and `b.flip-direction`, which lies about such an edge, is hidden
      // whatever the flag says. All three are no-ops until some framework
      // registers a role vocabulary.
      context.register(EdgeDirectionManager);
      context.register(EdgeDirectionOverlay);
      context.register(edgeDirectionWidget);
      context.register(CommandExtension(edgeDirectionCommands));
    }
  }
}
