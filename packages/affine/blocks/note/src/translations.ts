import {
  BLOCK_NAME_BULLETED_LIST,
  BLOCK_NAME_CODE_BLOCK,
  BLOCK_NAME_DIVIDER,
  BLOCK_NAME_HEADING_1,
  BLOCK_NAME_HEADING_2,
  BLOCK_NAME_HEADING_3,
  BLOCK_NAME_HEADING_4,
  BLOCK_NAME_HEADING_5,
  BLOCK_NAME_HEADING_6,
  BLOCK_NAME_NUMBERED_LIST,
  BLOCK_NAME_QUOTE,
  BLOCK_NAME_TEXT,
  BLOCK_NAME_TODO_LIST,
  BOARD_BORDER_STYLE_LABEL,
  type ChromeWording,
  DISPLAY_MODE_BOTH,
  DISPLAY_MODE_EDGELESS,
  DISPLAY_MODE_PAGE,
  DISPLAY_MODE_SHOW_IN,
  FILL_COLOR_LABEL,
  NOTE_SHADOW_BOX,
  NOTE_SHADOW_FILM,
  NOTE_SHADOW_NONE,
  NOTE_SHADOW_PAPER,
  NOTE_SHADOW_STICKER,
  TEXT_FORMAT_BOLD,
  TEXT_FORMAT_ITALIC,
  TEXT_FORMAT_STRIKETHROUGH,
  TEXT_FORMAT_UNDERLINE,
  TOOLBAR_MOVE_DOWN,
  TOOLBAR_MOVE_UP,
} from '@labre/affine-shared/services';

/**
 * This package's own wordings, declared beside the code that renders them —
 * the note block's edgeless style panel, its slash-menu tooltip captions,
 * and the surface toolbar's notifications. Words this package shares with
 * ANOTHER of this lot's packages (the block-type names, the shadow options,
 * the two move verbs, and — L7 dedupe — the bold/italic/underline/
 * strikethrough formats, the border-style label, the fill-colour label and
 * the display-mode words) live in `chrome.ts` instead and are re-exported or
 * reused here; see the doc comment on each.
 */

/* ── Slash-menu tooltip captions (`./configs/tooltips.ts`) ────────────────
 * The heading captions say "Heading #N" — with the hash — which is NOT the
 * same literal as the block-type name "Heading N" used elsewhere (the
 * paragraph placeholder, the gfx/note menu), so they keep their own keys
 * rather than reusing `BLOCK_NAME_HEADING_N`.
 */

export const NOTE_TOOLTIP_HEADING_1: ChromeWording = [
  'com.labre.note.tooltip.heading-1',
  'Heading #1',
];

export const NOTE_TOOLTIP_HEADING_2: ChromeWording = [
  'com.labre.note.tooltip.heading-2',
  'Heading #2',
];

export const NOTE_TOOLTIP_HEADING_3: ChromeWording = [
  'com.labre.note.tooltip.heading-3',
  'Heading #3',
];

export const NOTE_TOOLTIP_HEADING_4: ChromeWording = [
  'com.labre.note.tooltip.heading-4',
  'Heading #4',
];

export const NOTE_TOOLTIP_HEADING_5: ChromeWording = [
  'com.labre.note.tooltip.heading-5',
  'Heading #5',
];

export const NOTE_TOOLTIP_HEADING_6: ChromeWording = [
  'com.labre.note.tooltip.heading-6',
  'Heading #6',
];

export const NOTE_TOOLTIP_BOLD_TEXT: ChromeWording = [
  'com.labre.note.tooltip.bold-text',
  'Bold Text',
];

/** An alias (L7 dedupe): the same word as {@link TEXT_FORMAT_ITALIC}, one key. */
export const NOTE_TOOLTIP_ITALIC = TEXT_FORMAT_ITALIC;

/** An alias (L7 dedupe): the same word as {@link TEXT_FORMAT_UNDERLINE}, one key. */
export const NOTE_TOOLTIP_UNDERLINE = TEXT_FORMAT_UNDERLINE;

/** An alias (L7 dedupe): the same word as {@link TEXT_FORMAT_STRIKETHROUGH}, one key. */
export const NOTE_TOOLTIP_STRIKETHROUGH = TEXT_FORMAT_STRIKETHROUGH;

