/**
 * The Templates shortcut (`canvas.templates.toggle`, ADR 0055 § 7) only claims
 * `l` where there is a Templates button to open. A host that removes the
 * button used to see `l` swallowed and the toolbar row walked for nothing;
 * with no Templates senior tool registered, the command's `when` is false, so
 * the key is free.
 */
import {
  EDGELESS_TOOLBAR_WIDGET,
  SeniorToolIdentifier,
} from '@labre/affine-widget-edgeless-toolbar';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, test } from 'vitest';

import { templateCommands } from '../commands.js';
import { TEMPLATE_SENIOR_TOOL_ID } from '../toolbar/senior-tool.js';

const command = templateCommands.find(c => c.id === 'canvas.templates.toggle')!;

function stdWith(options: { button: boolean; presenting?: boolean }) {
  const toolbar = { isPresentMode: options.presenting ?? false };
  return {
    store: { root: { id: 'root' } },
    view: {
      getBlock: () => ({
        widgetComponents: { [EDGELESS_TOOLBAR_WIDGET]: toolbar },
      }),
    },
    provider: {
      getAll: (identifier: unknown) =>
        new Map(
          identifier === SeniorToolIdentifier && options.button
            ? [[TEMPLATE_SENIOR_TOOL_ID, () => ({})]]
            : []
        ),
    },
  } as unknown as BlockStdScope;
}

describe('the Templates shortcut', () => {
  test('is offered when the toolbar has a Templates button', () => {
    expect(command.when?.(stdWith({ button: true }))).toBe(true);
  });

  test('leaves `l` free when the assembly has no Templates button', () => {
    expect(command.when?.(stdWith({ button: false }))).toBe(false);
  });

  test('is refused during a presentation', () => {
    expect(command.when?.(stdWith({ button: true, presenting: true }))).toBe(
      false
    );
  });
});
