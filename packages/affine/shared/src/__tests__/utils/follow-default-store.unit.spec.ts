/**
 * Following another document's default store, and resolving its title,
 * without keeping or building that store (#746, ADR 0057, amendment of
 * 2026-11-25).
 *
 * A host closes a document with `store.dispose()`. Components of OTHER
 * documents that read it used to subscribe once to its default store, and
 * so kept a released store alive and went deaf (a linked-doc card, the
 * data-view source), or built that store just to key a cache, and built it
 * again after the release (`DocDisplayMetaService`, for every linked title
 * and icon it resolved).
 */
import { DocModeProvider } from '@labre/affine-shared/services';
import type { Store } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';

import { DocDisplayMetaService } from '../../services/doc-display-meta-service.js';
import { followDefaultStore } from '../../utils/follow-default-store.js';

function openWorkspace() {
  const workspace = new TestWorkspace({
    id: 'follow-default-store',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  return workspace;
}

describe('followDefaultStore (ADR 0057)', () => {
  test('attaches to the open store, lets it go when released, attaches again on reopen', () => {
    const workspace = openWorkspace();
    try {
      const doc = workspace.createDoc('b');
      const first = doc.getStore();
      const attached: Array<[Store, boolean]> = [];
      const detached: Store[] = [];
      const stop = followDefaultStore(doc, (store, reopened) => {
        attached.push([store, reopened]);
        return () => detached.push(store);
      });
      expect(attached).toEqual([[first, false]]);

      first.dispose();
      expect(detached).toEqual([first]);
      // Nothing was built to replace it.
      expect(doc.defaultStore).toBeNull();

      const second = doc.getStore();
      expect(attached).toEqual([
        [first, false],
        [second, true],
      ]);

      stop();
      expect(detached).toEqual([first, second]);
      second.dispose();
      expect(detached).toEqual([first, second]);
    } finally {
      workspace.dispose();
    }
  });

  test('a document with no store open: nothing is built, attach waits for one', () => {
    const workspace = openWorkspace();
    try {
      const doc = workspace.createDoc('b');
      const attach = vi.fn();
      const stop = followDefaultStore(doc, attach);
      expect(attach).not.toHaveBeenCalled();
      expect(doc.defaultStore).toBeNull();
      const store = doc.getStore();
      expect(attach).toHaveBeenCalledWith(store, false);
      stop();
    } finally {
      workspace.dispose();
    }
  });
});

describe('DocDisplayMetaService never builds a linked store (ADR 0057)', () => {
  test("a linked document's title and icon are resolved without opening it", () => {
    const workspace = openWorkspace();
    try {
      const doc = workspace.createDoc('linked');
      workspace.meta.setDocMeta('linked', { title: 'Linked' });
      const std = {
        workspace,
        get: (id: unknown) =>
          id === DocModeProvider
            ? {
                getPrimaryMode: () => 'page',
                onPrimaryModeChange: () => () => {},
              }
            : null,
        getOptional: () => null,
      };
      const service = new DocDisplayMetaService(std as never);

      expect(service.title('linked').value).toBe('Linked');
      expect(service.icon('linked').value).toBeTruthy();
      expect(doc.defaultStore).toBeNull();

      workspace.meta.setDocMeta('linked', { title: 'Renamed' });
      expect(service.title('linked').value).toBe('Renamed');
      expect(doc.defaultStore).toBeNull();
      service.dispose();
    } finally {
      workspace.dispose();
    }
  });
});
