import { createIdentifier } from '@labre/global/di';
import type { EditorHost } from '@labre/std';
import { type ExtensionType, type Store } from '@labre/store';

/**
 * Creates the new doc that the linked-doc features populate (the edgeless
 * "Create linked doc" / "Turn into linked doc" actions). By default this is a
 * fresh in-workspace doc; a host app can override it to ALSO persist or register
 * the doc (assign a stored id, create a metadata row, attach sync) before the
 * editor writes blocks into the returned store.
 *
 * The returned `Store` must be ready for `addBlock`. `title` is forwarded so the
 * host can record it; the caller still writes the page block's own title.
 */
export interface LinkedDocCreationProvider {
  createLinkedDoc(host: EditorHost, title?: string): Store;
}

export const LinkedDocCreationProvider =
  createIdentifier<LinkedDocCreationProvider>('AffineLinkedDocCreationProvider');

/**
 * Override how linked docs are created — e.g. to route creation through a host
 * app's persistence layer instead of an ephemeral in-workspace doc.
 */
export function LinkedDocCreationExtension(
  provider: LinkedDocCreationProvider
): ExtensionType {
  return {
    setup: di => {
      di.override(LinkedDocCreationProvider, () => provider);
    },
  };
}
