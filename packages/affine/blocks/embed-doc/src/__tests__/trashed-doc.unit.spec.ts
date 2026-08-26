import { describe, expect, it } from 'vitest';

import { isDocTrashed } from '../common/doc-trashed.js';
import { EmbedSyncedDocBlockComponent } from '../embed-synced-doc-block/embed-synced-doc-block.js';

/**
 * A doc the host has moved to its trash, upstream #13767.
 *
 * The doc is still in the workspace — `getDoc` returns it and it loads — so
 * cards pointing at it used to render as if nothing had happened. A reference
 * to a trashed doc now reads as deleted, like a reference to a doc that has
 * left the workspace altogether.
 */

type Doc = Parameters<typeof isDocTrashed>[0];

const asDoc = (doc: object) => doc as unknown as Doc;

const liveDoc = { meta: { trash: false }, loaded: true, root: {} };
const trashedDoc = { meta: { trash: true }, loaded: true, root: {} };

/** `_load` reads only these members off the instance. */
function stubComponent(syncedDoc: unknown) {
  return {
    _loading: false,
    _error: false,
    _deleted: false,
    _cycle: false,
    _checkCycle: () => {},
    syncedDoc,
  };
}

async function load(instance: unknown) {
  await (
    EmbedSyncedDocBlockComponent.prototype as unknown as {
      _load: () => Promise<void>;
    }
  )._load.call(instance as never);
}

describe('isDocTrashed', () => {
  it('reports a doc the host has trashed', () => {
    expect(isDocTrashed(asDoc(trashedDoc))).toBe(true);
  });

  it('leaves a live doc alone', () => {
    expect(isDocTrashed(asDoc(liveDoc))).toBe(false);
    expect(isDocTrashed(asDoc({ meta: undefined }))).toBe(false);
  });

  it('says nothing about a doc that is not in the workspace', () => {
    expect(isDocTrashed(null)).toBe(false);
    expect(isDocTrashed(undefined)).toBe(false);
  });
});

describe('embed synced doc loading', () => {
  it('marks a missing doc as deleted', async () => {
    const instance = stubComponent(null);

    await load(instance);

    expect(instance._deleted).toBe(true);
    expect(instance._loading).toBe(false);
  });

  it('marks a trashed doc as deleted instead of syncing it', async () => {
    const instance = stubComponent(trashedDoc);

    await load(instance);

    expect(instance._deleted).toBe(true);
    expect(instance._loading).toBe(false);
  });

  it('syncs a live doc', async () => {
    const instance = stubComponent(liveDoc);

    await load(instance);

    expect(instance._deleted).toBe(false);
    expect(instance._loading).toBe(false);
  });
});
