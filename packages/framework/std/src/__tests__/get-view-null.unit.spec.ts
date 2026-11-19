import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { literal } from 'lit/static-html.js';
import { describe, expect, expectTypeOf, test } from 'vitest';

import { BlockViewExtension } from '../extension/index.js';
import { BlockStdScope } from '../scope/std-scope.js';
import type { BlockViewType } from '../spec/type.js';
import { RootBlockSchemaExtension } from './test-schema.js';

/**
 * `BlockStdScope.getView(flavour)` answers `null`, as its type says, when no
 * view is registered for the flavour (#682).
 *
 * The method is typed `BlockViewType | null` but returned the DI's optional
 * read unconverted, and the DI answers `undefined` for a missing service. A
 * host that tested `!== null`, as the declared type invites, concluded that
 * every flavour had a view: the Labre shell's "no rendering regression with a
 * block flag off" check could never see a missing one. This spec would have
 * caught it: `toBeNull()` fails on `undefined`.
 *
 * The fix makes the value match the type, not the reverse: hosts compile
 * against `| null`, and a return type a host calls only widens in a minor
 * (CLAUDE.md, docs/lessons.md 33). The type-level assertion below fails the
 * build (`yarn build` typechecks tests) if a later change moves the
 * declaration to `| undefined` instead.
 */

function createStd() {
  const workspace = new TestWorkspace({
    id: 'get-view-null',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  const doc = workspace.createDoc('home');
  const store = doc.getStore({ extensions: [RootBlockSchemaExtension] });
  doc.load();
  return new BlockStdScope({
    store,
    extensions: [BlockViewExtension('test:page', literal`test-root-block`)],
  });
}

describe('BlockStdScope.getView', () => {
  test('answers null, not undefined, for a flavour with no view', () => {
    const std = createStd();
    const view = std.getView('test:unregistered');
    expect(view).toBeNull();
    expect(view !== null).toBe(false);
  });

  test('answers the registered view for a known flavour', () => {
    const std = createStd();
    const view = std.getView('test:page');
    expect(view).not.toBeNull();
    expect(view).toBeDefined();
  });

  test('keeps the declared return type BlockViewType | null', () => {
    expectTypeOf<
      ReturnType<BlockStdScope['getView']>
    >().toEqualTypeOf<BlockViewType | null>();
  });
});
