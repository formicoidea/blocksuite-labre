import type {
  DatabaseBlockModel,
  ViewBasicDataType,
} from '@labre/affine-model';
import {
  DataSourcePickerProvider,
  type DataSourcePickerSourcePolicy,
  FeatureFlagService,
} from '@labre/affine-shared/services';
import type { InsertToPosition } from '@labre/affine-shared/utils';
import {
  type DatabaseFlags,
  DataSourceBase,
  type DataViewDataType,
  type PropertyMetaConfig,
  type TypeInstance,
  type ViewManager,
  ViewManagerBase,
  type ViewMeta,
} from '@labre/affine-database-engine';
import { DisposableGroup } from '@labre/global/disposable';
import { computed, type ReadonlySignal, signal } from '@preact/signals-core';

import {
  deleteView,
  duplicateView,
  moveViewTo,
  updateView,
} from './utils/block-utils.js';
import { viewDatabaseId } from './view-database.js';
import { deleteViewThroughHost } from './view-deletion.js';
import {
  databaseBlockViewConverts,
  databaseBlockViewMetaGet,
  databaseBlockViews,
} from './views/index.js';

/**
 * One source of a hosted database, as `resolveSource` answers it (ADR 0035
 * §7, issue B1): the `affine:database` block that owns its schema
 * (`props.columns`) and its ordered row ids. Where the host keeps its sources
 * is the host's format; the library never reads it.
 */
export interface HostedSource {
  schema: DatabaseBlockModel;
  rows: ReadonlySignal<string[]>;
}

/**
 * A source the host knows but the view cannot read now (ADR 0035 amendment
 * of 2026-10-30): `'unshared'`, it belongs to a database that is not shared
 * with the reader ("Database not shared"); `'trashed'`, it is in the trash
 * and may be restored ("Source in the trash"), whatever its database;
 * `'loading'`, its database is not loaded yet (labre recette of 2.4.1: a view
 * of another database drew "Connect a source" until it loaded). The view
 * draws that notice in place of its body, never an error and never "Connect
 * a source", which would re-point the view away for good.
 */
export type HostedSourceUnavailableReason = 'unshared' | 'trashed' | 'loading';

export interface HostedSourceUnavailable {
  unavailable: HostedSourceUnavailableReason;
}

const UNAVAILABLE_REASONS: readonly string[] = [
  'unshared',
  'trashed',
  'loading',
] satisfies readonly HostedSourceUnavailableReason[];

/** Whether a resolver's answer is {@link HostedSourceUnavailable}. */
export function isHostedSourceUnavailable(
  answer: HostedSource | HostedSourceUnavailable | null | undefined
): answer is HostedSourceUnavailable {
  return (
    typeof answer === 'object' &&
    answer !== null &&
    'unavailable' in answer &&
    UNAVAILABLE_REASONS.includes(answer.unavailable)
  );
}

/**
 * `sourceId` is the current view's stored `sourceId` (ADR 0035 §8), absent
 * for every view stored before 0.49. `databaseId` is the database it
 * belongs to: the view's stored `databaseId`, else the block's
 * `externalSourceId` (ADR 0035 amendment of 2026-10-30); a resolver of one
 * argument keeps reading its own block's database. `null`: no such source,
 * and the view draws "Source not found" instead of its body (never an
 * error); {@link HostedSourceUnavailable}: the reader may not read it.
 */
export type ResolveHostedSource = (
  sourceId: string | undefined,
  databaseId?: string
) => HostedSource | HostedSourceUnavailable | null;

/**
 * Intermediate base for `affine:database` data sources whose **view config**
 * keeps living in the block model blob (`model.props.views`) while the **data
 * layer** (rows / cells / columns) is redirected elsewhere — the inline blob
 * source, or a host-provided external collection.
 *
 * It implements everything generic — the view manager / metas / converts, the
 * view-data CRUD, feature flags, readonly, and the reactive plumbing — so a
 * concrete source only provides a small synchronous data contract (`getRows`,
 * `getCellValue`, …) plus the mutations, and calls {@link invalidate} from its
 * own change observers.
 *
 * Reactivity: the data-layer reads ({@link rows$}, {@link properties$} and the
 * `*Get` getters that `DataSourceBase` wraps in `computed()`) all depend on
 * {@link revision}. A source backed by reactive blocksuite signals (the blob
 * source) tracks those naturally and never bumps `revision` — cost is nil. A
 * source reading raw `Y.Map`s bumps `revision` via {@link invalidate} so the
 * computeds re-run. Defining `rows$`/`properties$` here (not as instance fields
 * reassigned in a subclass constructor) also avoids the "reassign after super"
 * dance.
 *
 * Sources (ADR 0035 §7, B1): the views live in `hostModel.props.views`; each
 * view reads the source its `sourceId` names, through `resolveSource`. The
 * data layer answers for the CURRENT view's source ({@link source$},
 * {@link schema$}, {@link rows$}): one view is drawn at a time, and property
 * ids never collide across sources (host-generated uuids). Without
 * `resolveSource` the block has one implicit source, itself, whatever a view
 * says: the 0.48 behaviour, which `ExternalDataSourceBase(model)` keeps.
 *
 * Rows that are documents (B15): a source whose rows are documents says so
 * with {@link rowsAreDocuments}, answers each title from its own store with
 * {@link titleOf}, and returns `hostedTitleColumnConfig` from
 * `propertyMetaGet('title')`, so a title is a plain string and no row's
 * document is loaded to draw it.
 */
