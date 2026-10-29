import type { GroupBy } from '../../core/common/types.js';
import type { FilterGroup } from '../../core/filter/types.js';
import type { Sort } from '../../core/sort/types.js';
import type { ViewConvertConfig } from '../../core/view/convert.js';
import type { DataViewDataType } from '../../core/view/data-view.js';
import { galleryViewModel } from '../gallery/define.js';
import { kanbanViewModel } from '../kanban/define.js';
import { listViewModel } from '../list/define.js';
import { tableViewModel } from '../table/define.js';

/**
 * A layout switch into or out of a gallery or a list keeps the filter, the
 * sort and the grouping (B8: every layout groups, as table and kanban already
 * kept `groupBy` between them); the properties shown are the target layout's
 * own default, as when Notion switches a view's layout. A source with no
 * grouping leaves the target's default: a kanban still gets its own.
 */
const keepFilterSortAndGroup = (
  data: DataViewDataType
): Partial<DataViewDataType> => {
  const { filter, sort, groupBy } = data as {
    filter?: FilterGroup;
    sort?: Sort;
    groupBy?: GroupBy;
  };
  // View data is an open record per mode: the target model types the rest.
  return {
    ...(filter ? { filter } : {}),
    ...(sort ? { sort } : {}),
    ...(groupBy ? { groupBy } : {}),
  } as Partial<DataViewDataType>;
};

const flatModels = [galleryViewModel, listViewModel];

const convert = (from: string, to: string): ViewConvertConfig => ({
  from,
  to,
  convert: keepFilterSortAndGroup,
});

export const flatViewConverts: ViewConvertConfig[] = [
  ...[tableViewModel, kanbanViewModel, ...flatModels]
    .flatMap(from => flatModels.map(to => [from.type, to.type] as const))
    .filter(([from, to]) => from !== to)
    .map(([from, to]) => convert(from, to)),
  ...flatModels.flatMap(from =>
    [tableViewModel, kanbanViewModel].map(to => convert(from.type, to.type))
  ),
];
