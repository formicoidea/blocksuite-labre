import {
  insertPositionToIndex,
  type InsertToPosition,
} from '@labre/affine-shared/utils';
import {
  computed,
  effect,
  type ReadonlySignal,
  signal,
} from '@preact/signals-core';

import type { GroupBy, GroupProperty } from '../common/types.js';
import type { TypeInstance } from '../logical/type.js';
import { createTraitKey } from '../traits/key.js';
import { computedLock } from '../utils/lock.js';
import type { Property } from '../view-manager/property.js';
import type { Row } from '../view-manager/row.js';
import type { SingleView } from '../view-manager/single-view.js';
import { compareDateKeys } from './compare-date-keys.js';
import { defaultGroupBy } from './default.js';
import { findGroupByConfigByName, getGroupByService } from './matcher.js';
import type { GroupByConfig } from './types.js';

export type GroupInfo<
  RawValue = unknown,
  JsonValue = unknown,
  Data extends Record<string, unknown> = Record<string, unknown>,
> = {
  config: GroupByConfig;
  property: Property<RawValue, JsonValue, Data>;
  tType: TypeInstance;
};

export class Group<
  RawValue = unknown,
  JsonValue = unknown,
  Data extends Record<string, unknown> = Record<string, unknown>,
> {
  rows: Row[] = [];

  constructor(
    public readonly key: string,
    public readonly value: JsonValue,
    private readonly groupInfo: GroupInfo<RawValue, JsonValue, Data>,
    public readonly manager: GroupTrait
  ) {}

  get property() {
    return this.groupInfo.property;
  }

  name$ = computed(() => {
    const type = this.property.dataType$.value;
    if (!type) {
      return '';
    }
    return this.groupInfo.config.groupName(type, this.value);
  });

  private get config() {
    return this.groupInfo.config;
  }

  get tType() {
    return this.groupInfo.tType;
  }

  get view() {
    return this.config.view;
  }
}

export const isDateGroupInfo = (groupInfo: GroupInfo | undefined) =>
  groupInfo?.config.matchType.name === 'Date';

/**
 * Order the group keys. Date groups read chronologically — their keys are
 * timestamps, or the relative buckets from last30 to next30 — so the manual
 * drag order does not apply to them and `sortGroup` is bypassed.
 */
export const orderGroupKeys = (
  keys: string[],
  groupInfo: GroupInfo | undefined,
  sortGroup: (keys: string[]) => string[],
  sortAsc: boolean
) => {
  if (isDateGroupInfo(groupInfo)) {
    return [...keys].sort(compareDateKeys(groupInfo?.config.name, sortAsc));
  }
  return sortGroup(keys);
};

/**
 * Move `groupKey` to `position` inside `keys`, or leave the order untouched
 * when the move cannot be honoured: an unknown group, an unknown anchor, or a
 * group dropped onto itself. Reordering blindly would splice at index -1 and
 * quietly destroy the manual order of an unrelated group.
 */
export const reorderGroupKeys = (
  keys: string[],
  groupKey: string,
  position: InsertToPosition
) => {
  const currentIndex = keys.findIndex(key => key === groupKey);
  if (currentIndex < 0) {
    return keys;
  }
  if (typeof position === 'object') {
    if (position.id === groupKey) {
      return keys;
    }
    if (!keys.includes(position.id)) {
      return keys;
    }
  }

  const reordered = [...keys];
  reordered.splice(currentIndex, 1);
  const index = insertPositionToIndex(position, reordered, key => key);
  if (index < 0) {
    return keys;
  }
  reordered.splice(index, 0, groupKey);
  return reordered;
};

export class GroupTrait {
  /**
   * Reading direction of a date grouping. Kept in a signal so the UI can flip
   * it, and mirrored from the stored `groupBy.sort` so a reload reads the same
   * way round.
   */
  sortAsc$ = signal(true);

  groupInfo$ = computed<GroupInfo | undefined>(() => {
    const groupBy = this.groupBy$.value;
    if (!groupBy) {
      return;
    }
    const property = this.view.propertyGetOrCreate(groupBy.columnId);
    if (!property) {
      return;
    }
    const tType = property.dataType$.value;
    if (!tType) {
      return;
    }
    const groupByService = getGroupByService(this.view.manager.dataSource);
    // The stored name wins: a date property offers several grains and only the
    // name says which one was chosen. Matching on the type alone would snap a
    // "by month" grouping back to the default grain on every reload.
    const result =
      (groupBy.name != null
        ? findGroupByConfigByName(this.view.manager.dataSource, groupBy.name)
        : undefined) ?? groupByService?.matcher.match(tType);
    if (!result) {
      return;
    }
    return {
      config: result,
      property,
      tType: tType,
    };
  });

