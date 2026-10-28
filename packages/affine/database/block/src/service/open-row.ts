import {
  DATABASE_VIEW_OPEN_IN,
  type DatabaseViewOpenIn,
} from '@labre/affine-model';
import { createIdentifier } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';

/**
 * What a database asks the host to open (ADR 0035 §9a, issue B9).
 *
 * - `docId`: the row, which is a document: the seam is only read when the
 *   source says its rows are documents (`rowsAreDocuments`), and such a
 *   source's row id IS the document id.
 * - `mode`: the view's stored `openIn`, `side` when absent (ADR 0035 §8);
 *   a Ctrl/Cmd click sends `full`.
 * - `newTab`: `true` for a Ctrl/Cmd click, which also sends `full`.
 * - `viewId` and `blockId`: the view the row was opened from and the
 *   `affine:database` block that hosts it, so the host can tell a base's
 *   own page from an inline view of it.
 *
 * Only widens: a new field is optional.
 */
export interface DatabaseOpenRowRequest {
  docId: string;
  mode: DatabaseViewOpenIn;
  newTab: boolean;
  viewId: string;
  blockId: string;
}

/**
 * The host's way of opening a database row that is a document (ADR 0035
 * §9a): a side preview, a centred window or the full page, as the view's
 * "Open pages in" says. The library keeps no "is it open" state and draws
 * nothing for the row itself: the host routes, the library asks.
 */
export interface DatabaseOpenRowService {
  open(request: DatabaseOpenRowRequest): void;
}

export const DatabaseOpenRowProvider = createIdentifier<DatabaseOpenRowService>(
  'LabreDatabaseOpenRow'
);

/**
 * Host seam: the host opens database rows, or `null` to say it does not.
 *
 * Absent or `null`, a row opens through the peek view (or the side detail
 * without one), exactly as in 0.48, and the view's `openIn` has no effect. A
 * row that is a block (an inline database) always takes that path: there is
 * no document to open.
 *
 * `di.override`, so a later registration wins and registering twice never
 * throws at boot.
 */
export function DatabaseOpenRowExtension(
  service: DatabaseOpenRowService | null
): ExtensionType {
  return {
    setup: di => {
      // `null` rides through on purpose: `getOptional` then reports no
      // opener and the row keeps the library's own detail panel.
      di.override(
        DatabaseOpenRowProvider,
        () => service as DatabaseOpenRowService
      );
    },
  };
}

/**
 * The request for one row-open gesture, or `null` when the host does not
 * open this row (no opener, or rows that are blocks): the one rule every
 * view goes through, since every preset opens a row with
 * `DataViewRootUILogic.openDetailPanel`, which lands in the database block.
 */
export function databaseOpenRowRequest(input: {
  hasOpener: boolean;
  rowsAreDocuments: boolean;
  rowId: string;
  viewId: string;
  blockId: string;
  /** The view's stored `openIn`, read as stored: unknown values too. */
  openIn: unknown;
  newTab?: boolean;
}): DatabaseOpenRowRequest | null {
  if (!input.hasOpener || !input.rowsAreDocuments) return null;
  const newTab = input.newTab === true;
  return {
    docId: input.rowId,
    mode: newTab ? 'full' : openInOf(input.openIn),
    newTab,
    viewId: input.viewId,
    blockId: input.blockId,
  };
}

/**
 * `DatabaseRowOpened` for one row-open gesture (telemetry README,
 * "Databases"): the mode the row opens in, the host's when it opens it,
 * `side` for the library's own peek or detail; ids only, never the row.
 */
export function rowOpenedParams(
  request: DatabaseOpenRowRequest | null,
  rowsAreDocuments: boolean,
  newTab: boolean | undefined
): {
  mode: DatabaseViewOpenIn;
  newTab: boolean;
  rowKind: 'document' | 'block';
} {
  return {
    mode: request?.mode ?? 'side',
    newTab: newTab === true,
    rowKind: rowsAreDocuments ? 'document' : 'block',
  };
}

/**
 * A stored `openIn` as this client reads it: absent, or a value appended by a
 * later client, reads `side` (append-only, ADR 0035 §8).
 */
export function openInOf(stored: unknown): DatabaseViewOpenIn {
  return (DATABASE_VIEW_OPEN_IN as readonly unknown[]).includes(stored)
    ? (stored as DatabaseViewOpenIn)
    : 'side';
}
