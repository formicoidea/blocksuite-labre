import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { TelemetryProvider } from '@labre/affine-shared/services';
import {
  type CommandDescriptor,
  type CommandInvocation,
  CommandTelemetryIdentifier,
  type CommandTelemetryReporter,
} from '@labre/std';
import type { ExtensionType } from '@labre/store';

import { frameworkDescriptor } from '../frameworks.js';

/**
 * The ONE place a framework command's telemetry is emitted.
 *
 * Before PF3 every surface re-implemented its own `track()` — which is how
 * cynefin-estuarine ended up emitting nothing at all, and how the same artefact
 * could be counted differently depending on which menu created it. The registry
 * now calls this reporter from `runCommand`, and nowhere else.
 *
 * Wire values are HISTORICAL by construction: `framework` and `segment` come
 * from `FrameworkDescriptor.telemetryKey` / `.telemetrySegment`, so unifying
 * the code-side identity breaks no existing PostHog dashboard.
 */

/** `CommandKind` → the ADR 0003 event it reports. */
const EVENT_BY_KIND = {
  artefact: 'FrameworkElementAdded',
  toggle: 'FrameworkElementAdded',
  tool: 'FrameworkToolPicked',
  legend: 'FrameworkLegendCreated',
  action: 'FrameworkElementAdded',
} as const;

/**
 * `module`, per historical convention: the menu that created the element, or
 * the literal `'keyboard shortcut'` Wardley already emitted.
 */
function moduleOf(telemetryKey: string, invocation: CommandInvocation): string {
  if (invocation.surface === 'shortcut') return 'keyboard shortcut';
  if (invocation.surface === 'senior-menu') return `${telemetryKey} menu`;
  return `${telemetryKey} ${invocation.surface}`;
}

export function reportCommandTelemetry(
  track: (event: string, payload: Record<string, unknown>) => void,
  command: CommandDescriptor,
  invocation: CommandInvocation
): void {
  const { telemetry } = command;
  if (!telemetry) return;
  const framework = frameworkDescriptor(telemetry.framework);
  if (!framework) return;

  track(EVENT_BY_KIND[command.kind], {
    framework: framework.telemetryKey,
    element: telemetry.element,
    page: 'whiteboard editor',
    segment: framework.telemetrySegment,
    module: moduleOf(framework.telemetryKey, invocation),
    // New dimension, no existing value changed: which of the five consumers
    // invoked the command. This is the metric that will arbitrate the 14
    // senior slots against the sidepanel against the palette.
    control: invocation.source,
  });
}

const reporter: CommandTelemetryReporter = ({ std, command, invocation }) => {
  const telemetry = std.getOptional(TelemetryProvider);
  if (!telemetry) return;
  reportCommandTelemetry(
    (event, payload) =>
      telemetry.track(event as 'FrameworkElementAdded', payload as never),
    command,
    invocation
  );
};

export const CommandTelemetryExtension: ExtensionType = {
  // Factory form, not value form: the container calls a function argument as a
  // factory, so registering the reporter directly would resolve it with the
  // service provider instead of the report.
  setup: di => {
    di.addImpl(CommandTelemetryIdentifier, () => reporter);
  },
};

/**
 * Registered unconditionally by `getInternalViewExtensions`: the emitter is not
 * a framework's business, and a framework toggled off simply never invokes a
 * command.
 */
export class CommandTelemetryViewExtension extends ViewExtensionProvider {
  override name = 'affine-command-telemetry';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(CommandTelemetryExtension);
  }
}
