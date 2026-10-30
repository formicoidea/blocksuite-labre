/**
 * A stored view's `databaseId` (ADR 0035 amendment of 2026-10-30): the
 * database its source belongs to when it is not the block's own. `undefined`
 * reads the block's database (`externalSourceId`), the reading of every view
 * stored before 2.4. A module of its own so the data source, the deletion
 * request and the properties panel's request share it without a cycle.
 */
export function viewDatabaseId(view: object | undefined): string | undefined {
  const databaseId = (view as { databaseId?: unknown } | undefined)?.databaseId;
  return typeof databaseId === 'string' && databaseId !== ''
    ? databaseId
    : undefined;
}
