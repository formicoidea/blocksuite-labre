import {
  ACTION_CANCEL,
  ACTION_CONFIRM,
  type ChromeWording,
  COLOR_LABEL,
  FILL_COLOR_LABEL,
  ICON_BUTTON_COMING_SOON,
  TOOLBAR_RELOAD,
} from '@labre/affine-shared/services';

/**
 * `@labre/affine-components`'s own wordings — the placeholders, aria-labels,
 * toasts and button captions of the shared panels rendered by many blocks
 * (image/attachment resource popovers, embed-card modals, colour and icon
 * pickers, the generic context menu…).
 *
 * Most of these components have no `std` of their own (they are leaves with
 * no framework context, reused across blocks this lot does not own). Where a
 * component genuinely renders inside the editor's DOM (a popup, a modal, a
 * slotted panel) it now consumes `stdContext` — the SAME seam
 * `caption/block-caption.ts` already used — so a host's catalogue reaches it
 * with zero change to the (out-of-lot) callers that render it; with no
 * provider registered (or truly detached, e.g. a story) `std` stays
 * `undefined` and the component reads exactly as it did before any of this
 * existed.
 */

/* ── Caption ──────────────────────────────────────────────────────────── */

export const CAPTION_PLACEHOLDER: ChromeWording = [
  'com.labre.caption.placeholder',
  'Write a caption',
];

/* ── Card style / view switcher ──────────────────────────────────────── */

export const CARD_STYLE_LABEL: ChromeWording = [
  'com.labre.embed.card-style.label',
  'Card style',
];

/* ── Citation card ───────────────────────────────────────────────────── */

export const FAVICON_ALT: ChromeWording = [
  'com.labre.citation.favicon-alt',
  'favicon',
];

/* ── Colour picker (edgeless custom colour) ─────────────────────────── */

export const COLOR_PICKER_TAB_COLORS: ChromeWording = [
  'com.labre.color-picker.tab.colors',
  'Colors',
];
export const COLOR_PICKER_TAB_CUSTOM: ChromeWording = [
  'com.labre.color-picker.tab.custom',
  'Custom',
];
export const COLOR_PICKER_MODE_NORMAL: ChromeWording = [
  'com.labre.color-picker.mode.normal',
  'Normal',
];
export const COLOR_PICKER_MODE_LIGHT: ChromeWording = [
  'com.labre.color-picker.mode.light',
  'Light',
];
export const COLOR_PICKER_MODE_DARK: ChromeWording = [
  'com.labre.color-picker.mode.dark',
  'Dark',
];

/* ── Shape colour picker ─────────────────────────────────────────────── */

export { COLOR_LABEL, FILL_COLOR_LABEL };
export const BORDER_COLOR_LABEL: ChromeWording = [
  'com.labre.color.border-color',
  'Border color',
];

/* ── Context menu (generic popup used by slash menu, right-click menus…) */

export const CONTEXT_MENU_NO_RESULTS: ChromeWording = [
  'com.labre.context-menu.no-results',
  'No Results',
];
export const CONTEXT_MENU_DONE: ChromeWording = [
  'com.labre.context-menu.done',
  'Done',
];

/* ── Edgeless line style / width panels ─────────────────────────────── */

export const LINE_STYLE_SOLID: ChromeWording = [
  'com.labre.line-style.solid',
  'Solid',
];
export const LINE_STYLE_DASH: ChromeWording = [
  'com.labre.line-style.dash',
  'Dash',
];
export const LINE_STYLE_NONE: ChromeWording = [
  'com.labre.line-style.none',
  'None',
];
export const LINE_WIDTH_THICKNESS: ChromeWording = [
  'com.labre.line-width.thickness',
  'Thickness',
];

/* ── Embed card modals (create / edit) ───────────────────────────────── */

