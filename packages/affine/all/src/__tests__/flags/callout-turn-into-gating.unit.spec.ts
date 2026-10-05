/**
 * "Turn into → Callout" and the slash-menu "Callout" are TOOLING, so the
 * `callout` flag removes them (#418, ADR 0009) — and the `callout` flag is the
 * ONLY switch: `FeatureFlagService`'s `enable_callout` is deprecated and no
 * longer read, so with default flags both entries are offered.
 *
 * The "Turn into" menu lists the static `textConversionConfigs` whatever the
 * flags say; that is exactly why the callout entry is NOT in that list but
 * registered by `CalloutViewExtension`. Appending it to the static list would
 * keep this suite green on the declaration and still offer the conversion
 * with `{ callout: false }` — so the check mounts the real view extensions and
 * reads the container back, the way the other gating suites do. The entries'
 * own `when` (no `enable_callout` read) is pinned beside them, in the callout
 * package's `turn-into-callout.unit.spec.ts`.
 */
import { ViewExtensionManager } from '@labre/affine-ext-loader';
import { TextConversionEntryIdentifier } from '@labre/affine-rich-text';
import { SlashMenuConfigIdentifier } from '@labre/affine-widget-slash-menu';
import { Container } from '@labre/global/di';
import { describe, expect, test } from 'vitest';

import { getInternalViewExtensions } from '../../extensions/view.js';
import type { BlockFlags } from '../../flags.js';

function mounted(scope: 'page' | 'edgeless', flags: BlockFlags) {
  const manager = new ViewExtensionManager(getInternalViewExtensions(flags));
  const container = new Container();
  manager.get(scope).forEach(ext => ext.setup(container));
  return container.provider();
}

const contributedConversions = (
  scope: 'page' | 'edgeless',
  flags: BlockFlags
) => [...mounted(scope, flags).getAll(TextConversionEntryIdentifier).keys()];

const contributedSlashConfigs = (
  scope: 'page' | 'edgeless',
  flags: BlockFlags
) => [...mounted(scope, flags).getAll(SlashMenuConfigIdentifier).keys()];

describe('the callout "Turn into" entry follows the callout flag', () => {
  test.each(['page', 'edgeless'] as const)('offered when on (%s)', scope => {
    expect(contributedConversions(scope, {})).toContain('affine:callout');
  });

  test.each(['page', 'edgeless'] as const)('absent when off (%s)', scope => {
    expect(contributedConversions(scope, { callout: false })).not.toContain(
      'affine:callout'
    );
  });
});

describe('the callout slash-menu item follows the callout flag', () => {
  test.each(['page', 'edgeless'] as const)('offered when on (%s)', scope => {
    expect(contributedSlashConfigs(scope, {})).toContain('affine:callout');
  });

  test.each(['page', 'edgeless'] as const)('absent when off (%s)', scope => {
    expect(contributedSlashConfigs(scope, { callout: false })).not.toContain(
      'affine:callout'
    );
  });
});
