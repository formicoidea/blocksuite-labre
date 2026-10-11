/**
 * A stored callout renders whatever the `callout` flag says (#418, ADR 0009).
 *
 * Until 2026-10-11 `{ callout: false }` unregistered the callout's block view,
 * so a document holding callouts rendered them as nothing (`lit-host` "Cannot
 * find render flavour", then `nothing`): the flag gated content, which ADR 0009
 * forbids. The view is now split like the frameworks' —
 * `CalloutRenderViewExtension` always on, `CalloutViewExtension` (slash item,
 * Turn into entry) gated — and this suite mounts the real view extensions with
 * the flag off and reads back the two bindings `std.getView` and the block
 * spec need: the block view and the flavour. Re-gating the render half fails
 * here; the creation half's gating is pinned in
 * `callout-turn-into-gating.unit.spec.ts`.
 */
import { ViewExtensionManager } from '@labre/affine-ext-loader';
import { Container } from '@labre/global/di';
import { BlockFlavourIdentifier, BlockViewIdentifier } from '@labre/std';
import { literal } from 'lit/static-html.js';
import { describe, expect, test } from 'vitest';

import { getInternalViewExtensions } from '../../extensions/view.js';
import type { BlockFlags } from '../../flags.js';

function mounted(scope: 'page' | 'edgeless', flags: BlockFlags) {
  const manager = new ViewExtensionManager(getInternalViewExtensions(flags));
  const container = new Container();
  manager.get(scope).forEach(ext => ext.setup(container));
  return container.provider();
}

describe('a stored callout renders with the callout flag off', () => {
  test.each(['page', 'edgeless'] as const)(
    'its block view is registered (%s)',
    scope => {
      const view = mounted(scope, { callout: false }).getOptional(
        BlockViewIdentifier('affine:callout')
      );
      // The tag `lit-host` stamps: the element `effects()` defines.
      expect(view).toEqual(literal`affine-callout`);
    }
  );

  test.each(['page', 'edgeless'] as const)(
    'its flavour is registered (%s)',
    scope => {
      expect(
        mounted(scope, { callout: false }).getOptional(
          BlockFlavourIdentifier('affine:callout')
        )
      ).toEqual({ flavour: 'affine:callout' });
    }
  );
});