export const EMBED_CARD_INVALID_LINK: ChromeWording = [
  'com.labre.embed.card.invalid-link',
  'Invalid link',
];
export const EMBED_CARD_LINK_PLACEHOLDER: ChromeWording = [
  'com.labre.embed.card.link-placeholder',
  'Input in https://...',
];
export const EMBED_CARD_TITLE_EMPTY: ChromeWording = [
  'com.labre.embed.card.title-empty',
  'Title can not be empty',
];
export const EMBED_CARD_TITLE_ALIAS_PLACEHOLDER: ChromeWording = [
  'com.labre.embed.card.title-alias-placeholder',
  'Add title alias',
];
export const EMBED_CARD_DESCRIPTION_ALIAS_PLACEHOLDER: ChromeWording = [
  'com.labre.embed.card.description-alias-placeholder',
  'Add description alias (empty to inherit document content)',
];
export const EMBED_CARD_TITLE_PLACEHOLDER: ChromeWording = [
  'com.labre.embed.card.title-placeholder',
  'Write a title',
];
export const EMBED_CARD_DESCRIPTION_PLACEHOLDER: ChromeWording = [
  'com.labre.embed.card.description-placeholder',
  'Write a description...',
];

/**
 * Generic verbs shared by the two embed-card modals and reused, within this
 * same lot, by the inline reference popup (`@labre/affine-inline-reference`
 * already depends on this package) — the exact same words, so one key each
 * rather than a second "Reset"/"Save" minted per package.
 */
export const CONFIRM_LABEL = ACTION_CONFIRM;
export const CANCEL_LABEL = ACTION_CANCEL;
export const SAVE_LABEL: ChromeWording = ['com.labre.action.save', 'Save'];
export const RESET_LABEL: ChromeWording = ['com.labre.action.reset', 'Reset'];

/* ── Filterable list (generic search list: @ mention, slash menu…) ───── */

export const FILTERABLE_LIST_SEARCH_PLACEHOLDER: ChromeWording = [
  'com.labre.filterable-list.search-placeholder',
  'Search',
];

/* ── Highlight (text colour) dropdown ────────────────────────────────── */

export const HIGHLIGHT_LABEL: ChromeWording = [
  'com.labre.highlight.label',
  'Highlight',
];
export const HIGHLIGHT_BACKGROUND_LABEL: ChromeWording = [
  'com.labre.highlight.background-label',
  'Background',
];
export const HIGHLIGHT_DEFAULT_FOREGROUND: ChromeWording = [
  'com.labre.highlight.option.default-foreground',
  'default color',
];
export const HIGHLIGHT_DEFAULT_BACKGROUND: ChromeWording = [
  'com.labre.highlight.option.default-background',
  'default background',
];

/**
 * The colour names shared by the highlight menu's foreground/background
 * lists AND the icon picker's tint swatches (`icon-data.ts`) — the same
 * closed palette rendered as a word in one place and a `title=` in the
 * other, so one key per colour rather than two.
 */
export const COLOR_NAME_RED: ChromeWording = [
  'com.labre.color-name.red',
  'red',
];
export const COLOR_NAME_ORANGE: ChromeWording = [
  'com.labre.color-name.orange',
  'orange',
];
export const COLOR_NAME_YELLOW: ChromeWording = [
  'com.labre.color-name.yellow',
  'yellow',
];
export const COLOR_NAME_GREEN: ChromeWording = [
  'com.labre.color-name.green',
  'green',
];
export const COLOR_NAME_TEAL: ChromeWording = [
  'com.labre.color-name.teal',
  'teal',
];
export const COLOR_NAME_BLUE: ChromeWording = [
  'com.labre.color-name.blue',
  'blue',
];
export const COLOR_NAME_PURPLE: ChromeWording = [
  'com.labre.color-name.purple',
  'purple',
];
export const COLOR_NAME_GREY: ChromeWording = [
  'com.labre.color-name.grey',
  'grey',
];
export const COLOR_NAME_MAGENTA: ChromeWording = [
  'com.labre.color-name.magenta',
  'magenta',
];

/** Keyed by the raw colour id both `highlight-dropdown-menu` and `icon-data` use. */
export const COLOR_NAME_WORDINGS: Readonly<Record<string, ChromeWording>> = {
  red: COLOR_NAME_RED,
  orange: COLOR_NAME_ORANGE,
  yellow: COLOR_NAME_YELLOW,
  green: COLOR_NAME_GREEN,
  teal: COLOR_NAME_TEAL,
  blue: COLOR_NAME_BLUE,
  purple: COLOR_NAME_PURPLE,
  grey: COLOR_NAME_GREY,
  magenta: COLOR_NAME_MAGENTA,
};

/* ── Icon / emoji picker ──────────────────────────────────────────────── */

