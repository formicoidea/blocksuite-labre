/**
 * The two providers of `@labre/affine-database-editor` (ADR 0035 §4) set up in
 * every view scope.
 *
 * They are registered by the umbrella from the day the package exists, before
 * any chrome lives in them (B14 ships the package and the bundle; B10 to B13
 * fill it), so a host aliasing `@formicoidea/labre-core-database` can wire
 * both now and keep its wiring when they gain content. This pins that wiring
 * contract: two distinct view providers, each setting up alone in every
 * scope a host builds. (`ViewExtensionManager.get` throws on a scope where
 * nothing is registered, which is all these two do today, so the spec calls
 * `setup` itself.) That the umbrella registers them, and under which flag, is
 * held by `core-database-boundary.unit.spec.ts` in `packages/affine/all`.
 */
import {
  ViewExtensionProvider,
  type ViewScope,
} from '@labre/affine-ext-loader';
import { describe, expect, test } from 'vitest';

import {
  DatabaseEditorToolingViewExtension,
  DatabaseEditorViewExtension,
} from '../view.js';

const SCOPES: ViewScope[] = [
  'page',
  'edgeless',
  'preview-page',
  'preview-edgeless',
  'mobile-page',
  'mobile-edgeless',
];

describe('database-editor view extensions', () => {
  test.each(SCOPES)('each sets up alone in the %s scope', scope => {
    for (const Provider of [
      DatabaseEditorViewExtension,
      DatabaseEditorToolingViewExtension,
    ]) {
      const provider = new Provider();
      expect(provider).toBeInstanceOf(ViewExtensionProvider);
      const context = { scope, register: () => context };
      expect(() => provider.setup(context)).not.toThrow();
    }
  });

  test('the always-on and the tooling provider are two providers', () => {
    expect(new DatabaseEditorViewExtension().name).not.toBe(
      new DatabaseEditorToolingViewExtension().name
    );
  });
});
