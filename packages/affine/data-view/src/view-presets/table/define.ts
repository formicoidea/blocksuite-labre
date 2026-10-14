import type { GroupBy, GroupProperty } from '../../core/common/types.js';
import type { FilterGroup } from '../../core/filter/types.js';
import type { Sort } from '../../core/sort/types.js';
import { type BasicViewDataType, viewType } from '../../core/view/data-view.js';
import { VIEW_NAME_TABLE } from '../../translations.js';
import { TableSingleView } from './table-view-manager.js';

export const tableViewType = viewType('table');

export type TableViewColumn = {
  id: string;
  width: number;
  statCalcType?: string;
  hide?: boolean;
};
type DataType = {
  columns: TableViewColumn[];
  filter: FilterGroup;
  groupBy?: GroupBy;
  groupProperties?: GroupProperty[];
  sort?: Sort;
  header?: {
    titleColumn?: string;
    iconColumn?: string;
    imageColumn?: string;
  };
};
export type TableViewData = BasicViewDataType<
  typeof tableViewType.type,
  DataType
>;
export const tableViewModel = tableViewType.createModel<TableViewData>({
  defaultName: VIEW_NAME_TABLE[1],
  defaultNameKey: VIEW_NAME_TABLE[0],
  dataViewManager: TableSingleView,
  defaultData: viewManager => {
    return {
      mode: 'table',
      columns: [],
      filter: {
        type: 'group',
        op: 'and',
        conditions: [],
      },
      header: {
        titleColumn: viewManager.dataSource.properties$.value.find(
          id => viewManager.dataSource.propertyTypeGet(id) === 'title'
        ),
        iconColumn: 'type',
      },
    };
  },
});
