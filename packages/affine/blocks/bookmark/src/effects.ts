import { BookmarkBlockComponent } from './bookmark-block';
import { BookmarkEdgelessBlockComponent } from './bookmark-edgeless-block';
import { BookmarkCard } from './components/bookmark-card';
import {
  BOOKMARK_IMPORT_BUTTON_TAG,
  BookmarkImportButton,
} from './components/import-page-button';

export function effects() {
  customElements.define(
    'affine-edgeless-bookmark',
    BookmarkEdgelessBlockComponent
  );
  customElements.define('affine-bookmark', BookmarkBlockComponent);
  customElements.define('bookmark-card', BookmarkCard);
  customElements.define(BOOKMARK_IMPORT_BUTTON_TAG, BookmarkImportButton);
}
