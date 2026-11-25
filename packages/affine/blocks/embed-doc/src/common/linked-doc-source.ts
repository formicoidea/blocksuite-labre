import {
  type DetachStore,
  followDefaultStore,
  holdPreviewStore,
  type PreviewStoreHold,
} from '@labre/affine-shared/utils';
import type { Doc, GetStoreOptions, Store } from '@labre/store';

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
 */
export class LinkedDocSource {
  private _hold: PreviewStoreHold | null = null;

  private _closed = false;

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
    return this._hold.store;
  }

  /**
   * Follow the default store: `attach` runs on each one the document gets,
   * `reopened` for one replacing a released one. The card's own store is let
   * go while a default store is open. Answers the stop.
   */
  follow(
    attach: (store: Store, reopened: boolean) => DetachStore | void
  ): () => void {
    return followDefaultStore(this.doc, (store, reopened) => {
      this._closed = false;
      this._releaseHold();
      const detach = attach(store, reopened);
      return () => {
        detach?.();
        this._closed = true;
      };
    });
  }

  release() {
    this._releaseHold();
  }

  private _releaseHold() {
    this._hold?.release();
    this._hold = null;
  }
}
