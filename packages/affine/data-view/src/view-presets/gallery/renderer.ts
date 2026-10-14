import { createIcon } from '../../core/utils/uni-icon.js';
import type { DataViewUILogicBaseConstructor } from '../../core/view/data-view-base.js';
import { galleryViewModel } from './define.js';
import { GalleryViewUILogic } from './gallery-view.js';

// One UI for both: the cards reflow, and a tap opens the row or edits a value.
export const galleryViewMeta = galleryViewModel.createMeta({
  icon: createIcon('GridIcon'),
  pcLogic: () =>
    GalleryViewUILogic as unknown as DataViewUILogicBaseConstructor,
});
