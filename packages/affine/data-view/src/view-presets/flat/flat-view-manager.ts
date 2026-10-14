import {
  insertPositionToIndex,
  type InsertToPosition,
} from '@labre/affine-shared/utils';
import { computed } from '@preact/signals-core';

import type { GroupBy, GroupProperty } from '../../core/common/types.js';
import { evalFilter } from '../../core/filter/eval.js';
import { generateDefaultValues } from '../../core/filter/generate-default-values.js';
import { FilterTrait, filterTraitKey } from '../../core/filter/trait.js';
import type { FilterGroup } from '../../core/filter/types.js';
import { emptyFilterGroup } from '../../core/filter/utils.js';
import { groupPropertiesOps } from '../../core/group-by/group-properties.js';
import { GroupTrait, groupTraitKey } from '../../core/group-by/trait.js';
import { fromJson } from '../../core/property/utils.js';
import { SortManager, sortTraitKey } from '../../core/sort/manager.js';
import type { Sort } from '../../core/sort/types.js';
import type { BasicViewDataType } from '../../core/view/data-view.js';
import { PropertyBase } from '../../core/view-manager/property.js';
import type { Row } from '../../core/view-manager/row.js';
import { SingleViewBase } from '../../core/view-manager/single-view.js';
import type { ViewManager } from '../../core/view-manager/view-manager.js';

/**
 * A property's place in a gallery or list view: the shape table and kanban
 * already store, `columns[].hide` (ADR 0035 §8), so per-view visibility reads
 * and writes the same way in every preset.
 */
export type FlatViewColumn = {
  id: string;
  hide?: boolean;
};

export type FlatViewDataType<Mode extends string = string> = BasicViewDataType<
  Mode,
  {
    columns: FlatViewColumn[];
    filter: FilterGroup;
    sort?: Sort;
    groupBy?: GroupBy;
    groupProperties?: GroupProperty[];
  }
>;

/**
 * What a new gallery or list view stores: its title shown, every other
 * property hidden until the user shows it, as Notion does for these two
 * layouts. Written once, by the gesture that creates the view; a stored view
 * is never rewritten on load.
 */
export const flatViewDefaultData = (
  viewManager: ViewManager
): { columns: FlatViewColumn[]; filter: FilterGroup } => {
  const dataSource = viewManager.dataSource;
  return {
    columns: dataSource.properties$.value.map(id => ({
      id,
      hide: dataSource.propertyTypeGet(id) !== 'title',
    })),
    filter: { type: 'group', op: 'and', conditions: [] },
  };
};

/**
 * The manager both ungrouped presets share, gallery and list (ADR 0035 §1,
 * B6 and B7): the table's per-view property order and visibility, filter and
 * sort, and its row creation from the filter's default values, without the
 * table's widths and statistics. Grouping (B8) is the table's too: the same
 * stored `groupBy` and `groupProperties`, the same trait and ops.
 */
export abstract class FlatSingleView<
  ViewData extends FlatViewDataType = FlatViewDataType,
