import type { DatabaseBlockModel } from '@labre/affine-model';
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
import { IS_MOBILE } from '@labre/global/env';
import { BlockSuiteError, ErrorCode } from '@labre/global/exceptions';
import { computed, type ReadonlySignal, signal } from '@preact/signals-core';

import {
  deleteView,
  duplicateView,
  moveViewTo,
  updateView,
} from './utils/block-utils.js';
import {
  databaseBlockViewConverts,
  databaseBlockViewMap,
  databaseBlockViews,
} from './views/index.js';

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
 */
export abstract class ExternalDataSourceBase extends DataSourceBase {
  protected readonly _model: DatabaseBlockModel;

  /** Bumped by {@link invalidate} to re-run the data-layer computeds. */
  protected readonly revision = signal(0);

  protected readonly disposables = new DisposableGroup();

  constructor(model: DatabaseBlockModel) {
    super();
    this._model = model;
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

  rows$: ReadonlySignal<string[]> = computed(() => {
    void this.revision.value;
    return this.getRows();
  });

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

  readonly$: ReadonlySignal<boolean> = computed(() => {
    return (
      this._model.store.readonly ||
      // TODO(@L-Sun): use block level readonly
      IS_MOBILE
    );
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
    const view = databaseBlockViewMap[type];
    if (!view) {
      throw new BlockSuiteError(
        ErrorCode.DatabaseBlockError,
        `Unknown view type: ${type}`
      );
    }
    return view;
  }

  viewMetaGetById(viewId: string): ViewMeta | undefined {
    const view = this.viewDataGet(viewId);
    if (!view) {
      return;
    }
    return this.viewMetaGet(view.mode);
  }
}
