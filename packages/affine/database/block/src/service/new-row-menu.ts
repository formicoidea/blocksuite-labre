import { createIdentifier } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';

/**
 * What a database asks the host to open beside its "New" button (ADR 0035
 * amendment of 2026-10-14, labre PRD REQ-DB-6, 14 and 15):
 *
 * - `anchor`: the chevron the menu hangs from;
 * - `blockId`: the `affine:database` block that hosts the view, so the host
 *   can tell a base's own page from an inline view of it;
 * - `viewId`: the view the gesture came from.
 *
 * Only widens: a new field is optional.
 */
export interface DatabaseNewRowMenuRequest {
  anchor: HTMLElement;
  blockId: string;
  viewId: string;
}

/**
 * The host's menu of ways to add a row (its templates, a default to pick):
 * the library draws the chevron and asks, the host draws the menu and does
 * the work. The main part of "New" never reaches it: it adds a row through
 * the source's `rowAdd`, as without the seam, which is where a host applies
 * its default template.
 */
export interface DatabaseNewRowMenuService {
  open(request: DatabaseNewRowMenuRequest): void;
  /**
   * Whether this block and view have a menu to open (a base's own page
   * does, an inline table of it may not). Asked each time "New" renders, so
   * the answer may change; answer from what you already hold, it runs on
   * every render. Absent, every view has one, as in the first release of
   * the seam. `false` draws the single "New" of 0.48.
   */
  canOpen?(request: DatabaseNewRowMenuTarget): boolean;
}

/** Which "New" asks: the request without its anchor, not drawn yet. */
export type DatabaseNewRowMenuTarget = Omit<
  DatabaseNewRowMenuRequest,
  'anchor'
>;

export const DatabaseNewRowMenuProvider =
  createIdentifier<DatabaseNewRowMenuService>('LabreDatabaseNewRowMenu');

/**
 * Host seam: the host opens a menu beside every view's "New", or `null` to
 * say it does not.
 *
 * Absent or `null`, "New" is the single button of 0.48 in every view (table,
 * kanban, gallery, list) and on the full page: no chevron.
 *
 * `di.override`, so a later registration wins and registering twice never
 * throws at boot.
 */
export function DatabaseNewRowMenuExtension(
  service: DatabaseNewRowMenuService | null
): ExtensionType {
  return {
    setup: di => {
      // `null` rides through on purpose: `getOptional` then reports no menu
      // and "New" draws no chevron.
      di.override(
        DatabaseNewRowMenuProvider,
        () => service as DatabaseNewRowMenuService
      );
    },
  };
}