> extends SingleViewBase<ViewData> {
  propertiesRaw$ = computed(() => {
    const needShow = new Set(this.dataSource.properties$.value);
    const result: string[] = [];
    this.data$.value?.columns.forEach(v => {
      if (needShow.has(v.id)) {
        result.push(v.id);
        needShow.delete(v.id);
      }
    });
    result.push(...needShow);
    return result.map(id => this.propertyGetOrCreate(id));
  });

  properties$ = computed(() => {
    return this.propertiesRaw$.value.filter(property => !property.hide$.value);
  });

  detailProperties$ = computed(() => {
    return this.propertiesRaw$.value.filter(
      property => property.type$.value !== 'title'
    );
  });

  /** The title, drawn first on a card or a row whatever the columns say. */
  titleProperty$ = computed(() => {
    return this.properties$.value.find(
      property => property.type$.value === 'title'
    );
  });

  /** The visible properties drawn after the title. */
  bodyProperties$ = computed(() => {
    return this.properties$.value.filter(
      property => property.type$.value !== 'title'
    );
  });

  mainProperties$ = computed(() => ({
    titleColumn: this.propertiesRaw$.value.find(
      property => property.type$.value === 'title'
    )?.id,
    iconColumn: 'type',
  }));

  readonly$ = computed(() => {
    return this.manager.readonly$.value;
  });

  private readonly filter$ = computed(() => {
    return this.data$.value?.filter ?? emptyFilterGroup;
  });

  private readonly sortList$ = computed(() => {
    return this.data$.value?.sort;
  });

  filterTrait = this.traitSet(
    filterTraitKey,
    new FilterTrait(this.filter$, this, {
      filterSet: (filter: FilterGroup) => {
        this.dataUpdate(() => ({ filter }) as Partial<ViewData>);
      },
    })
  );

  private readonly sortManager = this.traitSet(
    sortTraitKey,
    new SortManager(this.sortList$, this, {
      setSortList: sortList => {
        this.dataUpdate(
          data =>
            ({
              sort: {
                ...data.sort,
                ...sortList,
              },
            }) as Partial<ViewData>
        );
      },
    })
  );

  private readonly groupBy$ = computed(() => {
    return this.data$.value?.groupBy;
  });

  groupTrait = this.traitSet(
    groupTraitKey,
    new GroupTrait(this.groupBy$, this, {
      groupBySet: groupBy => {
        this.dataUpdate(() => ({ groupBy }) as Partial<ViewData>);
      },
      ...groupPropertiesOps(
        () => this.data$.value?.groupProperties ?? [],
        groupProperties => {
          this.dataUpdate(() => ({ groupProperties }) as Partial<ViewData>);
        }
      ),
    })
  );

  /** Every property's column entry, so a first hide stores the full order. */
  readonly columnsData$ = computed((): FlatViewColumn[] => {
    return this.propertiesRaw$.value.map(property => ({
      id: property.id,
      hide: property.hide$.value,
    }));
  });

  isShow(rowId: string): boolean {
    const filter = this.filter$.value;
    if (!filter.conditions.length) return true;
    // Hidden properties included, as in the table: hiding a property must not
    // silently drop the condition on it.
    const rowMap = Object.fromEntries(
      this.propertiesRaw$.value.map(property => [
        property.id,
        property.cellGetOrCreate(rowId).jsonValue$.value,
      ])
    );
    return evalFilter(filter, rowMap);
  }

  propertyGetOrCreate(propertyId: string): FlatProperty {
    return new FlatProperty(this, propertyId);
  }

  /** A row added from a group's "New page" takes that group's value. */
  override rowAdd(
    insertPosition: InsertToPosition | number,
    groupKey?: string
  ): string {
    const id = super.rowAdd(insertPosition);
    if (!id) return id;
    const filter = this.filter$.value;
    const defaultValues = filter.conditions.length
      ? generateDefaultValues(filter, this.vars$.value)
      : {};
    Object.entries(defaultValues).forEach(([propertyId, jsonValue]) => {
      const property = this.propertyGetOrCreate(propertyId);
      const propertyMeta = property.meta$.value;
      if (!propertyMeta) return;
      const value = fromJson(propertyMeta.config, {
        value: jsonValue,
        data: property.data$.value,
        dataSource: this.dataSource,
      });
      this.cellGetOrCreate(id, propertyId).valueSet(value);
    });
    // After the filter's defaults, as in the table: the group clicked wins.
    if (groupKey != null) this.groupTrait.addToGroup(id, groupKey);
    return id;
  }

  protected override rowsMapping(rows: Row[]) {
    return this.sortManager.sort(super.rowsMapping(rows));
  }
}

export class FlatProperty extends PropertyBase {
  hide$ = computed(() => {
    const hideFromViewData = this.viewData$.value?.hide;
    if (hideFromViewData != null) {
      return hideFromViewData;
    }
    const defaultShow = this.meta$.value?.config.fixed?.defaultShow;
    if (defaultShow != null) {
      return !defaultShow;
    }
    return false;
  });

  viewData$ = computed(() => {
    return this.flatView.data$.value?.columns.find(v => v.id === this.id);
  });

  constructor(
    private readonly flatView: FlatSingleView,
    propertyId: string
  ) {
    super(flatView, propertyId);
  }

  override hideSet(hide: boolean): void {
    this.flatView.dataUpdate(() => ({
      columns: this.flatView.columnsData$.value.map(v =>
        v.id === this.id ? { ...v, hide } : v
      ),
    }));
  }

  override move(position: InsertToPosition): void {
    this.flatView.dataUpdate(() => {
      const columns = [...this.flatView.columnsData$.value];
      const index = columns.findIndex(v => v.id === this.id);
      if (index < 0) return {};
      const [column] = columns.splice(index, 1);
      if (!column) return {};
      columns.splice(insertPositionToIndex(position, columns), 0, column);
      return { columns };
    });
  }
}