/* ── Slash-menu items rendered by THIS package (`./configs/slash-menu.ts`) ─
 * `createConversionItem` / `createTextFormatItem` borrow their `name` from
 * `textConversionConfigs` / `textFormatConfigs` (`@labre/affine-rich-text` /
 * `@labre/affine-inline-preset`, both outside this lot) — the literal itself
 * is out of scope, but the NAME each produces is one this package already has
 * a wording for (the block-type names shared in `chrome.ts`, or the format
 * names below), so the item still resolves through the seam by looking the
 * borrowed name up in `NOTE_SLASH_ITEM_NAME_WORDINGS`.
 */

/** An alias (L7 dedupe): the same word as {@link TEXT_FORMAT_BOLD}, one key. */
export const NOTE_SLASH_FORMAT_BOLD = TEXT_FORMAT_BOLD;

/** An alias (L7 dedupe): the same word as {@link TEXT_FORMAT_ITALIC}, one key. */
export const NOTE_SLASH_FORMAT_ITALIC = TEXT_FORMAT_ITALIC;

/** An alias (L7 dedupe): the same word as {@link TEXT_FORMAT_UNDERLINE}, one key. */
export const NOTE_SLASH_FORMAT_UNDERLINE = TEXT_FORMAT_UNDERLINE;

/** An alias (L7 dedupe): the same word as {@link TEXT_FORMAT_STRIKETHROUGH}, one key. */
export const NOTE_SLASH_FORMAT_STRIKETHROUGH = TEXT_FORMAT_STRIKETHROUGH;

export const NOTE_OTHER_HEADINGS: ChromeWording = [
  'com.labre.note.slash-menu.other-headings',
  'Other Headings',
];

/**
 * `name` -> wording, for every conversion/format item this package's slash
 * menu can offer. Reuses `BLOCK_NAME_*` (this lot's shared block-type names)
 * where the borrowed `name` matches one, and this file's own format-name
 * wordings otherwise.
 */
export const NOTE_SLASH_ITEM_NAME_WORDINGS: Readonly<
  Record<string, ChromeWording>
> = {
  Text: BLOCK_NAME_TEXT,
  'Heading 1': BLOCK_NAME_HEADING_1,
  'Heading 2': BLOCK_NAME_HEADING_2,
  'Heading 3': BLOCK_NAME_HEADING_3,
  'Heading 4': BLOCK_NAME_HEADING_4,
  'Heading 5': BLOCK_NAME_HEADING_5,
  'Heading 6': BLOCK_NAME_HEADING_6,
  'Code Block': BLOCK_NAME_CODE_BLOCK,
  Quote: BLOCK_NAME_QUOTE,
  Divider: BLOCK_NAME_DIVIDER,
  'Bulleted List': BLOCK_NAME_BULLETED_LIST,
  'Numbered List': BLOCK_NAME_NUMBERED_LIST,
  'To-do List': BLOCK_NAME_TODO_LIST,
  Bold: NOTE_SLASH_FORMAT_BOLD,
  Italic: NOTE_SLASH_FORMAT_ITALIC,
  Underline: NOTE_SLASH_FORMAT_UNDERLINE,
  Strikethrough: NOTE_SLASH_FORMAT_STRIKETHROUGH,
};

/* ── Move up / down (`./move-block.ts`) ────────────────────────────────── */

export { TOOLBAR_MOVE_DOWN as NOTE_MOVE_DOWN, TOOLBAR_MOVE_UP as NOTE_MOVE_UP };

/* ── Note shadow menu (`./components/edgeless-note-shadow-menu.ts`) ─────── */

export {
  NOTE_SHADOW_BOX,
  NOTE_SHADOW_FILM,
  NOTE_SHADOW_NONE,
  NOTE_SHADOW_PAPER,
  NOTE_SHADOW_STICKER,
};

export const NOTE_SHADOW_FLOATING: ChromeWording = [
  'com.labre.note.shadow.floating',
  'Floating shadow',
];

/* ── Note style panel (`./components/edgeless-note-style-panel.ts`) ─────── */

