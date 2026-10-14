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
   * Create a source in `databaseId`; it resolves to the new source, or
   * `null`. Absent, the picker offers no "New source".
   */
  createSource?(databaseId: string): Promise<DataSourcePickerSource | null>;
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
