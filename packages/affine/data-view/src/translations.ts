import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * This package's own wordings, declared beside the code that renders them:
 * the gallery and list presets' chrome (ADR 0035 §1, B6 and B7). The table and
 * kanban presets still draw upstream's literals ("New Record"), held by the
 * literal ratchet's baseline. The open button says the components' "Open"
 * (`OPEN_LABEL`), one chrome word, one key.
 */

/** The "New page" card of a gallery and row of a list: adds a row, opens it. */
export const DATA_VIEW_NEW_PAGE: ChromeWording = [
  'com.labre.data-view.new-page',
  'New page',
];

/**
 * Every wording declared above, walked by `PACKAGE_WORDINGS` in
 * `packages/affine/all/src/translations.ts`.
 */
export const DATA_VIEW_WORDINGS: readonly ChromeWording[] = [
  DATA_VIEW_NEW_PAGE,
];
