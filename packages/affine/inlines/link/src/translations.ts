import {
  type ChromeWording,
  TOOLBAR_EDIT,
  TOOLBAR_LINK,
  TOOLBAR_REMOVE_LINK,
} from '@labre/affine-shared/services';

/**
 * `@labre/affine-inline-link`'s own wordings — the inline link's toolbar
 * (`configs/toolbar.ts`) and its create/edit popup (`link-popup/link-popup.ts`).
 * `LINK_TOOLBAR_EDIT` / `LINK_TOOLBAR_REMOVE_LINK` (L7 dedupe: shared verbatim
 * with the generic iframe embed's error state / the root block's edgeless
 * "More" sub-menu) are declared once in `chrome.ts` and re-exported here
 * under this package's own name.
 */

export const LINK_TOOLBAR_COPY_LINK: ChromeWording = [
  'com.labre.inline-link.toolbar.copy-link',
  'Copy link',
];
export const LINK_TOOLBAR_COPIED_TOAST: ChromeWording = [
  'com.labre.inline-link.toolbar.copied-toast',
  'Copied link to clipboard',
];
export const LINK_TOOLBAR_EDIT = TOOLBAR_EDIT;
export const LINK_TOOLBAR_REMOVE_LINK = TOOLBAR_REMOVE_LINK;

export const LINK_POPUP_LINK_PLACEHOLDER: ChromeWording = [
  'com.labre.inline-link.popup.link-placeholder',
  'Paste or type a link',
];
export const LINK_POPUP_TEXT_PLACEHOLDER: ChromeWording = [
  'com.labre.inline-link.popup.text-placeholder',
  'Enter text',
];
export const LINK_POPUP_TEXT_LABEL: ChromeWording = [
  'com.labre.inline-link.popup.text-label',
  'Text',
];
/** An alias (L7 dedupe): the same word as {@link TOOLBAR_LINK}, one key. */
export const LINK_POPUP_LINK_LABEL = TOOLBAR_LINK;

/**
 * Every wording declared above, in declaration order — walked by
 * `PACKAGE_WORDINGS` in `packages/affine/all/src/translations.ts`.
 */
export const LINK_WORDINGS: readonly ChromeWording[] = [
  LINK_TOOLBAR_COPY_LINK,
  LINK_TOOLBAR_COPIED_TOAST,
  LINK_POPUP_LINK_PLACEHOLDER,
  LINK_POPUP_TEXT_PLACEHOLDER,
  LINK_POPUP_TEXT_LABEL,
];
