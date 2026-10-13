import { createIdentifier } from '@labre/global/di';
import type { EditorHost } from '@labre/std';
import { type ExtensionType, type Store } from '@labre/store';

/**
 * Creates the new doc that the linked-doc features populate (the edgeless
 * "Create linked doc" / "Turn into linked doc" actions, and the slash menu's
 * "New Doc" since 0.48, which leaves a linked-doc card where it was typed). By
 * default this is a fresh in-workspace doc; a host app can override it to ALSO
 * persist or register the doc (assign a stored id, create a metadata row,
 * attach sync) before the editor writes blocks into the returned store.
 *
 * The returned `Store` is left UNLOADED: the caller writes its blocks in
 * `store.load(initFn)`, and a doc that is already loaded skips `initFn`.
 * `title` is forwarded so the host can record it; the caller still writes the
 * page block's own title.
 */
export interface LinkedDocCreationProvider {
  createLinkedDoc(host: EditorHost, title?: string): Store;
  /**
   * Whether a doc may be created from this editor at all (a host may refuse
   * it on a doc shared with a guest, for instance). Read by the slash menu's
   * "New Doc", which hides itself on `false`. Absent means allowed (since 0.48).
   */
  canCreateLinkedDoc?(host: EditorHost): boolean;
}

export const LinkedDocCreationProvider =
  createIdentifier<LinkedDocCreationProvider>(
    'AffineLinkedDocCreationProvider'
  );

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