  staticInfo$ = computed(() => {
    const groupInfo = this.groupInfo$.value;
    if (!groupInfo) {
      return;
    }
    const staticMap = Object.fromEntries(
      groupInfo.config
        .defaultKeys(groupInfo.tType)
        .map(({ key, value }) => [key, new Group(key, value, groupInfo, this)])
    );
    return {
      staticMap,
      groupInfo,
    };
  });

  groupDataMap$ = computed(() => {
    const staticInfo = this.staticInfo$.value;
    if (!staticInfo) {
      return;
    }
    const { staticMap, groupInfo } = staticInfo;
    const groupMap: Record<string, Group> = {};
    Object.entries(staticMap).forEach(([key, group]) => {
      groupMap[key] = new Group(key, group.value, groupInfo, this);
    });
    this.view.rows$.value.forEach(row => {
      const value = this.view.cellGetOrCreate(row.rowId, groupInfo.property.id)
        .jsonValue$.value;
      const keys = groupInfo.config.valuesGroup(value, groupInfo.tType);
      keys.forEach(({ key, value }) => {
        if (!groupMap[key]) {
          groupMap[key] = new Group(key, value, groupInfo, this);
        }
        groupMap[key].rows.push(row);
      });
    });
    return groupMap;
  });

  groupsDataList$ = computedLock(
    computed(() => {
      const groupMap = this.groupDataMap$.value;
      if (!groupMap) {
        return;
      }
      const sortedGroup = orderGroupKeys(
        Object.keys(groupMap),
        this.groupInfo$.value,
        this.ops.sortGroup,
        this.sortAsc$.value
      );
      sortedGroup.forEach(key => {
        if (!groupMap[key]) return;
        groupMap[key].rows = this.ops.sortRow(key, groupMap[key].rows);
      });
      return sortedGroup
        .map(key => groupMap[key])
        .filter((v): v is Group => v != null);
    }),
    this.view.isLocked$
  );

  updateData = (data: NonNullable<unknown>) => {
    const property = this.property$.value;
    if (!property) {
      return;
    }
    this.view.propertyGetOrCreate(property.id).dataUpdate(() => data);
  };

  get addGroup() {
    return this.property$.value?.meta$.value?.config.addGroup;
  }

  property$ = computed(() => {
    const groupInfo = this.groupInfo$.value;
    if (!groupInfo) {
      return;
    }
    return groupInfo.property;
  });

  constructor(
    private readonly groupBy$: ReadonlySignal<GroupBy | undefined>,
    public view: SingleView,
    private readonly ops: {
      groupBySet: (groupBy: GroupBy | undefined) => void;
      sortGroup: (keys: string[]) => string[];
      sortRow: (groupKey: string, rows: Row[]) => Row[];
      changeGroupSort: (keys: string[]) => void;
      changeRowSort: (
        groupKeys: string[],
        groupKey: string,
        keys: string[]
      ) => void;
    }
  ) {
    // Mirror the stored reading direction into the signal the UI drives.
    effect(() => {
      const desc = this.groupBy$.value?.sort?.desc;
      if (desc != null && this.sortAsc$.value === desc) {
        this.sortAsc$.value = !desc;
      }
    });
  }

  /**
   * Whether the current grouping reads a date property, and so offers grains
   * and a reading direction rather than a manual group order.
   */
  isDateGroup$ = computed(() => isDateGroupInfo(this.groupInfo$.value));

  /**
   * Re-read the same property at another grain — relative, day, week, month,
   * year — keeping the reading direction.
   */
  changeGroupMode(modeName: string) {
    const propertyId = this.property$.value?.id;
    if (!propertyId) {
      return;
    }
    this.ops.groupBySet({
      type: 'groupBy',
      columnId: propertyId,
      name: modeName,
      sort: { desc: !this.sortAsc$.value },
    });
  }

  /**
   * Flip a date grouping between oldest-first and newest-first.
   */
  setDateSortOrder(asc: boolean) {
    this.sortAsc$.value = asc;
    const groupBy = this.groupBy$.value;
    if (groupBy) {
      this.ops.groupBySet({ ...groupBy, sort: { desc: !asc } });
    }
  }

  addToGroup(rowId: string, key: string) {
    this.view.lockRows(false);
    const groupMap = this.groupDataMap$.value;
    const groupInfo = this.groupInfo$.value;
    if (!groupMap || !groupInfo) {
      return;
    }
    const addTo = groupInfo.config.addToGroup;
    if (addTo === false) {
      return;
    }
    const v = groupMap[key]?.value;
    if (v != null) {
      const newValue = addTo(
        v,
        this.view.cellGetOrCreate(rowId, groupInfo.property.id).jsonValue$.value
      );
      this.view
        .cellGetOrCreate(rowId, groupInfo.property.id)
        .valueSet(newValue);
    }
  }

