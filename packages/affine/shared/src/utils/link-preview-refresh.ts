import type { Store } from '@labre/store';

/**
 * Whether a bookmark or embed card must refetch its link preview after a props
 * change.
 *
 * `BlockModel.propsUpdated` carries the key only, so a subscriber cannot tell a
 * local edit from an update that arrived from another peer. A readonly peer
 * receives the change like everyone else; the author is the one who refetches
 * and syncs the result. Without this guard every reader of the document races
 * the author to rewrite the same title, description and image.
 */
export function shouldRefreshOnPropsUpdate(store: Store, key: string) {
  return key === 'url' && !store.readonly;
}
