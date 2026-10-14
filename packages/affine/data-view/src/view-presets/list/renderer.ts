import { createIcon } from '../../core/utils/uni-icon.js';
import type { DataViewUILogicBaseConstructor } from '../../core/view/data-view-base.js';
import { listViewModel } from './define.js';
import { ListViewUILogic } from './list-view.js';

// One UI for both: the chips wrap under the title on a narrow screen.
export const listViewMeta = listViewModel.createMeta({
  icon: createIcon('DatabaseListViewIcon'),
  pcLogic: () => ListViewUILogic as unknown as DataViewUILogicBaseConstructor,
});
