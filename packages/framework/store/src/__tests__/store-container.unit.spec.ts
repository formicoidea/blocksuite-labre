/**
 * The key `getStore({ readonly: false })` is cached under (#746, ADR 0057,
 * part 2, guard 5).
 *
 * With neither a query nor an id, `readonly: false` fell into the branch that
 * mints a key with the workspace's id generator: every call built a new
 * store, observers included, that nothing could name again, and
 * `removeStore({ readonly: false })` returned without doing anything. 20 calls
 * kept 20 stores (`store-retention.spec.ts`). It is keyed like
 * `readonly: true` now, and stays a store distinct from the default one,
 * whose local `readonly` toggle must not reach it (`doc.unit.spec.ts`,
 * "local readonly").
 */
import { describe, expect, test } from 'vitest';

import { createAutoIncrementIdGenerator } from '../test/index.js';
import { TestWorkspace } from '../test/test-workspace.js';
import { RootBlockSchemaExtension } from './test-schema.js';

function openDoc() {
  const workspace = new TestWorkspace({
    id: 'store-container',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.storeExtensions = [RootBlockSchemaExtension];
  workspace.meta.initialize();
  return { workspace, doc: workspace.createDoc('doc') };
}

describe('getStore({ readonly: false }) is keyed (ADR 0057 guard 5)', () => {
  test('two calls return one store, distinct from the default and the readonly one', () => {
    const { workspace, doc } = openDoc();
    try {
      const writeable = doc.getStore({ readonly: false });
      expect(doc.getStore({ readonly: false })).toBe(writeable);
      expect(writeable).not.toBe(doc.getStore());
      expect(writeable).not.toBe(doc.getStore({ readonly: true }));
      expect(writeable.readonly).toBe(false);
    } finally {
      workspace.dispose();
    }
  });

  test('removeStore({ readonly: false }) forgets it, and so does its dispose()', () => {
    const { workspace, doc } = openDoc();
    try {
      const first = doc.getStore({ readonly: false });
      doc.removeStore({ readonly: false });
      const second = doc.getStore({ readonly: false });
      expect(second).not.toBe(first);

      second.dispose();
      const third = doc.getStore({ readonly: false });
      expect(third).not.toBe(second);
      expect(doc.getStore({ readonly: false })).toBe(third);
      third.dispose();
      first.dispose();
    } finally {
      workspace.dispose();
    }
  });

  test('an id still wins over readonly: false, as before', () => {
    const { workspace, doc } = openDoc();
    try {
      const byId = doc.getStore({ id: doc.spaceDoc.guid, readonly: false });
      expect(byId).toBe(doc.getStore());
      expect(byId).not.toBe(doc.getStore({ readonly: false }));
    } finally {
      workspace.dispose();
    }
  });

  test('the default store toggled readonly does not reach the readonly: false store', () => {
    const { workspace, doc } = openDoc();
    try {
      const store = doc.getStore();
      const writeable = doc.getStore({ readonly: false });
      store.readonly = true;
      expect(doc.getStore({ readonly: false }).readonly).toBe(false);
      expect(writeable.readonly).toBe(false);
    } finally {
      workspace.dispose();
    }
  });
});
