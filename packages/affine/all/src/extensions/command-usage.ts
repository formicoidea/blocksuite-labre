import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { createLocalCommandUsageStore } from '@labre/affine-shared/services';
import { CommandUsageIdentifier } from '@labre/std';
import type { ExtensionType } from '@labre/store';

/**
 * The DEFAULT command usage measure: `localStorage`, this browser only.
 *
 * `runCommand` records every invocation into whatever answers
 * `CommandUsageIdentifier`; without a default nothing would be measured at all
 * until a host wired a store, and PF6's "four most-used + three most-recent"
 * sub-menu would have nothing to rank in a standalone editor. A host that owns
 * a per-user database replaces this with `CommandUsageExtension(store)`, whose
 * `di.override` beats the `addImpl` below.
 */
export const CommandUsageDefaultExtension: ExtensionType = {
  // Factory form, not value form — as for the telemetry reporter: the container
  // calls a function argument as a factory, so the store is built here and the
  // service provider is never passed to it.
  setup: di => {
    di.addImpl(CommandUsageIdentifier, () => createLocalCommandUsageStore());
  },
};

/**
 * Registered unconditionally by `getInternalViewExtensions`, next to
 * `CommandTelemetryViewExtension` and for the same reason: measuring which
 * commands a user reaches for is not a framework's business, and a framework
 * toggled off simply never invokes a command.
 */
export class CommandUsageViewExtension extends ViewExtensionProvider {
  override name = 'affine-command-usage';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(CommandUsageDefaultExtension);
  }
}
