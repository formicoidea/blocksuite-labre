import type { Doc, Store } from '@labre/store';

/**
 * Whether the host has moved this doc to its trash.
 *
 * A trashed doc is still in the workspace and still loads, so a card pointing
 * at it has to ask: cards render a trashed doc as deleted, the same way they
 * render a doc that has left the workspace altogether. Asked of the `Doc`
 * itself where no store is open (#746, ADR 0057): its meta is the same.
 */
export function isDocTrashed(doc: Doc | Store | null | undefined): boolean {
  return !!doc?.meta?.trash;
}