export abstract class HostedDataSourceBase extends DataSourceBase {
  /** The block that hosts the views (and, without `resolveSource`, the data). */
  protected readonly _model: DatabaseBlockModel;

  private readonly _resolveSource: ResolveHostedSource | undefined;

  /** Bumped by {@link invalidate} to re-run the data-layer computeds. */
  protected readonly revision = signal(0);

  protected readonly disposables = new DisposableGroup();

  constructor(
    hostModel: DatabaseBlockModel,
    resolveSource?: ResolveHostedSource
  ) {
    super();
    this._model = hostModel;
    this._resolveSource = resolveSource;
  }

  get hostModel(): DatabaseBlockModel {
    return this._model;
  }

  /** The current view's stored `sourceId`; `undefined` reads the implicit source. */
  readonly currentSourceId$: ReadonlySignal<string | undefined> = computed(
    () => {
      const viewId = this.viewManager.currentViewId$.value;
      if (!viewId) return undefined;
      const view: ViewBasicDataType | undefined = this.viewDataGet(viewId);
      return view?.sourceId;
    }
  );

  /**
   * The block's database (`externalSourceId`), the one a view without a
   * stored `databaseId` reads. Optional chaining: a host's test double of
   * the model may carry `views$` alone.
   */
  get homeDatabaseId(): string | undefined {
    return this._model.props.externalSourceId$?.value;
  }

  /**
   * The database of the current view's source (ADR 0035 amendment of
   * 2026-10-30): its stored `databaseId`, else the block's. Every call
   * keyed by a database (the resolver, `sourcePolicy`, `deleteView`, the
   * properties panel) names this one.
   */
  readonly currentDatabaseId$: ReadonlySignal<string | undefined> = computed(
    () => {
      const viewId = this.viewManager.currentViewId$.value;
      const view = viewId ? this.viewDataGet(viewId) : undefined;
      return viewDatabaseId(view) ?? this.homeDatabaseId;
    }
  );

  /**
   * Whether the host resolves a view's source in another database
   * (`crossDatabaseViews` of the picker in this data source's scope).
   * Without it a view naming another database reads as missing: a host
   * unaware of `databaseId` would look for its `sourceId` in this one.
   */
  get crossDatabaseViews(): boolean {
    return (
      this.serviceGet(DataSourcePickerProvider)?.crossDatabaseViews === true
    );
  }

  private readonly _implicitRows$: ReadonlySignal<string[]> = computed(() => {
    void this.revision.value;
    return this.getRows();
  });

  /**
   * Whether views name the source they read: a `resolveSource` was given.
   * Without it there is one implicit source, the block, whatever `sourceId`
   * a view stores, so chrome that lists sources has nothing to list.
   */
  get resolvesSources(): boolean {
    return this._resolveSource !== undefined;
  }

