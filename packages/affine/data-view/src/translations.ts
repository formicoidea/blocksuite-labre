import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * The view engine's own wordings. Most of the data-view's chrome is still a
 * deferred surface of the literal ratchet (`DEFERRED_DIRS` in
 * `affine/all/src/__tests__/translations/literals.unit.spec.ts`); what is
 * declared here is what was written after that decision, keyed from the start.
 */

/* ── A view whose mode has no preset here (ADR 0035 §6) ───────────────── */

/** Beside the view's name in its tab: the stored mode is drawn as a table. */
export const VIEW_SHOWN_AS_TABLE: ChromeWording = [
  'com.labre.data-view.view.shown-as-table',
  'Shown as a table',
];

/**
 * The view menu's way out of such a view: a new table view, same name, the
 * stored one left untouched.
 */
export const VIEW_DUPLICATE_AS_TABLE: ChromeWording = [
  'com.labre.data-view.view.duplicate-as-table',
  'Duplicate as table',
];

/* ── The gallery and list presets (ADR 0035 §1, B6 and B7) ───────────── */

/**
 * The "New page" card of a gallery and row of a list: adds a row, opens it.
 * Their open button says the components' "Open" (`OPEN_LABEL`), one chrome
 * word, one key.
 */
export const DATA_VIEW_NEW_PAGE: ChromeWording = [
  'com.labre.data-view.new-page',
  'New page',
];

/* ── A view's name when it is created ─────────────────────────────────── */

/*
 * The name a new view is given. Each preset's `defaultName` is the English
 * fallback and its `defaultNameKey` the key; the creation site writes the
 * name resolved at the gesture (`viewDefaultName`), so a document keeps the
 * words its author saw and a stored name is never re-translated. A model
 * default never changes to translate a seed (ADR 0023).
 */
export const VIEW_NAME_TABLE: ChromeWording = [
  'com.labre.data-view.view.default-name.table',
  'Table View',
];
export const VIEW_NAME_KANBAN: ChromeWording = [
  'com.labre.data-view.view.default-name.kanban',
  'Kanban View',
];
export const VIEW_NAME_CALENDAR: ChromeWording = [
  'com.labre.data-view.view.default-name.calendar',
  'Calendar View',
];
export const VIEW_NAME_GALLERY: ChromeWording = [
  'com.labre.data-view.view.default-name.gallery',
  'Gallery View',
];
export const VIEW_NAME_LIST: ChromeWording = [
  'com.labre.data-view.view.default-name.list',
  'List View',
];

/** The views bar's "+" menu entry that adds a view of a given layout. */
export const VIEW_CREATE: ChromeWording = [
  'com.labre.data-view.view.create',
  'Create {{name}}',
];

/* ── The tag menu (select and multi-select cells, the chips band) ─────── */

export const TAG_SELECT_PLACEHOLDER: ChromeWording = [
  'com.labre.data-view.tag.placeholder',
  'Type here...',
];
export const TAG_SELECT_TIP: ChromeWording = [
  'com.labre.data-view.tag.tip',
  'Select tag or create one',
];
export const TAG_SELECT_CREATE: ChromeWording = [
  'com.labre.data-view.tag.create',
  'Create',
];

/*
 * The colours an option can take, as the option menu lists them: the
 * palette's own names (`PALETTE_NAME_*`, one word, one key), and teal, which
 * the canvas palette does not have.
 */
export const TAG_COLOR_TEAL: ChromeWording = [
  'com.labre.data-view.tag.color.teal',
  'Teal',
];

/** Walked by `PACKAGE_WORDINGS` in `packages/affine/all/src/translations.ts`. */
export const DATA_VIEW_WORDINGS: readonly ChromeWording[] = [
  VIEW_SHOWN_AS_TABLE,
  VIEW_DUPLICATE_AS_TABLE,
  DATA_VIEW_NEW_PAGE,
  VIEW_NAME_TABLE,
  VIEW_NAME_KANBAN,
  VIEW_NAME_CALENDAR,
  VIEW_NAME_GALLERY,
  VIEW_NAME_LIST,
  VIEW_CREATE,
  TAG_SELECT_PLACEHOLDER,
  TAG_SELECT_TIP,
  TAG_SELECT_CREATE,
  TAG_COLOR_TEAL,
];
