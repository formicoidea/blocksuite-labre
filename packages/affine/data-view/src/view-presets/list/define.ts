import { viewType } from '../../core/view/data-view.js';
import { VIEW_NAME_LIST } from '../../translations.js';
import {
  FlatSingleView,
  type FlatViewDataType,
  flatViewDefaultData,
} from '../flat/flat-view-manager.js';

export const listViewType = viewType('list');

export type ListViewData = FlatViewDataType<typeof listViewType.type>;

export class ListSingleView extends FlatSingleView<ListViewData> {
  override get type(): string {
    return this.data$.value?.mode ?? listViewType.type;
  }
}

export const listViewModel = listViewType.createModel<ListViewData>({
  defaultName: VIEW_NAME_LIST[1],
  defaultNameKey: VIEW_NAME_LIST[0],
  dataViewManager: ListSingleView,
  defaultData: flatViewDefaultData,
});
