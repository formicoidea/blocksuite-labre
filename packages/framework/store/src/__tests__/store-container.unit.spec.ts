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

/**
 * What a component of another document follows instead of keeping a store
 * (#746, ADR 0057, amendment of 2026-11-25): a linked-doc card in document
 * A that kept B's default store kept it alive after B was closed, and was
 * deaf to B once the host released it. `doc.defaultStore` answers without
 * building one; `doc.defaultStoreChanged` tells when one is built and when it
 * goes.
 */
describe('the default store, followed from outside (ADR 0057)', () => {
  test('defaultStore never builds a store, and defaultStoreChanged reports its life', () => {
    const { workspace, doc } = openDoc();
    try {
      const events: Array<unknown> = [];
      doc.defaultStoreChanged.subscribe(store => events.push(store));
      expect(doc.defaultStore).toBeNull();

      const first = doc.getStore();
      expect(doc.getStore()).toBe(first);
      expect(doc.defaultStore).toBe(first);
      // Other stores of the document are not the default one.
      doc.getStore({ readonly: true });
      doc.getStore({ readonly: false });
      expect(events).toEqual([first]);

      first.dispose();
      expect(doc.defaultStore).toBeNull();
      expect(events).toEqual([first, null]);

      const second = doc.getStore();
      second.dispose();
      second.dispose(); // twice: reported once
      expect(events).toEqual([first, null, second, null]);
    } finally {
      workspace.dispose();
    }
  });

  test('removeStore of the default store reports it gone, once', () => {
    const { workspace, doc } = openDoc();
    try {
      const events: Array<unknown> = [];
      const store = doc.getStore();
      doc.defaultStoreChanged.subscribe(next => events.push(next));
      doc.removeStore({ id: doc.spaceDoc.guid });
      doc.removeStore({ id: doc.spaceDoc.guid });
      expect(events).toEqual([null]);
      expect(doc.defaultStore).toBeNull();
      // The removed store is not reported again when it is disposed later.
      store.dispose();
      expect(events).toEqual([null]);
    } finally {
      workspace.dispose();
    }
  });

  test('a subscriber opening the document again inside the null: every subscriber sees null, then the new store', () => {
    const { workspace, doc } = openDoc();
    try {
      const first = doc.getStore();
      let second: unknown = null;
      let whenNull: { released: boolean; evicted: boolean } | null = null;
      doc.defaultStoreChanged.subscribe(next => {
        if (next !== null || second) return;
        // What the null promises: the store is released and evicted.
        whenNull = {
          released: first.disposed,
          evicted: doc.defaultStore === null,
        };
        second = doc.getStore();
      });
      const seen: Array<unknown> = [];
      doc.defaultStoreChanged.subscribe(next => seen.push(next));

      first.dispose();

      expect(whenNull).toEqual({ released: true, evicted: true });
      expect(second).not.toBe(first);
      expect(seen).toEqual([null, second]);
      expect(doc.defaultStore).toBe(second);
    } finally {
      workspace.dispose();
    }
  });
});
