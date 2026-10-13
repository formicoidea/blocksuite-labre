import type { ChromeWording } from '@labre/affine-shared/services';

/** The note-index badge's two tooltips, in page vs. edgeless-only mode. */
export const AUTO_CONNECT_HIDDEN_ON_PAGE: ChromeWording = [
  'com.labre.auto-connect.hidden-on-page',
  'Hidden on page',
];

export const AUTO_CONNECT_PAGE_MODE_INDEX: ChromeWording = [
  'com.labre.auto-connect.page-mode-index',
  'Page mode index',
];

/** Every wording this package declares, in the order it renders them. */
export const AUTO_CONNECT_WORDINGS: readonly ChromeWording[] = [
  AUTO_CONNECT_HIDDEN_ON_PAGE,
  AUTO_CONNECT_PAGE_MODE_INDEX,
];
