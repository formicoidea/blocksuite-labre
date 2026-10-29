import { createIdentifier } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';
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
   * 2026-10-29): a database block with no source (`externalSourceId`) and no
   * row draws an empty view instead of the native one (no row, no "New",
   * no view bar, nothing typed or pasted into it) with a "Connect a source"
   * button that reopens the creation popover. Closing that popover writes
   * nothing. A native database that has rows still renders them. Absent or
   * `false`: closed without a choice, the popover leaves a native inline
   * database, as in 1.0.
   */
  requireSource?: boolean;
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
