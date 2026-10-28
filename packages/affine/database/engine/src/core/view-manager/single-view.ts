import type { InsertToPosition } from '@labre/affine-shared/utils';
import type { GeneralServiceIdentifier } from '@labre/global/di';
import { computed, type ReadonlySignal, signal } from '@preact/signals-core';

import type { DataSource } from '../data-source/base.js';
import type { Variable } from '../expression/types.js';
import type { PropertyMetaConfig } from '../property/property-config.js';
import type { TraitKey } from '../traits/key.js';
import type { DatabaseFlags } from '../types.js';
import { computedLock } from '../utils/lock.js';
import type { DataViewDataType, ViewMeta } from '../view/data-view.js';
import { type Cell, CellBase } from './cell.js';
import type { Property } from './property.js';
import { type Row, RowBase } from './row.js';
import type { ViewManager } from './view-manager.js';

/**
 * True when a stored `mode` has no preset of its own and the source draws it
 * through another one (ADR 0035 §6: a `timeline`, a mode from a newer
 * client, an import). The one spelling of the rule, read by
 * `SingleView.shownAsFallback$` and by the views bar's tabs, which must not
 * build a view per tab to ask.
 */
export function modeShownAsFallback(
  dataSource: Pick<DataSource, 'viewMetaGet'>,
  mode: string
): boolean {
  return dataSource.viewMetaGet(mode).type !== mode;
}

export type MainProperties = {
  titleColumn?: string;
  iconColumn?: string;
  imageColumn?: string;
};

export interface SingleView {
  readonly id: string;
  readonly type: string;
  readonly manager: ViewManager;
  readonly meta: ViewMeta;
  readonly readonly$: ReadonlySignal<boolean>;
  /**
   * The stored mode has no preset here and `meta` is the source's fallback:
   * the view is drawn, its settings are read-only, its data is never written.
   */
  readonly shownAsFallback$: ReadonlySignal<boolean>;

  delete(): void;

  duplicate(): void;

  readonly name$: ReadonlySignal<string>;

  nameSet(name: string): void;

  readonly propertiesRaw$: ReadonlySignal<Property[]>;
  readonly propertyMap$: ReadonlySignal<Record<string, Property>>;
  readonly properties$: ReadonlySignal<Property[]>;
  readonly propertyIds$: ReadonlySignal<string[]>;
  readonly detailProperties$: ReadonlySignal<Property[]>;
  readonly rowsRaw$: ReadonlySignal<Row[]>;
  readonly rows$: ReadonlySignal<Row[]>;
  readonly rowIds$: ReadonlySignal<string[]>;

  readonly vars$: ReadonlySignal<Variable[]>;

  readonly featureFlags$: ReadonlySignal<DatabaseFlags>;

  propertyGetOrCreate(propertyId: string): Property;
  rowGetOrCreate(rowId: string): Row;
  cellGetOrCreate(rowId: string, propertyId: string): Cell;

  rowAdd(insertPosition: InsertToPosition): string;
  rowsDelete(rows: string[]): void;

  readonly propertyMetas$: ReadonlySignal<PropertyMetaConfig[]>;

  propertyAdd(
    toAfterOfProperty: InsertToPosition,
    ops?: {
      type?: string;
      name?: string;
    }
  ): string | undefined;

  serviceGet<T>(key: GeneralServiceIdentifier<T>): T | null;
  serviceGetOrCreate<T>(key: GeneralServiceIdentifier<T>, create: () => T): T;

  traitGet<T>(key: TraitKey<T>): T | undefined;

  mainProperties$: ReadonlySignal<MainProperties>;

  lockRows(lock: boolean): void;

  isLocked$: ReadonlySignal<boolean>;
}

export abstract class SingleViewBase<
  ViewData extends DataViewDataType = DataViewDataType,