export const ICON_PICKER_FILTER_PLACEHOLDER: ChromeWording = [
  'com.labre.icon-picker.filter-placeholder',
  'Filter...',
];
export const ICON_PICKER_NO_ICON_FOUND: ChromeWording = [
  'com.labre.icon-picker.no-icon-found',
  'No icon found',
];
export const ICON_PICKER_NO_EMOJI_FOUND: ChromeWording = [
  'com.labre.icon-picker.no-emoji-found',
  'No emoji found',
];
export const ICON_PICKER_ICONS_GROUP: ChromeWording = [
  'com.labre.icon-picker.icons-group',
  'Icons',
];
export const ICON_PICKER_RECENT_GROUP: ChromeWording = [
  'com.labre.icon-picker.recent-group',
  'Recent',
];
export const ICON_PICKER_TAB_EMOJI: ChromeWording = [
  'com.labre.icon-picker.tab.emoji',
  'Emoji',
];
export const ICON_PICKER_REMOVE: ChromeWording = [
  'com.labre.icon-picker.remove',
  'Remove',
];

/**
 * The eight emoji-mart categories `emoji-data.ts`'s `GROUP_ORDER` names, in
 * the same order.
 */
export const EMOJI_GROUP_PEOPLE: ChromeWording = [
  'com.labre.emoji-group.people',
  'Smileys & People',
];
export const EMOJI_GROUP_NATURE: ChromeWording = [
  'com.labre.emoji-group.nature',
  'Animals & Nature',
];
export const EMOJI_GROUP_FOODS: ChromeWording = [
  'com.labre.emoji-group.foods',
  'Food & Drink',
];
export const EMOJI_GROUP_ACTIVITY: ChromeWording = [
  'com.labre.emoji-group.activity',
  'Activity',
];
export const EMOJI_GROUP_PLACES: ChromeWording = [
  'com.labre.emoji-group.places',
  'Travel & Places',
];
export const EMOJI_GROUP_OBJECTS: ChromeWording = [
  'com.labre.emoji-group.objects',
  'Objects',
];
export const EMOJI_GROUP_SYMBOLS: ChromeWording = [
  'com.labre.emoji-group.symbols',
  'Symbols',
];
export const EMOJI_GROUP_FLAGS: ChromeWording = [
  'com.labre.emoji-group.flags',
  'Flags',
];

/** Keyed by `emoji-data.ts`'s own group id (`people`, `nature`…). */
export const EMOJI_GROUP_WORDINGS: Readonly<Record<string, ChromeWording>> = {
  people: EMOJI_GROUP_PEOPLE,
  nature: EMOJI_GROUP_NATURE,
  foods: EMOJI_GROUP_FOODS,
  activity: EMOJI_GROUP_ACTIVITY,
  places: EMOJI_GROUP_PLACES,
  objects: EMOJI_GROUP_OBJECTS,
  symbols: EMOJI_GROUP_SYMBOLS,
  flags: EMOJI_GROUP_FLAGS,
};

/* ── Linked doc title chip ───────────────────────────────────────────── */

export const DOC_TITLE_ARIA: ChromeWording = [
  'com.labre.linked-doc.title-aria',
  'Doc title',
];

/* ── Linked-doc notifications ─────────────────────────────────────────── */

export const NOTIFY_SWITCHED_TO_CARD_TITLE: ChromeWording = [
  'com.labre.notify.linked-doc.switched-to-card.title',
  'View Updated',
];
export const NOTIFY_SWITCHED_TO_CARD_MESSAGE: ChromeWording = [
  'com.labre.notify.linked-doc.switched-to-card.message',
  'The alias modification has disabled sync. The embed has been updated to a card view.',
];
export const NOTIFY_SWITCHED_TO_EMBED_TITLE: ChromeWording = [
  'com.labre.notify.linked-doc.switched-to-embed.title',
  'Embed View Restored',
];
export const NOTIFY_SWITCHED_TO_EMBED_MESSAGE: ChromeWording = [
  'com.labre.notify.linked-doc.switched-to-embed.message',
  'Custom alias removed. The linked doc now displays the original title and description.',
];
export const NOTIFY_CLEARED_ALIASES_TITLE: ChromeWording = [
  'com.labre.notify.linked-doc.cleared-aliases.title',
  'Reset successful',
];
export const NOTIFY_CLEARED_ALIASES_MESSAGE: ChromeWording = [
  'com.labre.notify.linked-doc.cleared-aliases.message',
  'Card view has been restored to original doc title and description. All custom aliases have been removed.',
];

