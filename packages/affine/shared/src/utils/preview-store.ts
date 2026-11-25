import type { Doc, GetStoreOptions, Store } from '@labre/store';

/** A preview's hold on the store it renders; `release()` is idempotent. */
export type PreviewStoreHold = {
  readonly store: Store;
  release(): void;
};

/** How many live holds each preview store has. */
const holdCounts = new WeakMap<Store, number>();

/**
 * Hold the store `doc.getStore(options)` returns for a preview (a drag
 * image, a linked-doc card, a frame thumbnail, a surface-ref note), and
 * release it when the preview is gone (#746, ADR 0057, part 3).
 *
 * A query store is cached by its options, so previews asking for the same
 * ones share ONE store: every frame card of a document asks for the same
 * frame filter, two cards of one linked document ask for the same blocks.
 * Disposing of it when one preview goes would leave the others rendering a
 * dead store, and never disposing of it kept every preview store, with its
 * Yjs observers, for the workspace's life. So holds are counted, and the
 * last release disposes of the store, which also drops it from its
 * document's container.
 *
 * The disposal waits for the end of the current task: a preview moved in
 * the DOM (a list reordered) disconnects and reconnects synchronously, and
 * holds the same store again instead of rebuilding it.
 */
export function holdPreviewStore(
  doc: Doc,
  options: GetStoreOptions
): PreviewStoreHold {
  const store = doc.getStore(options);
  holdCounts.set(store, (holdCounts.get(store) ?? 0) + 1);
  let released = false;
  return {
    store,
    release: () => {
      if (released) return;
      released = true;
      const count = (holdCounts.get(store) ?? 1) - 1;
      holdCounts.set(store, count);
      if (count > 0) return;
      queueMicrotask(() => {
        if ((holdCounts.get(store) ?? 0) > 0) return;
        holdCounts.delete(store);
        try {
          store.dispose();
        } catch (error) {
          // Thrown on its own task, nobody would know which store failed: a
          // store extension threw in `disposed()`. Still reported, with that.
          throw new Error(
            `releasing the preview store of document "${doc.id}" failed: a store extension threw while it was disposed of`,
            { cause: error }
          );
        }
      });
    },
  };
}
