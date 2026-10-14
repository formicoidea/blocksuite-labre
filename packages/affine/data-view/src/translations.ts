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

/* ── The views bar (ADR 0035 B11, labre PRD REQ-DB-7) ─────────────────── */

/** The button standing for the views whose tabs do not fit; `count` of them. */
export const VIEWS_BAR_MORE: ChromeWording = [
  'com.labre.data-view.views-bar.more',
  '{{count}} more',
];

/** The "+" after the tabs, as its label and tooltip. */
export const VIEWS_BAR_ADD_VIEW: ChromeWording = [
  'com.labre.data-view.views-bar.add-view',
  'New view',
];

/** A tab's menu: the name field. */
export const VIEWS_BAR_VIEW_NAME: ChromeWording = [
  'com.labre.data-view.views-bar.view-name',
  'View name',
];

/** A tab's menu: opens the view's settings. */
export const VIEWS_BAR_EDIT_VIEW: ChromeWording = [
  'com.labre.data-view.views-bar.edit-view',
  'Edit view',
];

export const VIEWS_BAR_MOVE_LEFT: ChromeWording = [
  'com.labre.data-view.views-bar.move-left',
  'Move left',
];

export const VIEWS_BAR_MOVE_RIGHT: ChromeWording = [
  'com.labre.data-view.views-bar.move-right',
  'Move right',
];

/* ── Grouping and row opening, per view (ADR 0035 §8, B8) ───────────── */

/** A group's menu entry: a view setting, shared by everyone (PRD REQ-DB-16). */
export const DATA_VIEW_GROUP_HIDE: ChromeWording = [
  'com.labre.data-view.group.hide',
  'Hide group',
];

/** A hidden group's button, in the list at the end of the view. */
export const DATA_VIEW_GROUP_SHOW: ChromeWording = [
  'com.labre.data-view.group.show',
  'Show group',
];

/** The heading of the hidden groups, listed at the end of the view. */
export const DATA_VIEW_HIDDEN_GROUPS: ChromeWording = [
  'com.labre.data-view.group.hidden',
  'Hidden groups',
];

/** A group's fold toggle: personal, kept on this device only. */
export const DATA_VIEW_GROUP_COLLAPSE: ChromeWording = [
  'com.labre.data-view.group.collapse',
  'Collapse group',
];

export const DATA_VIEW_GROUP_EXPAND: ChromeWording = [
  'com.labre.data-view.group.expand',
  'Expand group',
];

/** The view setting naming where a row's page opens (`openIn`). */
export const DATA_VIEW_OPEN_IN: ChromeWording = [
  'com.labre.data-view.open-in',
  'Open pages in',
];

export const DATA_VIEW_OPEN_IN_SIDE: ChromeWording = [
  'com.labre.data-view.open-in.side',
  'Side peek',
];

export const DATA_VIEW_OPEN_IN_CENTER: ChromeWording = [
  'com.labre.data-view.open-in.center',
  'Center peek',
];

export const DATA_VIEW_OPEN_IN_FULL: ChromeWording = [
  'com.labre.data-view.open-in.full',
  'Full page',
];

/* ── A view's properties list (view options, side panel) ─────────────── */

/**
 * The title of that list: the view options' popover and the database's side
 * panel (`PROPERTIES_PANEL_TITLE` there is this wording). One chrome word,
 * one key; the key keeps the panel's spelling of 0.49, which hosts already
 * translate.
 */
export const DATA_VIEW_PROPERTIES: ChromeWording = [
  'com.labre.database.properties-panel.title',
  'Properties',
];

/**
 * The last row of the properties list: adds a property to the source, every
 * view at once, through the type picker, then opens its menu.
 */
export const DATA_VIEW_NEW_PROPERTY: ChromeWording = [
  'com.labre.data-view.properties.new',
  'New property',
];

/**
 * A property's menu entry (the table header's and the properties list's):
 * hides the property in this view only. Its neighbours say the toolbar's
 * "Duplicate" and "Delete".
 */
export const DATA_VIEW_PROPERTY_HIDE_IN_VIEW: ChromeWording = [
  'com.labre.data-view.property.hide-in-view',
  'Hide In View',
];

/**
 * The title of that type picker, and of the "Type" sub-menu of a
 * property's menu.
 */
export const DATA_VIEW_PROPERTY_TYPE: ChromeWording = [
  'com.labre.data-view.property.type',
  'Property type',
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
  TAG_SELECT_PLACEHOLDER,
  TAG_SELECT_TIP,
  TAG_SELECT_CREATE,
  TAG_COLOR_TEAL,
  VIEWS_BAR_MORE,
  VIEWS_BAR_ADD_VIEW,
  VIEWS_BAR_VIEW_NAME,
  VIEWS_BAR_EDIT_VIEW,
  VIEWS_BAR_MOVE_LEFT,
  VIEWS_BAR_MOVE_RIGHT,
  DATA_VIEW_GROUP_HIDE,
  DATA_VIEW_GROUP_SHOW,
  DATA_VIEW_HIDDEN_GROUPS,
  DATA_VIEW_GROUP_COLLAPSE,
  DATA_VIEW_GROUP_EXPAND,
  DATA_VIEW_OPEN_IN,
  DATA_VIEW_OPEN_IN_SIDE,
  DATA_VIEW_OPEN_IN_CENTER,
  DATA_VIEW_OPEN_IN_FULL,
  DATA_VIEW_PROPERTIES,
  DATA_VIEW_NEW_PROPERTY,
  DATA_VIEW_PROPERTY_TYPE,
  DATA_VIEW_PROPERTY_HIDE_IN_VIEW,
];