/* ── Open-doc dropdown ────────────────────────────────────────────────── */

export const OPEN_LABEL: ChromeWording = ['com.labre.open-doc.open', 'Open'];
export const OPEN_DOC_MENU_ARIA: ChromeWording = [
  'com.labre.open-doc.menu-aria',
  'Open doc menu',
];
export const OPEN_DOC_WITH_ARIA: ChromeWording = [
  'com.labre.open-doc.with-aria',
  'Open doc with',
];

/* ── Resource popover (attachment / image not-found or retrieve error) ─ */

/**
 * `resource.ts`'s `ResourceController.blob()` interpolates a KIND word into
 * two sentences ("Image not found", "Failed to retrieve Image"). `kind` is a
 * closed set (`ResourceKind`: `'Blob' | 'File' | 'Image'`), so — per the
 * brief's own guidance for exactly this shape — this is one key per
 * kind×message (six keys) rather than two keys with a `{{kind}}` parameter:
 * the seam has no grammar, and "Image not found" reads better translated
 * whole than word-by-word recomposed from an English noun the host never
 * chose to inline.
 */
export const RESOURCE_BLOB_NOT_FOUND: ChromeWording = [
  'com.labre.resource.not-found.blob',
  'Blob not found',
];
export const RESOURCE_FILE_NOT_FOUND: ChromeWording = [
  'com.labre.resource.not-found.file',
  'File not found',
];
export const RESOURCE_IMAGE_NOT_FOUND: ChromeWording = [
  'com.labre.resource.not-found.image',
  'Image not found',
];
export const RESOURCE_BLOB_RETRIEVE_FAILED: ChromeWording = [
  'com.labre.resource.retrieve-failed.blob',
  'Failed to retrieve Blob',
];
export const RESOURCE_FILE_RETRIEVE_FAILED: ChromeWording = [
  'com.labre.resource.retrieve-failed.file',
  'Failed to retrieve File',
];
export const RESOURCE_IMAGE_RETRIEVE_FAILED: ChromeWording = [
  'com.labre.resource.retrieve-failed.image',
  'Failed to retrieve Image',
];

/** Keyed by `ResourceKind` (`'Blob' | 'File' | 'Image'`). */
export const RESOURCE_NOT_FOUND_WORDINGS: Readonly<
  Record<string, ChromeWording>
> = {
  Blob: RESOURCE_BLOB_NOT_FOUND,
  File: RESOURCE_FILE_NOT_FOUND,
  Image: RESOURCE_IMAGE_NOT_FOUND,
};
export const RESOURCE_RETRIEVE_FAILED_WORDINGS: Readonly<
  Record<string, ChromeWording>
> = {
  Blob: RESOURCE_BLOB_RETRIEVE_FAILED,
  File: RESOURCE_FILE_RETRIEVE_FAILED,
  Image: RESOURCE_IMAGE_RETRIEVE_FAILED,
};

/**
 * `status.ts`'s popover header — the same closed-set choice: `needUpload`
 * picks between exactly two sentences, so two whole keys rather than one
 * with a `{{type}}` hole.
 */
export const RESOURCE_STATUS_UPLOAD_FAILED: ChromeWording = [
  'com.labre.resource.status.upload-failed',
  'Upload failed',
];
export const RESOURCE_STATUS_DOWNLOAD_FAILED: ChromeWording = [
  'com.labre.resource.status.download-failed',
  'Download failed',
];
export const RESOURCE_STATUS_RETRY: ChromeWording = [
  'com.labre.resource.status.retry',
  'Retry',
];
export const RESOURCE_STATUS_RELOAD = TOOLBAR_RELOAD;

/* ── Size (scale) dropdown ────────────────────────────────────────────── */

export const SIZE_LABEL_SCALE: ChromeWording = [
  'com.labre.size-dropdown.label',
  'Scale',
];

/* ── Toggle (expand/collapse) button ─────────────────────────────────── */

export const TOGGLE_EXPAND_ARIA: ChromeWording = [
  'com.labre.toggle.expand-aria',
  'Expand content',
];
export const TOGGLE_COLLAPSE_ARIA: ChromeWording = [
  'com.labre.toggle.collapse-aria',
  'Collapse content',
];

/* ── Generic toolbar icon button ──────────────────────────────────────── */

