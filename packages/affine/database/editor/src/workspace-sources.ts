import type {
  DataSourcePickerDatabase,
  DataSourcePickerService,
} from '@labre/affine-shared/services';
import { DoneIcon } from '@blocksuite/icons/lit';
import { html, type TemplateResult } from 'lit';

/**
 * One source list for the whole workspace (ADR 0035 amendment of
 * 2026-10-30, labre « Base de données v3 »): under a host with
 * `crossDatabaseViews`, a view's settings › "Source" and "+ view" list the
 * sources of every database the picker lists, not only the block's. Pure,
 * so the order is held by a unit spec without a DOM.
 *
 * - The block's own database first, in the host's order (as in 2.3), then
 *   the other databases' sources by name (accents and case folded, numbers
 *   in numeric order), a tie by database title then by id, so the order
 *   never depends on the host's list of databases.
 * - A source of another database carries its database (`databaseId`,
 *   `databaseTitle`): the entry labels it, a pick stores it on the view.
 * - Without `crossDatabaseViews` only the block's database is listed: the
 *   2.3 list, whatever the picker returns.
 */
export interface WorkspaceSource {
  /** What a view stores as its `sourceId`. */
  sourceId: string;
  title: string;
  /** Set for a source of ANOTHER database than the block's; absent, the block's. */
  databaseId?: string;
  /** That database's title, for the entry's label. */
  databaseTitle?: string;
}

/** Whether the host lets a view read a source of another database. */
export function crossDatabaseViews(
  picker: Pick<DataSourcePickerService, 'crossDatabaseViews'> | null | undefined
): boolean {
  return picker?.crossDatabaseViews === true;
}

const collator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
});

export function workspaceSources(
  databases: readonly DataSourcePickerDatabase[],
  homeDatabaseId: string | undefined,
  acrossDatabases: boolean
): WorkspaceSource[] {
  const home = databases.find(database => database.id === homeDatabaseId);
  const own: WorkspaceSource[] = (home?.sources ?? []).map(source => ({
    sourceId: source.id,
    title: source.title,
  }));
  if (!acrossDatabases) return own;
  const others: WorkspaceSource[] = databases
    .filter(database => database.id !== homeDatabaseId)
    .flatMap(database =>
      database.sources.map(source => ({
        sourceId: source.id,
        title: source.title,
        databaseId: database.id,
        databaseTitle: database.title,
      }))
    );
  others.sort(
    (a, b) =>
      collator.compare(a.title, b.title) ||
      collator.compare(a.databaseTitle ?? '', b.databaseTitle ?? '') ||
      (a.databaseId ?? '').localeCompare(b.databaseId ?? '') ||
      a.sourceId.localeCompare(b.sourceId)
  );
  return [...own, ...others];
}

/**
 * A source's database as a trailing argument, only when it is another one:
 * a call about the block's own database is made exactly as in 2.3.
 */
export const inDatabase = (databaseId: string | undefined): [] | [string] =>
  databaseId === undefined ? [] : [databaseId];

/**
 * Whether `source` is the one a view reads, by database AND source: the same
 * `sourceId` in another database is another source. `viewDatabaseId`
 * absent is the block's database, as `source.databaseId` absent is.
 */
export function isViewSource(
  source: WorkspaceSource,
  viewSourceId: string | undefined,
  viewDatabaseId: string | undefined
): boolean {
  return (
    source.sourceId === viewSourceId && source.databaseId === viewDatabaseId
  );
}

/**
 * The postfix of a source of another database: its database's title, grey,
 * on the right (and the check of the current source after it, since a
 * postfix replaces the menu's own check). `undefined` for the block's own
 * sources, so their entries stay the 2.3 ones.
 */
export function databaseLabel(
  source: WorkspaceSource,
  untitled: string,
  selected = false
): TemplateResult | undefined {
  if (source.databaseId === undefined) return undefined;
  return html`<span
      data-testid="source-database-label"
      style="margin-left: auto; padding-left: 8px; font-size: 12px; color: var(--affine-text-secondary-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;"
      >${source.databaseTitle || untitled}</span
    >${selected ? DoneIcon() : undefined}`;
}
