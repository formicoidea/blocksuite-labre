import type { FilterGroup } from '../../core/filter/types.js';
import type { Sort } from '../../core/sort/types.js';
import type { ViewConvertConfig } from '../../core/view/convert.js';
import type { DataViewDataType } from '../../core/view/data-view.js';
import { calendarViewModel } from '../calendar/define.js';
import { galleryViewModel } from '../gallery/define.js';
import { kanbanViewModel } from '../kanban/define.js';
import { listViewModel } from '../list/define.js';
import { tableViewModel } from '../table/define.js';

/**
 * A layout switch into or out of a gallery or a list keeps the filter and the
 * sort; the properties shown are the target layout's own default, as when
 * Notion switches a view's layout. Calendar is a source only: nothing
 * converts into it (ADR 0035 §6).
 */
const keepFilterAndSort = (
  data: DataViewDataType
): Partial<DataViewDataType> => {
  const { filter, sort } = data as { filter?: FilterGroup; sort?: Sort };
  // View data is an open record per mode: the target model types the rest.
  return {
    ...(filter ? { filter } : {}),
    ...(sort ? { sort } : {}),
  } as Partial<DataViewDataType>;
};

const flatModels = [galleryViewModel, listViewModel];

const convert = (from: string, to: string): ViewConvertConfig => ({
  from,
  to,
  convert: keepFilterAndSort,
});

export const flatViewConverts: ViewConvertConfig[] = [
  ...[tableViewModel, kanbanViewModel, calendarViewModel, ...flatModels]
    .flatMap(from => flatModels.map(to => [from.type, to.type] as const))
    .filter(([from, to]) => from !== to)
    .map(([from, to]) => convert(from, to)),
  ...flatModels.flatMap(from =>
    [tableViewModel, kanbanViewModel].map(to => convert(from.type, to.type))
  ),
];