export { ICON_BUTTON_COMING_SOON };

/**
 * Every wording declared above, in declaration order — walked by
 * `PACKAGE_WORDINGS` in `packages/affine/all/src/translations.ts` rather than
 * restated there.
 */
export const COMPONENTS_WORDINGS: readonly ChromeWording[] = [
  CAPTION_PLACEHOLDER,
  CARD_STYLE_LABEL,
  FAVICON_ALT,
  COLOR_PICKER_TAB_COLORS,
  COLOR_PICKER_TAB_CUSTOM,
  COLOR_PICKER_MODE_NORMAL,
  COLOR_PICKER_MODE_LIGHT,
  COLOR_PICKER_MODE_DARK,
  BORDER_COLOR_LABEL,
  CONTEXT_MENU_NO_RESULTS,
  CONTEXT_MENU_DONE,
  LINE_STYLE_SOLID,
  LINE_STYLE_DASH,
  LINE_STYLE_NONE,
  LINE_WIDTH_THICKNESS,
  EMBED_CARD_INVALID_LINK,
  EMBED_CARD_LINK_PLACEHOLDER,
  EMBED_CARD_TITLE_EMPTY,
  EMBED_CARD_TITLE_ALIAS_PLACEHOLDER,
  EMBED_CARD_DESCRIPTION_ALIAS_PLACEHOLDER,
  EMBED_CARD_TITLE_PLACEHOLDER,
  EMBED_CARD_DESCRIPTION_PLACEHOLDER,
  SAVE_LABEL,
  RESET_LABEL,
  FILTERABLE_LIST_SEARCH_PLACEHOLDER,
  HIGHLIGHT_LABEL,
  HIGHLIGHT_BACKGROUND_LABEL,
  HIGHLIGHT_DEFAULT_FOREGROUND,
  HIGHLIGHT_DEFAULT_BACKGROUND,
  COLOR_NAME_RED,
  COLOR_NAME_ORANGE,
  COLOR_NAME_YELLOW,
  COLOR_NAME_GREEN,
  COLOR_NAME_TEAL,
  COLOR_NAME_BLUE,
  COLOR_NAME_PURPLE,
  COLOR_NAME_GREY,
  COLOR_NAME_MAGENTA,
  ICON_PICKER_FILTER_PLACEHOLDER,
  ICON_PICKER_NO_ICON_FOUND,
  ICON_PICKER_NO_EMOJI_FOUND,
  ICON_PICKER_ICONS_GROUP,
  ICON_PICKER_RECENT_GROUP,
  ICON_PICKER_TAB_EMOJI,
  ICON_PICKER_REMOVE,
  EMOJI_GROUP_PEOPLE,
  EMOJI_GROUP_NATURE,
  EMOJI_GROUP_FOODS,
  EMOJI_GROUP_ACTIVITY,
  EMOJI_GROUP_PLACES,
  EMOJI_GROUP_OBJECTS,
  EMOJI_GROUP_SYMBOLS,
  EMOJI_GROUP_FLAGS,
  DOC_TITLE_ARIA,
  NOTIFY_SWITCHED_TO_CARD_TITLE,
  NOTIFY_SWITCHED_TO_CARD_MESSAGE,
  NOTIFY_SWITCHED_TO_EMBED_TITLE,
  NOTIFY_SWITCHED_TO_EMBED_MESSAGE,
  NOTIFY_CLEARED_ALIASES_TITLE,
  NOTIFY_CLEARED_ALIASES_MESSAGE,
  OPEN_LABEL,
  OPEN_DOC_MENU_ARIA,
  OPEN_DOC_WITH_ARIA,
  RESOURCE_BLOB_NOT_FOUND,
  RESOURCE_FILE_NOT_FOUND,
  RESOURCE_IMAGE_NOT_FOUND,
  RESOURCE_BLOB_RETRIEVE_FAILED,
  RESOURCE_FILE_RETRIEVE_FAILED,
  RESOURCE_IMAGE_RETRIEVE_FAILED,
  RESOURCE_STATUS_UPLOAD_FAILED,
  RESOURCE_STATUS_DOWNLOAD_FAILED,
  RESOURCE_STATUS_RETRY,
  SIZE_LABEL_SCALE,
  TOGGLE_EXPAND_ARIA,
  TOGGLE_COLLAPSE_ARIA,
];