/** An alias (L7 dedupe): the same word as {@link FILL_COLOR_LABEL}, one key. */
export const NOTE_STYLE_FILL_COLOR = FILL_COLOR_LABEL;

export const NOTE_STYLE_SHADOW_SECTION: ChromeWording = [
  'com.labre.note.style.shadow',
  'Shadow',
];

export const NOTE_STYLE_BORDER_SECTION: ChromeWording = [
  'com.labre.note.style.border',
  'Border',
];

export const NOTE_STYLE_CORNER_RADIUS: ChromeWording = [
  'com.labre.note.style.corner-radius',
  'Corner Radius',
];

export const NOTE_STYLE_BACK: ChromeWording = [
  'com.labre.note.style.back',
  'Back',
];

export const NOTE_STYLE_CUSTOM_COLOR: ChromeWording = [
  'com.labre.note.style.custom-color',
  'Custom color',
];

export const NOTE_STYLE_PANEL_LABEL: ChromeWording = [
  'com.labre.note.style.panel-label',
  'Note Style',
];

/* ── Border dropdown (`./components/edgeless-note-border-dropdown-menu.ts`) */

/**
 * An alias (L7 dedupe): the same word as {@link BOARD_BORDER_STYLE_LABEL},
 * one key.
 */
export const NOTE_BORDER_STYLE_LABEL = BOARD_BORDER_STYLE_LABEL;

/* ── Display-mode dropdown (`./components/edgeless-note-display-mode-dropdown-menu.ts`) */

/** An alias (L7 dedupe): the same word as {@link DISPLAY_MODE_SHOW_IN}, one key. */
export const NOTE_DISPLAY_MODE_SHOW_IN = DISPLAY_MODE_SHOW_IN;

export const NOTE_DISPLAY_MODE_LABEL: ChromeWording = [
  'com.labre.note.display-mode.mode-label',
  'Mode',
];

export const NOTE_DISPLAY_MODE_TOOLTIP: ChromeWording = [
  'com.labre.note.display-mode.tooltip',
  'Display mode',
];

/** An alias (L7 dedupe): the same word as {@link DISPLAY_MODE_BOTH}, one key. */
export const NOTE_DISPLAY_MODE_BOTH = DISPLAY_MODE_BOTH;

/** An alias (L7 dedupe): the same word as {@link DISPLAY_MODE_EDGELESS}, one key. */
export const NOTE_DISPLAY_MODE_EDGELESS = DISPLAY_MODE_EDGELESS;

/** An alias (L7 dedupe): the same word as {@link DISPLAY_MODE_PAGE}, one key. */
export const NOTE_DISPLAY_MODE_PAGE = DISPLAY_MODE_PAGE;

/* ── Surface toolbar (`./configs/toolbar.ts`) ─────────────────────────────
 * The two "note is on the page" toasts. The removed-from-page title reuses
 * `TOAST_NOTE_REMOVED_FROM_PAGE` (already in `chrome.ts`); its opposite gets
 * its own key here. Each toast's BODY bakes in the trailing "Find it in the
 * TOC…" sentence rather than composing it at the call site — one full
 * sentence per key, never a fragment plus a suffix.
 */

export const NOTE_TOAST_DISPLAYED_IN_PAGE_MODE: ChromeWording = [
  'com.labre.note.toast.displayed-in-page-mode',
  'Note displayed in Page Mode',
];

export const NOTE_TOAST_REMOVED_FROM_PAGE_BODY: ChromeWording = [
  'com.labre.note.toast.removed-from-page.body',
  'Content removed from your page. Find it in the TOC for quick navigation.',
];

export const NOTE_TOAST_ADDED_TO_PAGE_BODY: ChromeWording = [
  'com.labre.note.toast.added-to-page.body',
  'Content added to your page. Find it in the TOC for quick navigation.',
];

export const NOTE_TOAST_VIEW_IN_TOC: ChromeWording = [
  'com.labre.note.toast.view-in-toc',
  'View in Toc',
];

export const NOTE_TOOLBAR_DISPLAY_IN_PAGE: ChromeWording = [
  'com.labre.note.toolbar.display-in-page',
  'Display in Page',
];

