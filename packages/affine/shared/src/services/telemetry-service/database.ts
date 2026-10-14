import type { TelemetryEvent } from './types.js';

type OrderType = 'desc' | 'asc';
export type WithParams<Map, T> = { [K in keyof Map]: Map[K] & T };
export type SortParams = {
  fieldId: string;
  fieldType: string;
  orderType: OrderType;
  orderIndex: number;
};
export type ViewParams = {
  viewId: string;
  viewType: string;
};
export type DatabaseParams = {
  blockId: string;
};

/**
 * Where a database row opened (ADR 0035 §8, §9a): the view's stored `openIn`
 * (absent reads `side`), or `full` for a Ctrl/Cmd-click. Mirrors
 * `DatabaseViewOpenIn` of `@labre/affine-model`, which this layer cannot
 * import.
 */
export type DatabaseRowOpenMode = 'side' | 'center' | 'full';

export type DatabaseViewEvents = {
  DatabaseSortClear: {
    rulesCount: number;
  };
  /**
   * The user picked another layout for a view (B17). Replaces the never
   * emitted {@link DatabaseViewEvents.ChangeDatabaseLayout}.
   */
  DatabaseViewTypeChanged: TelemetryEvent & {
    fromViewType: string;
    toViewType: string;
  };
  /**
   * The user grouped a view, changed its grain or removed the grouping (B17).
   * `groupBy` is the group-by config name (`select`, `date-month`…), `none`
   * once removed; `propertyType` the grouped property's type. Never the
   * property's id or name. Replaces the never emitted `CreateDatabaseGroup`.
   */
  DatabaseGroupChanged: TelemetryEvent & {
    groupBy: string;
    propertyType?: string;
  };
  /**
   * A row was opened from a view (B17). `rowKind` says whether the source's
   * rows are documents (`rowsAreDocuments`) or blocks of the database. Never
   * the row's id: a hosted row is a document id (ADR 0035 §12).
   */
  DatabaseRowOpened: TelemetryEvent & {
    mode: DatabaseRowOpenMode;
    newTab: boolean;
    rowKind: 'document' | 'block';
  };
  /** @deprecated never emitted; `DatabaseViewAdded` reports a new view. */
  CreateDatabaseView: {
    viewType: string; // e.g., 'table', 'gallery'
  };
  /** @deprecated never emitted; see `DatabaseViewTypeChanged`. */
  ChangeDatabaseLayout: {
    fromViewType: string;
    toViewType: string;
  };
};

export type DatabasePropertyEvents = {
  CreateDatabaseProperty: {
    propertyType: string; // e.g., 'text', 'number', 'select'
  };
};

export type DatabaseFilterEvents = {
  CreateDatabaseFilter: {};
};

export type DatabaseGroupEvents = {
  /** @deprecated never emitted; see `DatabaseGroupChanged`. */
  CreateDatabaseGroup: {
    groupBy: string;
  };
};

export type DatabaseEvents = {
  AddDatabase: {};
  /** @deprecated no longer emitted since 0.49; see `DatabaseViewAdded`. */
  AddDatabaseView: {
    type: string;
  };
  /**
   * A view was added by a user gesture (ADR 0035 §12, B17): `existing` when
   * it reads a source the database already has (its own included), `new`
   * when the gesture created the source with it, `import` when it is the
   * copy of another database's view or of a view template (0.49, appended).
   * A database created with its first view reports `BlockCreated`, not this.
   */
  DatabaseViewAdded: TelemetryEvent & {
    viewType: string;
    source: 'existing' | 'new' | 'import';
  };
  /**
   * A hosted source's values could not be loaded (ADR 0035 §9e, B17): once
   * per failure of a source, not per banner drawn. `retryable` says whether
   * the source offers `retryValues`.
   */
  DatabaseValuesLoadFailed: TelemetryEvent & {
    retryable: boolean;
  };
};

export interface DatabaseAllSortEvents {
  DatabaseSortAdd: {};
  DatabaseSortRemove: {};
  DatabaseSortModify: {
    oldOrderType: OrderType;
    oldFieldType: string;
    oldFieldId: string;
  };
  DatabaseSortReorder: {
    prevFieldType: string;
    nextFieldType: string;
    newOrderIndex: number;
  };
}

export type DatabaseAllViewEvents = DatabaseViewEvents &
  WithParams<DatabaseAllSortEvents, SortParams> &
  DatabasePropertyEvents &
  DatabaseFilterEvents &
  DatabaseGroupEvents;

export type DatabaseAllEvents = DatabaseEvents &
  WithParams<DatabaseAllViewEvents, ViewParams>;

export type OutDatabaseAllEvents = WithParams<
  DatabaseAllEvents,
  DatabaseParams
>;

export type EventTraceFn<Events> = <K extends keyof Events>(
  key: K,
  params: Events[K]
) => void;
