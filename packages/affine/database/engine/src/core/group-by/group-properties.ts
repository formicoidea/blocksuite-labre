import type { GroupProperty } from '../common/types.js';
import type { Row } from '../view-manager/row.js';
import { sortByManually } from './trait.js';

/**
 * The group ops every grouped preset hands its `GroupTrait`, over the view's
 * stored `groupProperties` (the shape table and kanban have always stored:
 * `{ key, hide, manuallyCardSort }`). One copy for table, kanban, gallery and
 * list (ADR 0035 §8, B8), so a hidden group and a manual order read and write
 * the same way in every view.
 *
 * Every write lists the entry of every group key it is given, so a hidden
 * group keeps its `hide` and its card order through a reorder; nothing is
 * written when the value would not change.
 */
export const groupPropertiesOps = (
  read: () => GroupProperty[],
  write: (groupProperties: GroupProperty[]) => void
) => {
  const entries = () => new Map(read().map(v => [v.key, v]));
  const entry = (map: Map<string, GroupProperty>, key: string): GroupProperty =>
    map.get(key) ?? { key, hide: false, manuallyCardSort: [] };
  const groupHidden = (key: string) =>
    read().find(v => v.key === key)?.hide === true;
  return {
    sortGroup: (keys: string[]) =>
      sortByManually(
        keys,
        v => v,
        read().map(v => v.key)
      ),
    sortRow: (key: string, rows: Row[]) =>
      sortByManually(
        rows,
        v => v.rowId,
        read().find(v => v.key === key)?.manuallyCardSort ?? []
      ),
    changeGroupSort: (keys: string[]) => {
      const map = entries();
      write(keys.map(key => entry(map, key)));
    },
    changeRowSort: (groupKeys: string[], groupKey: string, keys: string[]) => {
      const map = entries();
      write(
        groupKeys.map(key =>
          key === groupKey
            ? { ...entry(map, key), manuallyCardSort: keys }
            : entry(map, key)
        )
      );
    },
    groupHidden,
    groupHideSet: (groupKeys: string[], groupKey: string, hide: boolean) => {
      if (groupHidden(groupKey) === hide) return;
      const map = entries();
      write(
        groupKeys.map(key =>
          key === groupKey ? { ...entry(map, key), hide } : entry(map, key)
        )
      );
    },
  };
};