export const NOTE_TOOLBAR_DISPLAYED_IN_PAGE: ChromeWording = [
  'com.labre.note.toolbar.displayed-in-page',
  'Displayed in Page',
];

export const NOTE_TOOLBAR_REMOVE_FROM_PAGE_TOOLTIP: ChromeWording = [
  'com.labre.note.toolbar.remove-from-page-tooltip',
  'This note is part of Page Mode. Click to remove it from the page.',
];

export const NOTE_TOOLBAR_SLICER: ChromeWording = [
  'com.labre.note.toolbar.slicer',
  'Slicer',
];

export const NOTE_TOOLBAR_CUTTING_MODE: ChromeWording = [
  'com.labre.note.toolbar.cutting-mode',
  'Cutting mode',
];

export const NOTE_TOOLBAR_SIZE: ChromeWording = [
  'com.labre.note.toolbar.size',
  'Size',
];
export const NOTE_TOOLBAR_AUTO_HEIGHT: ChromeWording = [
  'com.labre.note.toolbar.auto-height',
  'Auto height',
];

export const NOTE_TOOLBAR_CUSTOMIZED_HEIGHT: ChromeWording = [
  'com.labre.note.toolbar.customized-height',
  'Customized height',
];

/**
 * Every wording DECLARED IN THIS FILE (not re-exported from `chrome.ts`), in
 * declaration order — walked by `PACKAGE_WORDINGS` in
 * `packages/affine/all/src/translations.ts`. The chrome re-exports
 * (`NOTE_MOVE_UP`/`_DOWN`, `NOTE_SHADOW_*` other than `_FLOATING`, and — L7
 * dedupe — `NOTE_TOOLTIP_ITALIC`/`_UNDERLINE`/`_STRIKETHROUGH`,
 * `NOTE_SLASH_FORMAT_BOLD`/`_ITALIC`/`_UNDERLINE`/`_STRIKETHROUGH`,
 * `NOTE_STYLE_FILL_COLOR`, `NOTE_BORDER_STYLE_LABEL`,
 * `NOTE_DISPLAY_MODE_SHOW_IN`/`_BOTH`/`_EDGELESS`/`_PAGE`) are not listed
 * again here, same rule `SLASH_MENU_WORDINGS` already follows for its own
 * chrome aliases.
 */
export const NOTE_WORDINGS: readonly ChromeWording[] = [
  NOTE_TOOLTIP_HEADING_1,
  NOTE_TOOLTIP_HEADING_2,
  NOTE_TOOLTIP_HEADING_3,
  NOTE_TOOLTIP_HEADING_4,
  NOTE_TOOLTIP_HEADING_5,
  NOTE_TOOLTIP_HEADING_6,
  NOTE_TOOLTIP_BOLD_TEXT,
  NOTE_OTHER_HEADINGS,
  NOTE_SHADOW_FLOATING,
  NOTE_STYLE_SHADOW_SECTION,
  NOTE_STYLE_BORDER_SECTION,
  NOTE_STYLE_CORNER_RADIUS,
  NOTE_STYLE_BACK,
  NOTE_STYLE_CUSTOM_COLOR,
  NOTE_STYLE_PANEL_LABEL,
  NOTE_DISPLAY_MODE_LABEL,
  NOTE_DISPLAY_MODE_TOOLTIP,
  NOTE_TOAST_DISPLAYED_IN_PAGE_MODE,
  NOTE_TOAST_REMOVED_FROM_PAGE_BODY,
  NOTE_TOAST_ADDED_TO_PAGE_BODY,
  NOTE_TOAST_VIEW_IN_TOC,
  NOTE_TOOLBAR_DISPLAY_IN_PAGE,
  NOTE_TOOLBAR_DISPLAYED_IN_PAGE,
  NOTE_TOOLBAR_REMOVE_FROM_PAGE_TOOLTIP,
  NOTE_TOOLBAR_SLICER,
  NOTE_TOOLBAR_CUTTING_MODE,
  NOTE_TOOLBAR_SIZE,
  NOTE_TOOLBAR_AUTO_HEIGHT,
  NOTE_TOOLBAR_CUSTOMIZED_HEIGHT,
];
