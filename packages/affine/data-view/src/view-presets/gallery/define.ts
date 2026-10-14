import { viewType } from '../../core/view/data-view.js';
import {
  FlatSingleView,
  type FlatViewDataType,
  flatViewDefaultData,
} from '../flat/flat-view-manager.js';

export const galleryViewType = viewType('gallery');

export type GalleryViewData = FlatViewDataType<typeof galleryViewType.type>;

export class GallerySingleView extends FlatSingleView<GalleryViewData> {
  override get type(): string {
    return this.data$.value?.mode ?? galleryViewType.type;
  }
}

export const galleryViewModel = galleryViewType.createModel<GalleryViewData>({
  defaultName: 'Gallery View',
  dataViewManager: GallerySingleView,
  defaultData: flatViewDefaultData,
});