  changeCardSort(groupKey: string, cardIds: string[]) {
    const groups = this.groupsDataList$.value;
    if (!groups) {
      return;
    }
    this.ops.changeRowSort(
      groups.map(v => v.key),
      groupKey,
      cardIds
    );
  }

  changeGroup(columnId: string | undefined) {
    if (columnId == null) {
      this.ops.groupBySet(undefined);
      return;
    }
    const column = this.view.propertyGetOrCreate(columnId);
    const propertyMeta = this.view.manager.dataSource.propertyMetaGet(
      column.type$.value
    );
    if (propertyMeta) {
      const groupBy = defaultGroupBy(
        this.view.manager.dataSource,
        propertyMeta,
        column.id,
        column.data$.value
      );
      if (groupBy) {
        groupBy.sort = { desc: !this.sortAsc$.value };
      }
      this.ops.groupBySet(groupBy);
    }
  }

  changeGroupSort(keys: string[]) {
    this.ops.changeGroupSort(keys);
  }

  defaultGroupProperty(key: string): GroupProperty {
    return {
      key,
      hide: false,
      manuallyCardSort: [],
    };
  }

  moveCardTo(
    rowId: string,
    fromGroupKey: string | undefined,
    toGroupKey: string,
    position: InsertToPosition
  ) {
    this.view.lockRows(false);
    const groupMap = this.groupDataMap$.value;
    if (!groupMap) {
      return;
    }
    if (fromGroupKey !== toGroupKey) {
      const propertyId = this.property$.value?.id;
      if (!propertyId) {
        return;
      }
      const remove =
        this.groupInfo$.value?.config.removeFromGroup ?? (() => null);
      const group = fromGroupKey != null ? groupMap[fromGroupKey] : undefined;
      let newValue: unknown = null;
      if (group) {
        newValue = remove(
          group.value,
          this.view.cellGetOrCreate(rowId, propertyId).jsonValue$.value
        );
      }
      const addTo = this.groupInfo$.value?.config.addToGroup;
      if (addTo === false || addTo == null) {
        return;
      }
      newValue = addTo(groupMap[toGroupKey]?.value ?? null, newValue);
      this.view.cellGetOrCreate(rowId, propertyId).jsonValueSet(newValue);
    }
    const rows =
      groupMap[toGroupKey]?.rows
        .filter(row => row.rowId !== rowId)
        .map(row => row.rowId) ?? [];
    const index = insertPositionToIndex(position, rows, row => row);
    rows.splice(index, 0, rowId);
    this.changeCardSort(toGroupKey, rows);
  }

  moveGroupTo(groupKey: string, position: InsertToPosition) {
    this.view.lockRows(false);
    const groups = this.groupsDataList$.value;
    if (!groups) {
      return;
    }
    const currentKeys = groups.map(v => v.key);
    const reorderedKeys = reorderGroupKeys(currentKeys, groupKey, position);
    if (
      currentKeys.length === reorderedKeys.length &&
      currentKeys.every((key, index) => key === reorderedKeys[index])
    ) {
      return;
    }
    this.changeGroupSort(reorderedKeys);
  }

  removeFromGroup(rowId: string, key: string) {
    this.view.lockRows(false);
    const groupMap = this.groupDataMap$.value;
    if (!groupMap) {
      return;
    }
    const propertyId = this.property$.value?.id;
    if (!propertyId) {
      return;
    }
    const remove =
      this.groupInfo$.value?.config.removeFromGroup ?? (() => undefined);
    const newValue = remove(
      groupMap[key]?.value ?? null,
      this.view.cellGetOrCreate(rowId, propertyId).jsonValue$.value
    );
    this.view.cellGetOrCreate(rowId, propertyId).valueSet(newValue);
  }

  updateValue(rows: string[], value: unknown) {
    this.view.lockRows(false);
    const propertyId = this.property$.value?.id;
    if (!propertyId) {
      return;
    }
    rows.forEach(rowId => {
      this.view.cellGetOrCreate(rowId, propertyId).jsonValueSet(value);
    });
  }
}

export const groupTraitKey = createTraitKey<GroupTrait>('group');

export const sortByManually = <T>(
  arr: T[],
  getId: (v: T) => string,
  ids: string[]
) => {
  const map = new Map(arr.map(v => [getId(v), v]));
  const result: T[] = [];
  for (const id of ids) {
    const value = map.get(id);
    if (value) {
      map.delete(id);
      result.push(value);
    }
  }
  result.push(...map.values());
  return result;
};
