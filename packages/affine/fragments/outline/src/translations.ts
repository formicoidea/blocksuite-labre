import {
  ATTACHMENT_LABEL,
  BLOCK_TYPE_CODE_BLOCK,
  type ChromeWording,
  CHROME_DELETED_DOC,
  DISPLAY_MODE_BOTH,
  DISPLAY_MODE_EDGELESS,
  DISPLAY_MODE_PAGE,
  DISPLAY_MODE_SHOW_IN,
  IMAGE_LABEL,
  PREVIEW_SETTINGS_LABEL,
  TOOLBAR_SETTINGS,
} from '@labre/affine-shared/services';

/**
 * The outline (plan) panel's own wordings: the placeholder text a preview
 * card shows in place of an empty bookmark title, code language, database
 * title, image caption or attachment name.
 *
 * Declared here rather than restated in `outline-preview.ts` so the manifest
 * (`@labre/affine/translations`, `PACKAGE_WORDINGS`) can walk them — see
 * `packages/affine/shared/src/services/translation-service/README.md`.
 */
export const OUTLINE_PLACEHOLDER_BOOKMARK: ChromeWording = [
  'com.labre.outline.placeholder.bookmark',
  'Bookmark',
];

export const OUTLINE_PLACEHOLDER_CODE = BLOCK_TYPE_CODE_BLOCK;

export const OUTLINE_PLACEHOLDER_DATABASE: ChromeWording = [
  'com.labre.outline.placeholder.database',
  'Database',
];

export const OUTLINE_PLACEHOLDER_IMAGE = IMAGE_LABEL;

export const OUTLINE_PLACEHOLDER_ATTACHMENT = ATTACHMENT_LABEL;

/* ── Notice banner (edgeless-only content hidden in page mode) ────────── */

export const OUTLINE_NOTICE_HIDDEN_LABEL: ChromeWording = [
  'com.labre.outline.notice.hidden-label',
  'SOME CONTENTS HIDDEN',
];

export const OUTLINE_NOTICE_HIDDEN_TEXT: ChromeWording = [
  'com.labre.outline.notice.hidden-text',
  'Some contents are not visible on edgeless.',
];

/**
 * The banner's call to action, said around a sort icon. The icon carries no
 * text of its own and cannot be interpolated into a `translateKey` param, so
 * rather than translate the two half-sentences either side of it separately
 * — the split `manifest.unit.spec.ts` and the brief both warn against — the
 * icon is rendered BEFORE the (now whole) sentence instead of in the middle
 * of it.
 */
export const OUTLINE_NOTICE_ORGANIZE: ChromeWording = [
  'com.labre.outline.notice.organize',
  'Click here or to organize content.',
];

/* ── Panel body ─────────────────────────────────────────────────────────── */

export const OUTLINE_EMPTY_PANEL: ChromeWording = [
  'com.labre.outline.empty-panel',
  'Use headings to create a table of contents.',
];

export const OUTLINE_HIDDEN_CONTENTS: ChromeWording = [
  'com.labre.outline.hidden-contents',
  'Hidden Contents',
];

/* ── Note card ──────────────────────────────────────────────────────────── */

export const OUTLINE_MODE_BOTH = DISPLAY_MODE_BOTH;

export const OUTLINE_MODE_EDGELESS = DISPLAY_MODE_EDGELESS;

export const OUTLINE_MODE_PAGE = DISPLAY_MODE_PAGE;

export const OUTLINE_CARD_SHOW_IN = DISPLAY_MODE_SHOW_IN;

export const OUTLINE_CARD_DISPLAY_MODE_TOOLTIP: ChromeWording = [
  'com.labre.outline.card.display-mode-tooltip',
  'Display Mode',
];

/* ── Block preview ──────────────────────────────────────────────────────── */

export const OUTLINE_PREVIEW_DELETED_DOC = CHROME_DELETED_DOC;

/* ── Header ─────────────────────────────────────────────────────────────── */

/**
 * Shared by the full panel's header AND the floating mini-viewer's own header
 * (`outline-viewer.ts`) — the exact same title over the exact same list.
 */
export const OUTLINE_TABLE_OF_CONTENTS: ChromeWording = [
  'com.labre.outline.table-of-contents',
  'Table of Contents',
];

export const OUTLINE_PREVIEW_SETTINGS_TOOLTIP = PREVIEW_SETTINGS_LABEL;

export const OUTLINE_VISIBILITY_AND_SORT_TOOLTIP: ChromeWording = [
  'com.labre.outline.visibility-and-sort-tooltip',
  'Visibility and sort',
];

/* ── Preview settings menu ──────────────────────────────────────────────── */

export const OUTLINE_SETTINGS_LABEL = TOOLBAR_SETTINGS;

export const OUTLINE_SHOW_TYPE_ICON: ChromeWording = [
  'com.labre.outline.setting-menu.show-type-icon',
  'Show type icon',
];

/* ── Floating mini-viewer ───────────────────────────────────────────────── */

export const OUTLINE_OPEN_IN_SIDEBAR_TOOLTIP: ChromeWording = [
  'com.labre.outline.viewer.open-in-sidebar',
  'Open in sidebar',
];

/**
 * Every wording DECLARED IN THIS FILE (not re-exported from `chrome.ts`), in
 * the order it renders them. L7 dedupe aliased `OUTLINE_PLACEHOLDER_CODE`/
 * `_IMAGE`/`_ATTACHMENT`, `OUTLINE_MODE_BOTH`/`_EDGELESS`/`_PAGE`,
 * `OUTLINE_CARD_SHOW_IN`, `OUTLINE_PREVIEW_DELETED_DOC`,
 * `OUTLINE_PREVIEW_SETTINGS_TOOLTIP` and `OUTLINE_SETTINGS_LABEL` to
 * `chrome.ts` wordings — not listed again here, same rule the note/slash-menu
 * packages' own chrome aliases already follow.
 */
export const OUTLINE_WORDINGS: readonly ChromeWording[] = [
  OUTLINE_PLACEHOLDER_BOOKMARK,
  OUTLINE_PLACEHOLDER_DATABASE,
  OUTLINE_NOTICE_HIDDEN_LABEL,
  OUTLINE_NOTICE_HIDDEN_TEXT,
  OUTLINE_NOTICE_ORGANIZE,
  OUTLINE_EMPTY_PANEL,
  OUTLINE_HIDDEN_CONTENTS,
  OUTLINE_CARD_DISPLAY_MODE_TOOLTIP,
  OUTLINE_TABLE_OF_CONTENTS,
  OUTLINE_VISIBILITY_AND_SORT_TOOLTIP,
  OUTLINE_SHOW_TYPE_ICON,
  OUTLINE_OPEN_IN_SIDEBAR_TOOLTIP,
];
