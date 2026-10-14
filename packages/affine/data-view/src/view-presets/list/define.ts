import { viewType } from '../../core/view/data-view.js';
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
  defaultName: 'List View',
  dataViewManager: ListSingleView,
  defaultData: flatViewDefaultData,
});
