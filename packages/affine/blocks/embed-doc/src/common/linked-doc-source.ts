import {
  followDefaultStore,
  holdPreviewStore,
  type PreviewStoreHold,
} from '@labre/affine-shared/utils';
import type { Doc, GetStoreOptions, Store } from '@labre/store';
import type { Subscription } from 'rxjs';

import { isDocTrashed } from './doc-trashed.js';

/**
 * The card's own store of a document nobody has open: readonly, and under a
 * query no other reader asks for unheld, so the last hold disposes of it
 * without pulling it from under anyone. `loose` with no match shows every
 * block.
 */
const OWN_STORE: GetStoreOptions = {
  readonly: true,
  query: { mode: 'loose', match: [] },
};

/** What a store's `blockUpdated` sends. */
export type BlockUpdate = Parameters<Store['slots']['blockUpdated']['next']>[0];

/**
 * Where a linked-doc card reads the document it points at (#746, ADR 0057,
 * amendment of 2026-11-25). That document's default store is its host's to
 * open and close, so the card never builds it:
 *
 * - existence, title and trash come from the workspace's `Doc` and its meta,
 *   never from a store;
 * - content comes from the default store while one is open;
 * - otherwise, the first time the card must load content, from a counted
 *   preview store of its own (`holdPreviewStore`), released with the card:
 *   a card on screen for a document nobody has open still shows it (on the
 *   base it built the default store, which then stayed);
 * - once the default store it read is released, from nothing until a store
 *   comes back: the card shows its title and a degraded body, and building a
 *   store of its own then would only work around the host's close.
 *
 * Whichever store it reads, the card hears its changes: `blockUpdated` is
 * listened to on that one store, and the listening moves with it (its own
 * store, then the default one when the host opens the document, then none).
 */
export class LinkedDocSource {
  private _hold: PreviewStoreHold | null = null;

  private _closed = false;

  private _onBlockUpdated: ((update: BlockUpdate) => void) | null = null;

  private _heard: { store: Store; subscription: Subscription } | null = null;

  constructor(readonly doc: Doc) {}

  get title() {
    return this.doc.meta?.title;
  }

  get trashed() {
    return isDocTrashed(this.doc);
  }

  /** The store content is read from now, if any; builds nothing. */
  get store(): Store | null {
    return this.doc.defaultStore ?? this._hold?.store ?? null;
  }

  /** The store to load content from, built only as the class says. */
  contentStore(): Store | null {
    const store = this.store;
    if (store || this._closed) return store;
    this._hold = holdPreviewStore(this.doc, OWN_STORE);
    this._hear(this._hold.store);
    return this._hold.store;
  }

  /**
   * Hear the changes of the store read now (`onBlockUpdated`), and follow
   * the default store: `onOpened` runs on each one the document gets,
   * `reopened` for one replacing a released one; `onClosed` when its host
   * releases it (not when the follow stops). The card's own store is let go
   * while a default store is open. Answers the stop.
   */
  follow(
    onBlockUpdated: (update: BlockUpdate) => void,
    onOpened?: (store: Store, reopened: boolean) => void,
    onClosed?: () => void
  ): () => void {
    this._onBlockUpdated = onBlockUpdated;
    let stopping = false;
    const stop = followDefaultStore(this.doc, (store, reopened) => {
      this._closed = false;
      this._releaseHold();
      this._hear(store);
      onOpened?.(store, reopened);
      return () => {
        if (this._heard?.store === store) this._hear(null);
        this._closed = true;
        if (!stopping) onClosed?.();
      };
    });
    this._hear(this.store);
    return () => {
      stopping = true;
      stop();
      this._hear(null);
      this._onBlockUpdated = null;
    };
  }

  release() {
    this._releaseHold();
  }

  /** Listen to `store`'s changes, and to no other store's. */
  private _hear(store: Store | null) {
    if (this._heard?.store === store) return;
    this._heard?.subscription.unsubscribe();
    this._heard = null;
    const onBlockUpdated = this._onBlockUpdated;
    if (!store || !onBlockUpdated) return;
    this._heard = {
      store,
      subscription: store.slots.blockUpdated.subscribe(onBlockUpdated),
    };
  }

  private _releaseHold() {
    const hold = this._hold;
    if (!hold) return;
    if (this._heard?.store === hold.store) this._hear(null);
    hold.release();
    this._hold = null;
  }
}
