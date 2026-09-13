import {
  type ChromeWording,
  PREVIEW_LABEL,
  TOOLBAR_CAPTION,
  TOOLBAR_COMMENT,
  TOOLBAR_DELETE,
  TOOLBAR_DUPLICATE,
  TOOLBAR_MORE,
} from '@labre/affine-shared/services';

/**
 * This package's own wordings, declared beside the code that renders them —
 * the code block's own chrome (the "Plain Text" language fallback, the copy
 * failure toast) and its floating toolbar / "⋮" menu. Verbs the editor
 * already shares everywhere ("More", "Duplicate", "Delete") are re-exported
 * from `chrome.ts` instead of declared again.
 */

export {
  TOOLBAR_DELETE as CODE_TOOLBAR_DELETE,
  TOOLBAR_DUPLICATE as CODE_TOOLBAR_DUPLICATE,
  TOOLBAR_MORE as CODE_TOOLBAR_MORE,
};

/* ── `./code-block.ts` ────────────────────────────────────────────────────
 * "Plain Text" is the fallback name shown when the block has no language, or
 * its language id isn't found among the bundled ones — both branches say the
 * exact same word, one key.
 */

export const CODE_PLAIN_TEXT_LANGUAGE: ChromeWording = [
  'com.labre.code.language.plain-text',
  'Plain Text',
];

export const CODE_COPY_FAILED: ChromeWording = [
  'com.labre.code.toast.copy-failed',
  'Copied failed, something went wrong',
];

/* ── `./code-toolbar/components/lang-button.ts` ──────────────────────────── */

export const CODE_SEARCH_FOR_LANGUAGE: ChromeWording = [
  'com.labre.code.language.search-placeholder',
  'Search for a language',
];

/* ── `./code-toolbar/components/preview-button.ts` ───────────────────────── */

export const CODE_PREVIEW_TOGGLE_CODE: ChromeWording = [
  'com.labre.code.preview.toggle-code',
  'Code',
];

export const CODE_PREVIEW_TOGGLE_PREVIEW = PREVIEW_LABEL;

/* ── `./code-toolbar/config.ts` — the floating toolbar's buttons ─────────── */

export const CODE_TOOLBAR_COPY_CODE: ChromeWording = [
  'com.labre.code.toolbar.copy-code',
  'Copy code',
];

export const CODE_TOOLBAR_EXPAND: ChromeWording = [
  'com.labre.code.toolbar.expand',
  'Expand code',
];

export const CODE_TOOLBAR_COLLAPSE: ChromeWording = [
  'com.labre.code.toolbar.collapse',
  'Collapse code',
];

export const CODE_TOOLBAR_CAPTION = TOOLBAR_CAPTION;

/** PO decision: "Comment" (code toolbar) gets a key. */
export const CODE_TOOLBAR_COMMENT = TOOLBAR_COMMENT;

/* ── `./code-toolbar/config.ts` — the "⋮" more menu ───────────────────────── */

export const CODE_TOOLBAR_CANCEL_WRAP: ChromeWording = [
  'com.labre.code.toolbar.cancel-wrap',
  'Cancel wrap',
];

export const CODE_TOOLBAR_WRAP: ChromeWording = [
  'com.labre.code.toolbar.wrap',
  'Wrap',
];

export const CODE_TOOLBAR_CANCEL_LINE_NUMBER: ChromeWording = [
  'com.labre.code.toolbar.cancel-line-number',
  'Cancel line number',
];

export const CODE_TOOLBAR_LINE_NUMBER: ChromeWording = [
  'com.labre.code.toolbar.line-number',
  'Line number',
];

/**
 * Every wording DECLARED IN THIS FILE (not re-exported from `chrome.ts`), in
 * declaration order — walked by `PACKAGE_WORDINGS` in
 * `packages/affine/all/src/translations.ts`.
 */
export const CODE_WORDINGS: readonly ChromeWording[] = [
  CODE_PLAIN_TEXT_LANGUAGE,
  CODE_COPY_FAILED,
  CODE_SEARCH_FOR_LANGUAGE,
  CODE_PREVIEW_TOGGLE_CODE,
  CODE_TOOLBAR_COPY_CODE,
  CODE_TOOLBAR_EXPAND,
  CODE_TOOLBAR_COLLAPSE,
  CODE_TOOLBAR_CANCEL_WRAP,
  CODE_TOOLBAR_WRAP,
  CODE_TOOLBAR_CANCEL_LINE_NUMBER,
  CODE_TOOLBAR_LINE_NUMBER,
];
