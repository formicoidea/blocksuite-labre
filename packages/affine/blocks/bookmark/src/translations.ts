import {
  type ChromeWording,
  TOOLBAR_LINK,
} from '@labre/affine-shared/services';

/**
 * The slash-menu "Link" item: `nameWording` doubles as its tooltip's
 * `captionWording` — the same word names the item and captions the
 * illustration (`configs/slash-menu.ts`). An alias (L7 dedupe): the same word
 * as {@link TOOLBAR_LINK}, one key.
 */
export const BOOKMARK_SLASH_NAME = TOOLBAR_LINK;

export const BOOKMARK_SLASH_DESCRIPTION: ChromeWording = [
  'com.labre.bookmark.slash.description',
  'Add a bookmark for reference.',
];

/** The create-link modal's title and body (`configs/slash-menu.ts`). */
export const BOOKMARK_MODAL_TITLE: ChromeWording = [
  'com.labre.bookmark.modal.title',
  'Links',
];

export const BOOKMARK_MODAL_DESCRIPTION: ChromeWording = [
  'com.labre.bookmark.modal.description',
  'The added link will be displayed as a card view.',
];

/** The card's decorative `alt` text (`components/bookmark-card.ts`). */
export const BOOKMARK_ALT_ICON: ChromeWording = [
  'com.labre.bookmark.card.alt-icon',
  'icon',
];

export const BOOKMARK_ALT_BANNER: ChromeWording = [
  'com.labre.bookmark.card.alt-banner',
  'banner',
];

/** The card's title, once loaded, when the link preview has none. */
export const BOOKMARK_LINK_CARD_FALLBACK: ChromeWording = [
  'com.labre.bookmark.card.link-fallback',
  'Link card',
];

export const BOOKMARK_RETRIEVE_FAILED: ChromeWording = [
  'com.labre.bookmark.card.retrieve-failed',
  'Failed to retrieve link information.',
];

/**
 * This package's contribution to the translation-key manifest, listed in
 * `PACKAGE_WORDINGS` under source `chrome`
 * (`packages/affine/all/src/translations.ts`). The shared verbs it reuses
 * (Caption, Reload, the card-style switcher's four wordings…) travel with
 * `@labre/affine-shared/services` instead, so they are not restated here.
 */
export const BOOKMARK_WORDINGS: readonly ChromeWording[] = [
  BOOKMARK_SLASH_DESCRIPTION,
  BOOKMARK_MODAL_TITLE,
  BOOKMARK_MODAL_DESCRIPTION,
  BOOKMARK_ALT_ICON,
  BOOKMARK_ALT_BANNER,
  BOOKMARK_LINK_CARD_FALLBACK,
  BOOKMARK_RETRIEVE_FAILED,
];
