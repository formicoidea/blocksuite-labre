import { createIdentifier } from '@labre/global/di';
import type { BlockSnapshot, DeltaInsert, ExtensionType } from '@labre/store';
import type { ReadonlySignal } from '@preact/signals-core';

/** One source of a host database, as the picker lists it. */
export interface DataSourcePickerSource {
  /** What a view stores as its `sourceId` (ADR 0035 §8). */
  id: string;
  /** Display name, already localized by the host. */
  title: string;
}

/** One database the host offers a view of. */
export interface DataSourcePickerDatabase {
  /**
   * What a linked view stores as its block's `externalSourceId`: the value
   * the host's `DatabaseDataSourceProvider` reads back to build the view's
   * data source. Opaque to the library (the Labre app writes
   * `labre-base:<uuid>`, labre ADR-0046).
   */
  id: string;
  /** Display name, already localized by the host. */
  title: string;
  /** Its live sources, in the host's order; the first is the default. */
  sources: readonly DataSourcePickerSource[];
}

/** A property of a source as a view refers to it (an import's correspondence). */
export interface DataSourcePickerProperty {
  /** The property id the views store. */
  id: string;
  name: string;
  /** The property type (`title`, `select`, `number`…). */
  type: string;
  /** A select's options: a filter on it stores their ids. */
  options?: readonly { id: string; value: string }[];
}

/**
 * A view of another database, or a saved view template, to copy into this
 * database: never linked, the copy is a new view of this database.
 */
export interface DataSourcePickerImportedView {
  /** The stored view as read there (`props.views[i]`, or a template). */
  view: Readonly<Record<string, unknown>>;
  /** The properties of the source the view read there. */
  properties: readonly DataSourcePickerProperty[];
  /**
   * Source property id → property of this database, or `null` to ignore
   * it. An id left out is ignored. A filter or a sort on an ignored property
   * is removed, a column of it is dropped, a grouping by it is undone, a
   * colour rule reading it is removed whole (ADR 0036). `remapView` of the
   * database editor counts each, for a dialog to say what is lost.
   */
  mapping: Readonly<Record<string, string | null>>;
}

/** What `importView` hands the host: where the copy lands, and the verb. */
export interface DataSourcePickerImportRequest {
  /** The database the copy lands in, as `list()` names it. */
  databaseId: string;
  /** The source the copy reads (the current view's); absent, the implicit one. */
  sourceId?: string;
  /** The properties of that source, for the correspondence. */
  properties: readonly DataSourcePickerProperty[];
  /** The layouts this database can add (preset types). Any other is refused. */
  layouts: readonly string[];
  /**
   * Add the copy as a new view and show it; its id, or `null` when nothing
   * was added (the page turned read-only, a layout not offered). One undo
   * step.
   */
  add(view: DataSourcePickerImportedView): string | null;
}

/**
 * The current view as a template (labre PRD REQ-DB-4): its layout, where its
 * pages open, its properties shown and their order, its grouping, its
 * conditional colours (`colorRules`, ADR 0036). Never its filters, its
 * sorts or a manual order: those belong to one view.
 */
export interface DataSourcePickerViewTemplate {
  databaseId: string;
  sourceId?: string;
  /** The view's name, as shown. */
  name: string;
  view: Readonly<Record<string, unknown>>;
  properties: readonly DataSourcePickerProperty[];
}

/** One row of a table turned into a source (`createDatabaseFrom`). */
export interface DataSourcePickerRow {
  /**
   * The row's title as a rich-text delta: links, mentions (`reference`),
   * bold… Keep what your title property allows.
   */
  title: readonly DeltaInsert[];
  /**
   * Property id (of `DataSourcePickerContent.properties`) → the value as the
   * library stores it: a number, a boolean, a date's epoch milliseconds, a
   * select's option id (or ids), a rich text as a delta. A property left
   * out has no value.
   */
  values: Readonly<Record<string, unknown>>;
  /** The row's nested blocks, for its page body; empty when it has none. */
  body: readonly BlockSnapshot[];
}