  /**
   * The resolver's answer for `sourceId` of `databaseId` (absent: the
   * block's database). Another database is asked only when the host opts in
   * (`crossDatabaseViews`); a throw is logged and reads as no source.
   */
  private resolve(
    sourceId: string | undefined,
    databaseId: string | undefined
  ): HostedSource | HostedSourceUnavailable | null {
    if (!this._resolveSource) {
      return { schema: this._model, rows: this._implicitRows$ };
    }
    const home = this.homeDatabaseId;
    const database = databaseId ?? home;
    if (database !== home && !this.crossDatabaseViews) return null;
    try {
      const answer = this._resolveSource(sourceId, database) ?? null;
      // A reason this build does not know is no source, never a schema.
      if (
        answer &&
        'unavailable' in answer &&
        !isHostedSourceUnavailable(answer)
      ) {
        return null;
      }
      return answer;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /**
   * Any source, by the `sourceId` a view would store and its `databaseId`
   * (absent: the block's database), resolved the way the current view's is
   * ({@link source$}); `null` when there is no such source or the reader
   * may not read it. Read by chrome that lists the sources of the views
   * (the "+ view" menu of `@labre/affine-database-editor`, ADR 0035 B11).
   * Writes nothing.
   */
  sourceOf(
    sourceId: string | undefined,
    databaseId?: string
  ): HostedSource | null {
    const answer = this.resolve(sourceId, databaseId);
    return isHostedSourceUnavailable(answer) ? null : answer;
  }

  // Without `resolveSource` the current view is not read at all: the
  // implicit source does not depend on it.
  private readonly _answer$: ReadonlySignal<
    HostedSource | HostedSourceUnavailable | null
  > = computed(() =>
    this._resolveSource
      ? this.resolve(this.currentSourceId$.value, this.currentDatabaseId$.value)
      : this.resolve(undefined, undefined)
  );

  /** The current view's source; `null` when `resolveSource` knows none. */
  readonly source$: ReadonlySignal<HostedSource | null> = computed(() => {
    const answer = this._answer$.value;
    return isHostedSourceUnavailable(answer) ? null : answer;
  });

  readonly schema$: ReadonlySignal<DatabaseBlockModel | null> = computed(
    () => this.source$.value?.schema ?? null
  );

  /** Nothing to draw: no such source, or one the reader may not read. */
  readonly sourceMissing$: ReadonlySignal<boolean> = computed(
    () => this.source$.value === null
  );

  /**
   * Why the current view's source cannot be read, when the host says so
   * (ADR 0035 amendment of 2026-10-30): `'unshared'`, its database is not
   * shared with the reader ("Database not shared"); `'trashed'`, the source
   * is in the trash ("Source in the trash"); `'loading'`, its database is
   * not loaded yet (a spinner). `null` otherwise, "Source not found" included.
   */
  readonly sourceUnavailable$: ReadonlySignal<HostedSourceUnavailableReason | null> =
    computed(() => {
      const answer = this._answer$.value;
      return isHostedSourceUnavailable(answer) ? answer.unavailable : null;
    });

  /** Each row is a document (ADR 0035 §9a, §9f). Read-only. */
  get rowsAreDocuments(): boolean {
    return false;
  }

  /**
   * A document row's title from the source's own store, read for the `title`
   * property when {@link rowsAreDocuments}; `undefined` falls back to
   * `getCellValue`.
   */
  protected titleOf(_rowId: string): string | undefined {
    return undefined;
  }

  /** Notify the view layer that the underlying data changed. */
  protected invalidate(): void {
    this.revision.value++;
  }

  override dispose(): void {
    this.disposables.dispose();
  }

  get doc() {
    return this._model.store;
  }

  override get parentProvider() {
    return this._model.store.provider;
  }

  // --- data contract a concrete source must provide -----------------------

  protected abstract getRows(): string[];
  protected abstract getProperties(): string[];
  protected abstract getCellValue(rowId: string, propertyId: string): unknown;
  protected abstract getPropertyType(propertyId: string): string | undefined;
  protected abstract getPropertyName(propertyId: string): string;
  protected abstract getPropertyData(
    propertyId: string
  ): Record<string, unknown>;
  protected abstract getPropertyDataType(
    propertyId: string
  ): TypeInstance | undefined;
  protected abstract getPropertyMetas(): PropertyMetaConfig[];

  // --- reactive bridge over the data contract -----------------------------

  rows$: ReadonlySignal<string[]> = computed(
    () => this.source$.value?.rows.value ?? []
  );

  properties$: ReadonlySignal<string[]> = computed(() => {
    void this.revision.value;
    return this.getProperties();
  });

  allPropertyMetas$: ReadonlySignal<PropertyMetaConfig[]> = computed(() => {
    void this.revision.value;
    return this.getPropertyMetas();
  });

  propertyMetas$: ReadonlySignal<PropertyMetaConfig[]> = computed(() => {
    return this.allPropertyMetas$.value.filter(
      v => !v.config.fixed && !v.config.hide
    );
  });

  cellValueGet(rowId: string, propertyId: string): unknown {
    void this.revision.value;
    if (this.rowsAreDocuments && this.getPropertyType(propertyId) === 'title') {
      const title = this.titleOf(rowId);
      if (title !== undefined) return title;
    }
    return this.getCellValue(rowId, propertyId);
  }

  propertyTypeGet(propertyId: string): string | undefined {
    void this.revision.value;
    return this.getPropertyType(propertyId);
  }

  propertyNameGet(propertyId: string): string {
    void this.revision.value;
    return this.getPropertyName(propertyId);
  }

  propertyDataGet(propertyId: string): Record<string, unknown> {
    void this.revision.value;
    return this.getPropertyData(propertyId);
  }

  propertyDataTypeGet(propertyId: string): TypeInstance | undefined {
    void this.revision.value;
    return this.getPropertyDataType(propertyId);
  }

  // --- view surface (config stays in the model blob) ----------------------

  override featureFlags$: ReadonlySignal<DatabaseFlags> = computed(() => {
    const featureFlagService = this.doc.get(FeatureFlagService);
    return {
      enable_number_formatting:
        featureFlagService.getFlag('enable_database_number_formatting') ??
        false,
      enable_table_virtual_scroll:
        featureFlagService.getFlag('enable_table_virtual_scroll') ?? false,
    };
  });

  /**
   * Refuses every edit on a writable store: a database with no source, under
   * a host that requires one, shows its native rows read-only (ADR 0035
   * amendment of 2026-10-29). Every write path of the view layer reads
   * `readonly$` (cells, paste, drag, "New", view and property menus).
   */
  readonly locked$ = signal(false);

  /**
   * The host's lock on the current view's source (`sourcePolicy` of the
   * picker, ADR 0035 amendment of 2026-10-29), asked again only when the
   * view's database or its source changes; the host's signal then carries
   * every flip to the open views. `null`: nothing locked (a native
   * database, no picker, no `sourcePolicy`, or a host that threw). The
   * database is the VIEW's (amendment of 2026-10-30): a view reading
   * another database's source follows that database's rules.
   */
  private readonly hostPolicy$: ReadonlySignal<ReadonlySignal<DataSourcePickerSourcePolicy> | null> =
    computed(() => {
      if (!this.homeDatabaseId) return null;
      const databaseId = this.currentDatabaseId$.value;
      if (!databaseId) return null;
      const picker = this.serviceGet(DataSourcePickerProvider);
      if (!picker?.sourcePolicy) return null;
      try {
        return picker.sourcePolicy(databaseId, this.currentSourceId$.value);
      } catch (error) {
        console.error(error);
        return null;
      }
    });

  override readonly propertiesLocked$: ReadonlySignal<boolean> = computed(
    () => this.hostPolicy$.value?.value.propertiesLocked === true
  );

  override readonly rowsLocked$: ReadonlySignal<boolean> = computed(
    () => this.hostPolicy$.value?.value.rowsLocked === true
  );

  // Mobile edits too (ADR 0035 §1, B5): the table and kanban presets ship
  // their own touch renderers, chosen by `DataViewRootUILogic`.
  readonly$: ReadonlySignal<boolean> = computed(() => {
    return this._model.store.readonly || this.locked$.value;
  });

  viewConverts = databaseBlockViewConverts;

  viewMetas = databaseBlockViews;

  override viewManager: ViewManager = new ViewManagerBase(this);

  viewDataList$: ReadonlySignal<DataViewDataType[]> = computed(() => {
    return this._model.props.views$.value as DataViewDataType[];
  });

  viewDataGet(viewId: string): DataViewDataType | undefined {
    return this.viewDataList$.value.find(data => data.id === viewId)!;
  }

  viewDataAdd(viewData: DataViewDataType): string {
    this._model.store.captureSync();
    this._model.store.transact(() => {
      this._model.props.views = [...this._model.props.views, viewData];
    });
    return viewData.id;
  }

  viewDataDelete(viewId: string): void {
    deleteViewThroughHost({
      model: this._model,
      viewId,
      picker: this.serviceGet(DataSourcePickerProvider),
      removeNow: () => {
        this._model.store.captureSync();
        deleteView(this._model, viewId);
      },
      // The view manager moved on when the gesture was made; a removal the
      // host made later must not leave a vanished view current.
      afterRemove: () => {
        const manager = this.viewManager;
        const views = manager.views$.peek();
        const current = manager.currentViewId$.peek();
        const next = views[0];
        if (current !== undefined && !views.includes(current) && next) {
          manager.setCurrentView(next);
        }
      },
    });
  }

  viewDataDuplicate(id: string): string {
    return duplicateView(this._model, id);
  }

  viewDataMoveTo(id: string, position: InsertToPosition): void {
    moveViewTo(this._model, id, position);
  }

  viewDataUpdate<ViewData extends DataViewDataType>(
    id: string,
    updater: (data: ViewData) => Partial<ViewData>
  ): void {
    updateView(this._model, id, updater);
  }

  viewMetaGet(type: string): ViewMeta {
    return databaseBlockViewMetaGet(type);
  }

  viewMetaGetById(viewId: string): ViewMeta | undefined {
    const view = this.viewDataGet(viewId);
    if (!view) {
      return;
    }
    return this.viewMetaGet(view.mode);
  }
}

/**
 * The 0.48 name, kept so a host source written against it compiles unchanged:
 * `new ExternalDataSourceBase(model)` is a hosted source with one implicit
 * source, the block itself.
 */
export { HostedDataSourceBase as ExternalDataSourceBase };
