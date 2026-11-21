import type { InsertToPosition } from '@labre/affine-shared/utils';
import { nanoid } from '@labre/store';
import { computed, type ReadonlySignal, signal } from '@preact/signals-core';

import type { DataSource } from '../data-source/base.js';
import type {
  DataViewDataType,
  DataViewMode,
  ViewMeta,
} from '../view/data-view.js';
import type { SingleView } from './single-view.js';

export interface ViewManager {
  viewMetas: ViewMeta[];
  dataSource: DataSource;
  readonly$: ReadonlySignal<boolean>;

  currentViewId$: ReadonlySignal<string | undefined>;
  currentView$: ReadonlySignal<SingleView | undefined>;

  setCurrentView(id: string): void;

  views$: ReadonlySignal<string[]>;

  viewGet(id: string): SingleView | undefined;

  /**
   * `name` is what the creation site resolved (`viewDefaultName`); absent,
   * the preset's English `defaultName` is written, as in 0.48.
   */
  viewAdd(type: DataViewMode, name?: string): string;

  viewDelete(id: string): void;

  viewDuplicate(id: string): void;

  viewDataGet(id: string): DataViewDataType | undefined;

  moveTo(id: string, position: InsertToPosition): void;

  viewChangeType(id: string, type: string): void;
}

export class ViewManagerBase implements ViewManager {
  _currentViewId$ = signal<string | undefined>(undefined);

  views$ = computed(() => {
    return this.dataSource.viewDataList$.value.map(data => data.id);
  });

  /**
   * The view picked last, while it exists; else the first view; `undefined`
   * only when there is none. A picked id is not cleared when its view goes
   * from elsewhere (a peer, an undo, a host's later `remove()`), so it is
   * checked here: a stale id drew nothing at all, as if the block had no
   * view (ADR 0035 amendment of 2026-11-20).
   */
  currentViewId$ = computed(() => {
    const views = this.views$.value;
    const picked = this._currentViewId$.value;
    return picked !== undefined && views.includes(picked) ? picked : views[0];
  });

  currentView$ = computed(() => {
    const id = this.currentViewId$.value;
    if (!id) return;
    return this.viewGet(id);
  });

  readonly$ = computed(() => {
    return this.dataSource.readonly$.value;
  });

  get viewMetas() {
    return this.dataSource.viewMetas;
  }

  constructor(public dataSource: DataSource) {}

  moveTo(id: string, position: InsertToPosition): void {
    this.dataSource.viewDataMoveTo(id, position);
  }

  setCurrentView(id: string | undefined): void {
    this._currentViewId$.value = id;
  }

  viewAdd(type: DataViewMode, name?: string): string {
    const meta = this.dataSource.viewMetaGet(type);
    const data = meta.model.defaultData(this);
    const id = this.dataSource.viewDataAdd({
      ...data,
      id: nanoid(),
      name: name ?? meta.model.defaultName,
      mode: type,
    });
    this.setCurrentView(id);
    return id;
  }

  viewChangeType(id: string, type: string): void {
    const from = this.viewGet(id)?.type;
    const meta = this.dataSource.viewMetaGet(type);
    this.dataSource.viewDataUpdate(id, old => {
      let data = {
        ...meta.model.defaultData(this),
        id: old.id,
        name: old.name,
        mode: type,
      };
      const convertFunction = this.dataSource.viewConverts.find(
        v => v.from === from && v.to === type
      );
      if (convertFunction) {
        data = {
          ...data,
          ...convertFunction.convert(old),
        };
      }
      return data;
    });
  }

  viewDataGet(id: string): DataViewDataType | undefined {
    return this.dataSource.viewDataGet(id);
  }

  viewDelete(id: string): void {
    this.dataSource.viewDataDelete(id);
    this.setCurrentView(this.views$.value[0]);
  }

  viewDuplicate(id: string): void {
    const newId = this.dataSource.viewDataDuplicate(id);
    this.setCurrentView(newId);
  }

  viewGet(id: string): SingleView | undefined {
    const meta = this.dataSource.viewMetaGetById(id);
    if (!meta) return;
    return new meta.model.dataViewManager(this, id);
  }
}