/** What `createDatabaseFrom` turns into a database. */
export interface DataSourcePickerContent {
  /** The database's name: the table's title, or empty for you to name it. */
  title: string;
  /**
   * Its properties in order, the title first (type `title`). Their types are
   * the library's (`title`, `rich-text`, `number`, `select`,
   * `multi-select`, `checkbox`, `date`, `link`, `progress`…): map each to
   * one of yours, or drop it.
   */
  properties: readonly DataSourcePickerProperty[];
  /** The rows, in order. */
  rows: readonly DataSourcePickerRow[];
}

/**
 * A view of a host database, where it is stored (ADR 0035 amendment of
 * 2026-10-29, "a host decides what a deleted view takes with it").
 */
export interface DataSourcePickerViewRef {
  /** The block's `externalSourceId`, as `list()` names the database. */
  databaseId: string;
  /** The view's stored `sourceId`; absent, the host's implicit source. */
  sourceId?: string;
  viewId: string;
  /** The document (store id) and the `affine:database` block holding it. */
  docId: string;
  blockId: string;
}

/**
 * What a host locks on one of its sources (ADR 0035 amendment of
 * 2026-10-29, "a host may lock a source's properties and its new rows").
 * Both apply to every view, in every document, that reads the source; a
 * read-only document is read-only whatever they say.
 */
export interface DataSourcePickerSourcePolicy {
  /**
   * No property of the source is added, renamed, deleted, duplicated or
   * changed in type, from any menu, button or shortcut. What one view does
   * with a property (hide, order, width, filter, sort, group, colour rules)
   * and every cell value stay editable, select options included.
   */
  propertiesLocked: boolean;
  /**
   * No row is added to the source ("New" and its menu, every "+", the
   * keyboard's new row). Existing rows stay editable and deletable.
   */
  rowsLocked: boolean;
}

/** What `deleteView` hands the host: the view, and the verb that removes it. */
export interface DataSourcePickerViewDeletion extends DataSourcePickerViewRef {
  /** The view's name, as stored ('' when it has none). */
  viewName: string;
  /**
   * Remove the view from its block, as one undo step, and show the next
   * one. `false` when nothing was removed: the page turned read-only, the
   * view is already gone, or `remove` was already called.
   */
  remove(): boolean;
}

/**
 * The data-source picker (ADR 0035 §9c, issue B12): the host lists the
 * databases and sources a view may read, and creates them. The library draws
 * the picker (`@labre/affine-database-editor`), inserts the view and never
 * learns where a database lives.
 *
 * The identifier lives in core, not in the bundle §9c named: core's own
 * slash entries that create a database read `createDatabase` (§5), and a seam
 * identifier lives in the lowest package that reads it (§3).
 */
