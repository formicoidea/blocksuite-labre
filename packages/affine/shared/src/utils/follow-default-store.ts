import type { Doc, Store } from '@labre/store';

/** What `attach` answers: how to undo what it did on that store. */
export type DetachStore = () => void;

/**
 * Follow the default store of ANOTHER document (#746, ADR 0057, amendment
 * of 2026-11-25): `attach` runs on the store open now, if any, and again on
 * each store the document gets later; what it answers runs when that store
 * is released or removed.
 *
 * A component of document A that subscribed once to B's default store (a
 * linked-doc card listening to `blockUpdated`) kept that store alive after B
 * was closed, and went deaf when the host released it: the slots completed
 * and nothing subscribed again. This never builds B's store, never keeps a
 * released one (the store is collectable as soon as it is released), and
 * attaches again when B is opened again. `reopened` is `true` for a store
 * that replaces a released one, so the caller can refresh what it drew from
 * the previous one.
 *
 * Returns the function that stops following; call it with the component's
 * teardown.
 */
export function followDefaultStore(
  doc: Doc,
  attach: (store: Store, reopened: boolean) => DetachStore | void
): () => void {
  let detach: DetachStore | void;
  let attached = false;
  const follow = (store: Store | null) => {
    detach?.();
    detach = undefined;
    if (!store) return;
    detach = attach(store, attached);
    attached = true;
  };
  follow(doc.defaultStore);
  const subscription = doc.defaultStoreChanged.subscribe(follow);
  return () => {
    subscription.unsubscribe();
    detach?.();
    detach = undefined;
  };
}

/**
 * A store to READ another document from, never its default store built anew
 * (#746, ADR 0057): the default store while its host has it open, else the
 * document's readonly store. For one-shot readers (an export walking a synced
 * document, an import asking whether a linked document exists), whose
 * `docCRUD.get` built the default store, which then stayed after its host had
 * closed the document. The readonly store stays too: one per document read,
 * the same retention as a synced-doc card's.
 */
export function storeToRead(doc: Doc | null | undefined): Store | null {
  if (!doc) return null;
  return doc.defaultStore ?? doc.getStore({ readonly: true });
}