> implements SingleView
{
  private readonly searchString = signal('');

  private readonly traitMap = new Map<symbol, unknown>();

  /** The view data exactly as stored, whatever its mode. */
  private readonly storedData$ = computed(() => {
    return this.dataSource.viewDataGet(this.id);
  });

  /**
   * {@link modeShownAsFallback} for this view. Read from the stored mode,
   * never from `type`, which a preset may derive from {@link data$}.
   */
  readonly shownAsFallback$: ReadonlySignal<boolean> = computed(() => {
    const mode = this.storedData$.value?.mode;
    return mode != null && modeShownAsFallback(this.dataSource, mode);
  });

  /**
   * A fallback view reads the preset's DEFAULT data, keeping only its id,
   * name and stored mode: the stored keys belong to a preset this client does
   * not have, so neither a filter nor a column list is trusted from them, and
   * the preset draws the source's properties as a fresh view would.
   */
  data$ = computed(() => {
    const stored = this.storedData$.value;
    if (!stored || !this.shownAsFallback$.value) {
      return stored as ViewData | undefined;
    }
    const meta = this.dataSource.viewMetaGet(stored.mode);
    return {
      ...meta.model.defaultData(this.manager),
      id: stored.id,
      name: stored.name,
      mode: stored.mode,
    } as ViewData;
  });

  abstract detailProperties$: ReadonlySignal<Property[]>;

  protected lockRows$ = signal(false);

  isLocked$ = computed(() => {
    return this.lockRows$.value;
  });

  abstract mainProperties$: ReadonlySignal<MainProperties>;

  name$: ReadonlySignal<string> = computed(() => {
    return this.data$.value?.name ?? '';
  });

  propertyIds$: ReadonlySignal<string[]> = computed(() => {
    return this.properties$.value.map(v => v.id);
  });

  propertyMap$: ReadonlySignal<Record<string, Property>> = computed(() => {
    return Object.fromEntries(this.properties$.value.map(v => [v.id, v]));
  });

  abstract properties$: ReadonlySignal<Property[]>;

  abstract propertiesRaw$: ReadonlySignal<Property[]>;

  abstract readonly$: ReadonlySignal<boolean>;

  rowsRaw$ = computed(() => {
    return this.dataSource.rows$.value.map(id => this.rowGetOrCreate(id));
  });

  rows$ = computedLock(
    computed(() => {
      return this.rowsMapping(this.rowsRaw$.value);
    }),
    this.isLocked$
  );

  rowsDelete(rows: string[]): void {
    this.lockRows(false);
    this.dataSource.rowDelete(rows);
  }

  rowIds$ = computed(() => {
    return this.rowsRaw$.value.map(v => v.rowId);
  });

  vars$ = computed(() => {
    return this.propertiesRaw$.value.flatMap(property => {
      const propertyMeta = this.dataSource.propertyMetaGet(
        property.type$.value
      );
      if (!propertyMeta) {
        return [];
      }
      return {
        id: property.id,
        name: property.name$.value,
        type: propertyMeta.config.jsonValue.type({
          data: property.data$.value,
          dataSource: this.dataSource,
        }),
        icon: property.icon,
        propertyType: property.type$.value,
      };
    });
  });

  protected get dataSource() {
    return this.manager.dataSource;
  }

  get featureFlags$() {
    return this.dataSource.featureFlags$;
  }

  get isLocked() {
    return this.lockRows$.value;
  }

  get meta() {
    return this.dataSource.viewMetaGet(this.type);
  }

  get propertyMetas$() {
    return this.dataSource.propertyMetas$;
  }

  abstract get type(): string;

  constructor(
    public manager: ViewManager,
    public id: string
  ) {}

  private searchRowsMapping(rows: Row[], searchString: string): Row[] {
    return rows.filter(row => {
      if (searchString) {
        const containsSearchString = this.propertyIds$.value.some(
          propertyId => {
            return this.cellGetOrCreate(row.rowId, propertyId)
              .stringValue$.value?.toLowerCase()
              .includes(searchString?.toLowerCase());
          }
        );
        if (!containsSearchString) {
          return false;
        }
      }
      return this.isShow(row.rowId);
    });
  }

  cellGetOrCreate(rowId: string, propertyId: string): Cell {
    return new CellBase(this, propertyId, rowId);
  }

  serviceGet<T>(key: GeneralServiceIdentifier<T>): T | null {
    return this.dataSource.serviceGet(key);
  }

  serviceGetOrCreate<T>(key: GeneralServiceIdentifier<T>, create: () => T): T {
    return this.dataSource.serviceGetOrCreate(key, create);
  }

  dataUpdate(updater: (viewData: ViewData) => Partial<ViewData>): void {
    // A fallback view's stored data is never rewritten (ADR 0035 §6): every
    // setting it shows is the fallback preset's default, and writing one back
    // would mix that preset's keys into another mode's data. Cells are the
    // source's, not the view's, and stay writable.
    if (this.shownAsFallback$.peek()) return;
    this.dataSource.viewDataUpdate(this.id, updater);
  }

  delete(): void {
    this.manager.viewDelete(this.id);
  }

  duplicate(): void {
    this.manager.viewDuplicate(this.id);
  }

  abstract isShow(rowId: string): boolean;

  lockRows(lock: boolean) {
    this.lockRows$.value = lock;
  }

  nameSet(name: string): void {
    this.dataUpdate(() => {
      return {
        name,
      } as ViewData;
    });
  }

  propertyAdd(
    position: InsertToPosition,
    ops?: {
      type?: string;
      name?: string;
    }
  ): string | undefined {
    const id = this.dataSource.propertyAdd(position, ops);
    if (!id) {
      return;
    }
    const property = this.propertyGetOrCreate(id);
    property.move(position);
    return id;
  }

  abstract propertyGetOrCreate(propertyId: string): Property;

  rowAdd(insertPosition: InsertToPosition | number): string {
    this.lockRows(false);
    return this.dataSource.rowAdd(insertPosition);
  }

  rowGetOrCreate(rowId: string): Row {
    return new RowBase(this, rowId);
  }

  protected rowsMapping(rows: Row[]): Row[] {
    return this.searchRowsMapping(rows, this.searchString.value);
  }

  setSearch(str: string): void {
    this.searchString.value = str;
  }

  traitGet<T>(key: TraitKey<T>): T | undefined {
    return this.traitMap.get(key.key) as T | undefined;
  }

  protected traitSet<T>(key: TraitKey<T>, value: T): T {
    this.traitMap.set(key.key, value);
    return value;
  }
}
