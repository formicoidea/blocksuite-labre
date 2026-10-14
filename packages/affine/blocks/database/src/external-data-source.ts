import type {
  DatabaseBlockModel,
  ViewBasicDataType,
} from '@labre/affine-model';
import { FeatureFlagService } from '@labre/affine-shared/services';
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
} from '@labre/data-view';
import { DisposableGroup } from '@labre/global/disposable';
import { computed, type ReadonlySignal, signal } from '@preact/signals-core';

import {
  deleteView,
  duplicateView,
  moveViewTo,
  updateView,
} from './utils/block-utils.js';
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
 * `sourceId` is the current view's stored `sourceId` (ADR 0035 §8), absent
 * for every view stored before 0.49. `null`: no such source, and the view
 * draws "Source not found" instead of its body (never an error).
 */
export type ResolveHostedSource = (
  sourceId: string | undefined
) => HostedSource | null;

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

  private readonly _implicitRows$: ReadonlySignal<string[]> = computed(() => {
    void this.revision.value;
    return this.getRows();
  });

  /** The current view's source; `null` when `resolveSource` knows none. */
  readonly source$: ReadonlySignal<HostedSource | null> = computed(() => {
    if (!this._resolveSource) {
      return { schema: this._model, rows: this._implicitRows$ };
    }
    return this._resolveSource(this.currentSourceId$.value);
  });

  readonly schema$: ReadonlySignal<DatabaseBlockModel | null> = computed(
    () => this.source$.value?.schema ?? null
  );

  readonly sourceMissing$: ReadonlySignal<boolean> = computed(
    () => this.source$.value === null
  );

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

  // Mobile edits too (ADR 0035 §1, B5): the table and kanban presets ship
  // their own touch renderers, chosen by `DataViewRootUILogic`.
  readonly$: ReadonlySignal<boolean> = computed(() => {
    return this._model.store.readonly;
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
    this._model.store.captureSync();
    deleteView(this._model, viewId);
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