export interface DataSourcePickerService {
  /**
   * The databases on offer. MUST return synchronously and MUST NOT throw: the
   * signal may start empty and fill later, the picker redraws.
   */
  list(): ReadonlySignal<readonly DataSourcePickerDatabase[]>;
  /**
   * Create a database; it resolves to the new one, with at least one source,
   * or `null` when nothing was created (the user cancelled, the host
   * refused). Absent, nothing creates a database: this is the host's kill
   * switch, and the creating slash entries ("Table View", "Kanban View")
   * leave the menu.
   */
  createDatabase?(): Promise<DataSourcePickerDatabase | null>;
  /**
   * No native table beside your databases (ADR 0035 amendment of
   * 2026-10-29). The source decides, never the row count: a database block
   * with no source (`externalSourceId`) and no row, or whose source you no
   * longer resolve, draws an empty view with "Connect a source" (it
   * reopens the creation popover); one with no source but native rows shows
   * them read-only; a connected one with no row is an ordinary table.
   * Closing the popover writes nothing. Absent or `false`: as in 1.0.
   */
  requireSource?: boolean;
  /**
   * Create a database holding `content` and resolve to it, with at least one
   * source, or `null` when nothing was created (ADR 0035 amendment of
   * 2026-10-29, "turn into a source"). One call, so the rows land together
   * or not at all. With `requireSource`, "Create Table" on selected
   * paragraphs and "Move into a database" on a database with native rows
   * call it, then connect the block to the database's first source in one
   * undo step; an undo leaves your database in place. Absent, both are
   * hidden when a source is required.
   */
  createDatabaseFrom?(
    content: DataSourcePickerContent
  ): Promise<DataSourcePickerDatabase | null>;
  /**
   * With `createDatabaseFrom`: you keep a row's nested blocks as its page
   * body (`DataSourcePickerRow.body`). Absent, a conversion whose rows have
   * nested blocks is refused with a notice and writes nothing.
   */
  rowBodies?: boolean;
  /**
   * Create a source in `databaseId`; it resolves to the new source, or
   * `null`. Absent, the picker offers no "New source".
   */
  createSource?(databaseId: string): Promise<DataSourcePickerSource | null>;
  /**
   * Import a view of another database into `request.databaseId` (labre PRD
   * REQ-DB-2, ADR 0035 amendment of 2026-10-14): the host lets the reader
   * pick a view it may read and map its properties, then calls
   * `request.add`. Absent, "+ view" offers no import and the full page lists
   * no "Import a view".
   */
  importView?(request: DataSourcePickerImportRequest): void;
  /**
   * Keep the current view as a template, where the host keeps templates
   * (labre: the workspace's library, REQ-DB-15); a later `importView` may
   * offer it. Resolves `true` once saved. Absent, no "Save as template".
   */
  saveViewTemplate?(template: DataSourcePickerViewTemplate): Promise<boolean>;
  /**
   * A reader asked to delete a view of one of your databases (a block with
   * an `externalSourceId`, on a writable document): decide what goes with
   * it, ask what you must, then call `request.remove()`; not calling it
   * keeps the view. Called once per gesture ("Delete" in the view's tab
   * menu or its settings), never for a deleted block, an undo, a redo or a
   * remote change. Absent, the view is removed at once, as in 1.0.
   */
  deleteView?(request: DataSourcePickerViewDeletion): void;
  /**
   * An undo (`'undo'`: the view is back) or a redo (`'redo'`: it is gone
   * again) of a removal made by `request.remove()`, on this client. Never
   * for a remote change. Nothing to confirm: it already happened.
   */
  viewHistory?(view: DataSourcePickerViewRef, step: 'undo' | 'redo'): void;
  /**
   * What you lock on source `sourceId` of database `databaseId` (the
   * view's stored `sourceId`; absent, your implicit source), as a signal:
   * flip it and every open view of that source follows, without a reload.
   * Read when a view of one of your databases (a block with an
   * `externalSourceId`) is drawn or switches source. MUST return
   * synchronously and MUST NOT throw; a throw reads as nothing locked.
   * Absent, nothing is locked, as in 1.1 (ADR 0035 amendment of
   * 2026-10-29).
   */
  sourcePolicy?(
    databaseId: string,
    sourceId: string | undefined
  ): ReadonlySignal<DataSourcePickerSourcePolicy>;
}

export const DataSourcePickerProvider =
  createIdentifier<DataSourcePickerService>('LabreDataSourcePicker');

/**
 * Host seam: the host's databases and sources, or `null` to say it has none.
 *
 * Absent or `null`: no "Linked view of a database" entry, "+ view" offers
 * only the sources the block already shows, and the slash entries create a
 * native inline database as in 0.48. With a service but no `createDatabase`,
 * no entry creates a database at all.
 *
 * `di.override`, so a later registration wins and registering twice never
 * throws at boot.
 */
export function DataSourcePickerExtension(
  service: DataSourcePickerService | null
): ExtensionType {
  return {
    setup: di => {
      // `null` rides through on purpose: `getOptional` then reports no
      // picker, which is the whole "0.48 entries" story.
      di.override(
        DataSourcePickerProvider,
        () => service as DataSourcePickerService
      );
    },
  };
}
