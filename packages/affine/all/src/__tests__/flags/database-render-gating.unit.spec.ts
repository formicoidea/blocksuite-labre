/**
 * A stored database renders whatever the `database` and `data-view` flags
 * say (ADR 0009, ADR 0035 §5, issue B4).
 *
 * Up to 0.48 `DatabaseViewExtension` carried the block view AND the slash
 * entries under `database`, and `DataViewViewExtension` the whole data-view
 * block under `data-view`: with `{ database: false }` every stored database
 * rendered as nothing (`lit-host` "Cannot find render flavour"), the "known
 * gap" of ADR 0009 closed so far for the callout only. The views are now split
 * the callout's way — `DatabaseRenderViewExtension` and
 * `DataViewRenderViewExtension` always on, `DatabaseViewExtension` (slash
 * entries, "+ view") and `DataViewViewExtension` gated — and this suite mounts
 * the real view extensions with both flags off and reads back what
 * `std.getView` and the block need. Re-gating a render half fails here; the
 * tooling half is pinned to follow the flag, so moving a creation entry into
 * the render half fails too.
 */
import { DatabaseViewCreationIdentifier } from '@labre/affine-database-block';
import { DatabaseViewExtension } from '@labre/affine-database-block/view';
import { ViewExtensionManager } from '@labre/affine-ext-loader';
import { SlashMenuConfigIdentifier } from '@labre/affine-widget-slash-menu';
import { StandaloneCellMetaProvider } from '@labre/affine-database-engine';
import { Container } from '@labre/global/di';
import { BlockFlavourIdentifier, BlockViewIdentifier } from '@labre/std';
import { literal } from 'lit/static-html.js';
import { describe, expect, test } from 'vitest';

import { getInternalViewExtensions } from '../../extensions/view.js';
import type { BlockFlags } from '../../flags.js';

const OFF: BlockFlags = { database: false, 'data-view': false };

function mounted(scope: 'page' | 'edgeless', flags: BlockFlags) {
  const manager = new ViewExtensionManager(getInternalViewExtensions(flags));
  const container = new Container();
  manager.get(scope).forEach(ext => ext.setup(container));
  return container.provider();
}

describe('a stored database renders with database and data-view off', () => {
  test.each(['page', 'edgeless'] as const)(
    'the database block view and flavour are registered (%s)',
    scope => {
      const provider = mounted(scope, OFF);
      // The tag `lit-host` stamps: the element `effects()` defines.
      expect(
        provider.getOptional(BlockViewIdentifier('affine:database'))
      ).toEqual(literal`affine-database`);
      expect(
        provider.getOptional(BlockFlavourIdentifier('affine:database'))
      ).toEqual({ flavour: 'affine:database' });
    }
  );

  test.each(['page', 'edgeless'] as const)(
    'the data-view block view and flavour are registered (%s)',
    scope => {
      const provider = mounted(scope, OFF);
      expect(
        provider.getOptional(BlockViewIdentifier('affine:data-view'))
      ).toEqual(literal`affine-data-view`);
      expect(
        provider.getOptional(BlockFlavourIdentifier('affine:data-view'))
      ).toEqual({ flavour: 'affine:data-view' });
    }
  );

  test.each(['page', 'edgeless'] as const)(
    'a stored link value keeps its cell in the title band (%s)',
    scope => {
      expect(
        mounted(scope, OFF).getOptional(StandaloneCellMetaProvider('link'))
      ).toBeTruthy();
    }
  );
});

describe('creating a database or a view follows the database flag', () => {
  const slash = (scope: 'page' | 'edgeless', flags: BlockFlags) =>
    mounted(scope, flags).getOptional(
      SlashMenuConfigIdentifier('affine:database')
    );
  const viewCreation = (scope: 'page' | 'edgeless', flags: BlockFlags) =>
    mounted(scope, flags).getOptional(DatabaseViewCreationIdentifier);

  test.each(['page', 'edgeless'] as const)('offered when on (%s)', scope => {
    expect(slash(scope, {})).toBeTruthy();
    expect(viewCreation(scope, {})).toBe(true);
  });

  test.each(['page', 'edgeless'] as const)('absent when off (%s)', scope => {
    // `getOptional` answers `undefined` for a missing binding.
    expect(slash(scope, OFF)).toBeUndefined();
    expect(viewCreation(scope, OFF)).toBeUndefined();
  });

  test('a host configuring the gated half still compiles and mounts', () => {
    const manager = new ViewExtensionManager(getInternalViewExtensions({}));
    manager.configure(DatabaseViewExtension, {
      configure: (_model, options) => options,
    });
    expect(() => manager.get('page')).not.toThrow();
  });
});
