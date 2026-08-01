import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { CommandExtension } from '@labre/std';

import {
  eventStormingCommandIcons,
  eventStormingCommands,
} from './commands';
import { eventStormingEffects } from './effects';
import { eventStormingSeniorTool } from './toolbar/senior-tool';

/**
 * Event Storming — independently flag-gated (`ddd-event-storming`).
 *
 * Note: its Templates-panel category is registered by the aggregate package's
 * {@link DddTemplatesViewExtension} (gated by `ddd-templates`), so templates
 * stay available even when this senior button is disabled.
 */
export class DddEventStormingViewExtension extends ViewExtensionProvider {
  override name = 'affine-ddd-event-storming-gfx';

  override effect(): void {
    super.effect();
    eventStormingEffects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(eventStormingSeniorTool);
      context.register(
        CommandExtension(eventStormingCommands, eventStormingCommandIcons)
      );
    }
  }
}
