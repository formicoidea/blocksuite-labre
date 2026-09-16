import {
  type ChromeWording,
  TEXT_FORMAT_BOLD,
  TEXT_FORMAT_ITALIC,
  TEXT_FORMAT_STRIKETHROUGH,
  TEXT_FORMAT_UNDERLINE,
  TOOLBAR_LINK,
} from '@labre/affine-shared/services';

/**
 * `@labre/affine-inline-preset`'s own wordings — `command/config.ts`'s
 * `textFormatConfigs`. This is DATA (no `std` of its own): `name` is
 * consumed as the format bar's tooltip by `blocks/root/src/configs/toolbar.ts`
 * (a different lot), the same "static config rendered by a widget" pattern
 * the slash menu already uses — a `nameWording` sibling next to `name`,
 * resolved by whichever widget renders the entry.
 *
 * "Link" reuses `TOOLBAR_LINK` (`chrome.ts`) rather than minting a second key
 * for the same word. `TEXT_FORMAT_BOLD`/`_ITALIC`/`_UNDERLINE`/
 * `_STRIKETHROUGH` (L7 dedupe: shared verbatim with `blocks/note`'s own
 * slash-menu items and tooltips) are declared once in `chrome.ts` and
 * re-exported here under this package's own name; only "Code" stays this
 * format's own.
 */
export {
  TEXT_FORMAT_BOLD,
  TEXT_FORMAT_ITALIC,
  TEXT_FORMAT_UNDERLINE,
  TEXT_FORMAT_STRIKETHROUGH,
};

export const TEXT_FORMAT_CODE: ChromeWording = [
  'com.labre.text-format.code',
  'Code',
];
export const TEXT_FORMAT_LINK: ChromeWording = TOOLBAR_LINK;

/**
 * Every wording DECLARED IN THIS FILE (not re-exported from `chrome.ts`), in
 * declaration order — walked by `PACKAGE_WORDINGS` in
 * `packages/affine/all/src/translations.ts`.
 */
export const PRESET_WORDINGS: readonly ChromeWording[] = [TEXT_FORMAT_CODE];
