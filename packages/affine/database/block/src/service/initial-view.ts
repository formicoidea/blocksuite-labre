import { createIdentifier } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';

/**
 * Which `affine:database` block asks for the view it opens on. Only widens:
 * a new field is optional.
 */
export interface DatabaseInitialViewRequest {
  blockId: string;
}

/**
 * The view a database opens on, chosen by the host (labre: a base's page
 * opened from one of its views in the sidebar, `/base/:id?view=…`). Asked
 * once, when the block builds its data source. An id the block does not
 * have, or `undefined`, falls back to the view this tab last showed for the
 * block (`currentViewStorage`), then to the first view.
 *
 * Nothing is written: the current view is a local signal of the view
 * manager, never a stored prop, so opening on a view leaves the document
 * untouched.
 */
export interface DatabaseInitialViewService {
  initialView(request: DatabaseInitialViewRequest): string | undefined;
}

export const DatabaseInitialViewProvider =
  createIdentifier<DatabaseInitialViewService>('LabreDatabaseInitialView');

/**
 * Host seam: the view a database opens on.
 *
 * Absent or `null`, a database opens on the view this tab last showed for
 * it, else its first view, as in 0.59.
 *
 * `di.override`, so a later registration wins and registering twice never
 * throws at boot.
 */
export function DatabaseInitialViewExtension(
  service: DatabaseInitialViewService | null
): ExtensionType {
  return {
    setup: di => {
      // `null` rides through on purpose: `getOptional` then reports no host
      // choice and the block keeps its own.
      di.override(
        DatabaseInitialViewProvider,
        () => service as DatabaseInitialViewService
      );
    },
  };
}
