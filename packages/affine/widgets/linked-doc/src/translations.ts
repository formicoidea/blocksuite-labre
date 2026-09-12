import {
  type ChromeWording,
  DOC_UNTITLED,
  FORMAT_HTML,
  FORMAT_MARKDOWN,
} from '@labre/affine-shared/services';

/**
 * The "@" menu's own wordings — the linked-doc/new-doc popover (desktop and
 * mobile) and the import dialog it opens. `DOC_UNTITLED` / `FORMAT_MARKDOWN`
 * / `FORMAT_HTML` are declared once in `chrome.ts` (shared with the outline
 * panel and the adapter/debug panel) and re-exported here under this
 * package's own name.
 */
export const LINKED_DOC_UNTITLED = DOC_UNTITLED;
export const LINKED_DOC_FORMAT_MARKDOWN = FORMAT_MARKDOWN;
export const LINKED_DOC_FORMAT_HTML = FORMAT_HTML;

/* ── Popover groups (config.ts) ─────────────────────────────────────────── */

export const LINKED_DOC_LINK_TO_DOC: ChromeWording = [
  'com.labre.linked-doc.group.link-to-doc',
  'Link to Doc',
];

export const LINKED_DOC_NEW_DOC: ChromeWording = [
  'com.labre.linked-doc.group.new-doc',
  'New Doc',
];

/**
 * The "Import" item's own wording — shared, verbatim, by the popover's menu
 * item (`config.ts`) and the two header titles of the modal it opens
 * (`import-doc/import-doc.ts`, loading and normal states): the exact same
 * word, in the same package.
 */
export const LINKED_DOC_IMPORT: ChromeWording = [
  'com.labre.linked-doc.import',
  'Import',
];

/** The "Create doc" item's own wording, interpolated with the truncated name. */
export const LINKED_DOC_CREATE_DOC: ChromeWording = [
  'com.labre.linked-doc.create-doc',
  'Create "{{name}}" doc',
];

/**
 * The import-success toast — `{{count}}` interpolated, the English fallback
 * kept neutral (the brief's "don't hand-roll a plural" rule) rather than the
 * manual `Doc${count > 1 ? 's' : ''}` the literal used to compute.
 */
export const LINKED_DOC_IMPORT_SUCCESS_TOAST: ChromeWording = [
  'com.labre.linked-doc.import-success',
  'Successfully imported {{count}} Doc(s).',
];

/**
 * The overflow item's own fallback label ("N more docs" is a different
 * string, resolved by the framework the group came from — this is the bare
 * word an EMPTY `overflowText` falls back to), said identically by the
 * desktop popover and the mobile menu.
 */
export const LINKED_DOC_OVERFLOW_MORE: ChromeWording = [
  'com.labre.linked-doc.overflow-more',
  'more',
];

/* ── Import dialog (import-doc/import-doc.ts) ──────────────────────────── */

export const LINKED_DOC_IMPORT_NOTION_MARKDOWN_DEPRECATED: ChromeWording = [
  'com.labre.linked-doc.import.notion-markdown-deprecated',
  'Importing markdown files from Notion is deprecated. Please export your Notion pages as HTML.',
];

export const LINKED_DOC_IMPORT_LOADING: ChromeWording = [
  'com.labre.linked-doc.import.loading',
  'Importing the file may take some time. It depends on document size and complexity.',
];

/**
 * PO decision (2026-09-12): the brand "AFFiNE" — inherited verbatim from the
 * fork — is replaced by "Labre" here and in
 * {@link LINKED_DOC_IMPORT_NOTION_HELP_TOOLTIP}, the ONE deliberate exception
 * to "fallback = the existing English literal, to the letter": the sentence
 * names the wrong product otherwise.
 */
export const LINKED_DOC_IMPORT_INTRO: ChromeWording = [
  'com.labre.linked-doc.import.intro',
  'Labre will gradually support more file formats for import.',
];

export const LINKED_DOC_IMPORT_FEEDBACK_LINK: ChromeWording = [
  'com.labre.linked-doc.import.feedback-link',
  'Provide feedback.',
];

/** A proper noun kept in English (glossary convention), still keyed. */
export const LINKED_DOC_IMPORT_FORMAT_NOTION: ChromeWording = [
  'com.labre.linked-doc.import.format-notion',
  'Notion',
];

/** Brand swap, same PO decision — see {@link LINKED_DOC_IMPORT_INTRO}. */
export const LINKED_DOC_IMPORT_NOTION_HELP_TOOLTIP: ChromeWording = [
  'com.labre.linked-doc.import.notion-help-tooltip',
  'Learn how to Import your Notion pages into Labre.',
];

export const LINKED_DOC_IMPORT_COMING_SOON: ChromeWording = [
  'com.labre.linked-doc.import.coming-soon',
  'Coming soon...',
];

/** Every wording this package DECLARES (see `SHAPE_WORDINGS`'s own note). */
export const LINKED_DOC_WORDINGS: readonly ChromeWording[] = [
  LINKED_DOC_LINK_TO_DOC,
  LINKED_DOC_NEW_DOC,
  LINKED_DOC_IMPORT,
  LINKED_DOC_CREATE_DOC,
  LINKED_DOC_IMPORT_SUCCESS_TOAST,
  LINKED_DOC_OVERFLOW_MORE,
  LINKED_DOC_IMPORT_NOTION_MARKDOWN_DEPRECATED,
  LINKED_DOC_IMPORT_LOADING,
  LINKED_DOC_IMPORT_INTRO,
  LINKED_DOC_IMPORT_FEEDBACK_LINK,
  LINKED_DOC_IMPORT_FORMAT_NOTION,
  LINKED_DOC_IMPORT_NOTION_HELP_TOOLTIP,
  LINKED_DOC_IMPORT_COMING_SOON,
];
