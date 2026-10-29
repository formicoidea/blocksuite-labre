import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * The view engine's own wordings. The data-view's chrome was a deferred
 * surface of the literal ratchet (`DEFERRED_DIRS` in
 * `affine/all/src/__tests__/translations/literals.unit.spec.ts`) until the
 * recette of 1.1 keyed it (#572); the ratchet now holds it. A label declared
 * as data (a filter, a property type, a statistic, a number format) carries
 * its wording beside its English text and is resolved where it is drawn.
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

/* ── Conditional colours of a view (ADR 0036) ───────────────────────── */

/** The view setting, its menu title and the full page's "This view" entry. */
export const DATA_VIEW_COLOR_RULES: ChromeWording = [
  'com.labre.data-view.color-rules',
  'Conditional colors',
];

export const DATA_VIEW_COLOR_RULES_ADD: ChromeWording = [
  'com.labre.data-view.color-rules.add',
  'Add a color rule',
];

/** The title of one rule's menu: its conditions, its colour, its place. */
export const DATA_VIEW_COLOR_RULE: ChromeWording = [
  'com.labre.data-view.color-rules.rule',
  'Color rule',
];

export const DATA_VIEW_COLOR_RULE_ADD_CONDITION: ChromeWording = [
  'com.labre.data-view.color-rules.add-condition',
  'Add a condition',
];

/** A rule's name in the list when its conditions were all removed. */
export const DATA_VIEW_COLOR_RULE_NO_CONDITION: ChromeWording = [
  'com.labre.data-view.color-rules.no-condition',
  'No condition',
];

/** The order decides: the first rule that matches a row colours it. */
export const DATA_VIEW_COLOR_RULE_MOVE_UP: ChromeWording = [
  'com.labre.data-view.color-rules.move-up',
  'Move up',
];

export const DATA_VIEW_COLOR_RULE_MOVE_DOWN: ChromeWording = [
  'com.labre.data-view.color-rules.move-down',
  'Move down',
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

/* ── The table's chrome on every device (P7, mobile base views) ──────── */

/** The toolbar button and a group's footer row that add a row. */
export const DATA_VIEW_NEW_RECORD: ChromeWording = [
  'com.labre.data-view.new-record',
  'New Record',
];

/**
 * The title of the group holding the rows with no value. Display only: the
 * stored group key stays `'Ungroups'` (`core/group-by/define.ts`).
 */
export const DATA_VIEW_UNGROUPED: ChromeWording = [
  'com.labre.data-view.group.ungrouped',
  'Ungroups',
];

/** The filter bar's button, and the filter group panel's. */
export const DATA_VIEW_ADD_FILTER: ChromeWording = [
  'com.labre.data-view.filter.add',
  'Add filter',
];

export const DATA_VIEW_SEARCH_PLACEHOLDER: ChromeWording = [
  'com.labre.data-view.search.placeholder',
  'Search...',
];

/** Read after an "Esc" key cap in the search box's clear tooltip. */
export const DATA_VIEW_SEARCH_CLEAR_HINT: ChromeWording = [
  'com.labre.data-view.search.clear-hint',
  'to clear all',
];

/* ── The view settings and a property's settings (P7, phone sheets) ──── */

/** The title of the view's settings (its "..." button). */
export const DATA_VIEW_VIEW_SETTINGS: ChromeWording = [
  'com.labre.data-view.view-settings',
  'View settings',
];

/**
 * The view settings' entries. "Layout" and "Group" are the full page's
 * "This view" entries for the same settings (`VIEW_MENU_LAYOUT`,
 * `VIEW_MENU_GROUP` in `@labre/core-database`): one chrome word, one key,
 * declared here because core draws them too.
 */
export const DATA_VIEW_LAYOUT: ChromeWording = [
  'com.labre.database.view-menu.layout',
  'Layout',
];

export const DATA_VIEW_GROUP: ChromeWording = [
  'com.labre.database.view-menu.group',
  'Group',
];

/**
 * The selection pane's "Filter" (`@labre/affine-widget-edgeless-toolbar`):
 * one chrome word, one key, declared there, so not listed below.
 */
export const DATA_VIEW_FILTER: ChromeWording = [
  'com.labre.selection-pane.filter',
  'Filter',
];

export const DATA_VIEW_SORT: ChromeWording = [
  'com.labre.data-view.sort',
  'Sort',
];

/** Beside "Properties": how many the view shows (`count`). */
export const DATA_VIEW_PROPERTIES_SHOWN: ChromeWording = [
  'com.labre.data-view.properties.shown',
  '{{count}} shown',
];

/** Beside "Filter" and "Sort": how many the view has (`count`, 1 or more). */
export const DATA_VIEW_FILTER_COUNT: ChromeWording = [
  'com.labre.data-view.filter.count',
  '{{count}} filter(s)',
];

export const DATA_VIEW_SORT_COUNT: ChromeWording = [
  'com.labre.data-view.sort.count',
  '{{count}} sort(s)',
];

/** The title of a property's menu on a phone (its column header). */
export const DATA_VIEW_PROPERTY_SETTINGS: ChromeWording = [
  'com.labre.data-view.property.settings',
  'Property settings',
];

/** A property's menu: the name field's placeholder. */
export const DATA_VIEW_PROPERTY_NAME: ChromeWording = [
  'com.labre.data-view.property.name',
  'Property name',
];

/** A property's menu: the entry opening the type picker. */
export const DATA_VIEW_PROPERTY_TYPE_ENTRY: ChromeWording = [
  'com.labre.data-view.property.type-entry',
  'Type',
];

/**
 * The table header's menu: a new property beside this one. Its "Move left"
 * and "Move right" are the views bar's (`VIEWS_BAR_MOVE_LEFT`, `…_RIGHT`).
 */
export const DATA_VIEW_INSERT_LEFT: ChromeWording = [
  'com.labre.data-view.property.insert-left',
  'Insert left column',
];

export const DATA_VIEW_INSERT_RIGHT: ChromeWording = [
  'com.labre.data-view.property.insert-right',
  'Insert right column',
];

/* ── A source its host locked (ADR 0035 amendment of 2026-10-29) ─────── */

/**
 * In a property's menu, under its name shown read-only: the host locked
 * the properties of the source this view reads.
 */
export const DATA_VIEW_PROPERTIES_LOCKED: ChromeWording = [
  'com.labre.data-view.source.properties-locked',
  'The properties of this source are locked',
];

/** The toolbar's "New", drawn disabled: the host locked new rows. */
export const DATA_VIEW_ROWS_LOCKED: ChromeWording = [
  'com.labre.data-view.source.rows-locked',
  'New pages cannot be added to this source',
];

/** Walked by `PACKAGE_WORDINGS` in `packages/affine/all/src/translations.ts`. */
/* ── Data-view chrome keyed at the recette of 1.1 (#572) ── */

export const DATA_VIEW_SHOW_ALL: ChromeWording = [
  'com.labre.data-view.properties.show-all',
  'Show All',
];

export const DATA_VIEW_HIDE_ALL: ChromeWording = [
  'com.labre.data-view.properties.hide-all',
  'Hide All',
];

export const DATA_VIEW_ADD_PROPERTY: ChromeWording = [
  'com.labre.data-view.detail.add-property',
  'Add property',
];

export const DATA_VIEW_EMPTY_VALUE: ChromeWording = [
  'com.labre.data-view.detail.empty',
  'Empty',
];

export const DATA_VIEW_FILTER_NEW: ChromeWording = [
  'com.labre.data-view.filter.new',
  'New filter',
];

export const DATA_VIEW_FILTER_ADD_GROUP: ChromeWording = [
  'com.labre.data-view.filter.add-group',
  'Add filter group',
];

export const DATA_VIEW_FILTER_GROUP: ChromeWording = [
  'com.labre.data-view.filter.group',
  'Filter group',
];

export const DATA_VIEW_FILTERS: ChromeWording = [
  'com.labre.data-view.filter.title',
  'Filters',
];

export const DATA_VIEW_FILTER_AND: ChromeWording = [
  'com.labre.data-view.filter.and',
  'And',
];

export const DATA_VIEW_FILTER_OR: ChromeWording = [
  'com.labre.data-view.filter.or',
  'Or',
];

export const DATA_VIEW_FILTER_WHERE: ChromeWording = [
  'com.labre.data-view.filter.where',
  'Where',
];

export const DATA_VIEW_FILTER_TURN_INTO_GROUP: ChromeWording = [
  'com.labre.data-view.filter.turn-into-group',
  'Turn into group',
];

export const DATA_VIEW_FILTER_WRAP_IN_GROUP: ChromeWording = [
  'com.labre.data-view.filter.wrap-in-group',
  'Wrap in group',
];

export const DATA_VIEW_FILTER_VALUE_PLACEHOLDER: ChromeWording = [
  'com.labre.data-view.filter.value-placeholder',
  'Type a value...',
];

export const DATA_VIEW_FILTER_INVALID: ChromeWording = [
  'com.labre.data-view.filter.invalid',
  'Invalid filter rule',
];

export const DATA_VIEW_FILTER_NOT: ChromeWording = [
  'com.labre.data-view.filter.not',
  'Not {{value}}',
];

export const DATA_VIEW_FILTER_IS_CHECKED: ChromeWording = [
  'com.labre.data-view.filter.fn.is-checked',
  'Is checked',
];

export const DATA_VIEW_FILTER_IS_UNCHECKED: ChromeWording = [
  'com.labre.data-view.filter.fn.is-unchecked',
  'Is unchecked',
];

export const DATA_VIEW_FILTER_BEFORE: ChromeWording = [
  'com.labre.data-view.filter.fn.before',
  'Before',
];

export const DATA_VIEW_FILTER_AFTER: ChromeWording = [
  'com.labre.data-view.filter.fn.after',
  'After',
];

export const DATA_VIEW_FILTER_CONTAINS_ONE_OF: ChromeWording = [
  'com.labre.data-view.filter.fn.contains-one-of',
  'Contains one of',
];

export const DATA_VIEW_FILTER_NOT_CONTAINS_ONE_OF: ChromeWording = [
  'com.labre.data-view.filter.fn.does-not-contain-one-of',
  'Does not contain one of',
];

export const DATA_VIEW_FILTER_CONTAINS_ALL: ChromeWording = [
  'com.labre.data-view.filter.fn.contains-all',
  'Contains all',
];

export const DATA_VIEW_FILTER_NOT_CONTAINS_ALL: ChromeWording = [
  'com.labre.data-view.filter.fn.does-not-contain-all',
  'Does not contain all',
];

export const DATA_VIEW_FILTER_CONTAINS: ChromeWording = [
  'com.labre.data-view.filter.fn.contains',
  'Contains',
];

export const DATA_VIEW_FILTER_NOT_CONTAINS: ChromeWording = [
  'com.labre.data-view.filter.fn.does-not-contain',
  'Does not contain',
];

export const DATA_VIEW_FILTER_STARTS_WITH: ChromeWording = [
  'com.labre.data-view.filter.fn.starts-with',
  'Starts with',
];

export const DATA_VIEW_FILTER_ENDS_WITH: ChromeWording = [
  'com.labre.data-view.filter.fn.ends-with',
  'Ends with',
];

export const DATA_VIEW_FILTER_IS: ChromeWording = [
  'com.labre.data-view.filter.fn.is',
  'Is',
];

export const DATA_VIEW_FILTER_IS_NOT: ChromeWording = [
  'com.labre.data-view.filter.fn.is-not',
  'Is not',
];

export const DATA_VIEW_FILTER_IS_ONE_OF: ChromeWording = [
  'com.labre.data-view.filter.fn.is-one-of',
  'Is one of',
];

export const DATA_VIEW_FILTER_IS_NOT_ONE_OF: ChromeWording = [
  'com.labre.data-view.filter.fn.is-not-one-of',
  'Is not one of',
];

export const DATA_VIEW_FILTER_IS_NOT_EMPTY: ChromeWording = [
  'com.labre.data-view.filter.fn.is-not-empty',
  'Is not empty',
];

export const DATA_VIEW_FILTER_IS_EMPTY: ChromeWording = [
  'com.labre.data-view.filter.fn.is-empty',
  'Is empty',
];

export const DATA_VIEW_SORT_NEW: ChromeWording = [
  'com.labre.data-view.sort.new',
  'New sort',
];

export const DATA_VIEW_SORT_ADD: ChromeWording = [
  'com.labre.data-view.sort.add',
  'Add sort',
];

export const DATA_VIEW_GROUP_BY: ChromeWording = [
  'com.labre.data-view.group.by',
  'Group by',
];

export const DATA_VIEW_GROUP_REMOVE: ChromeWording = [
  'com.labre.data-view.group.remove',
  'Remove grouping',
];

export const DATA_VIEW_GROUP_DATES_BY: ChromeWording = [
  'com.labre.data-view.group.dates-by',
  'Group dates by',
];

export const DATA_VIEW_GROUP_ORDER: ChromeWording = [
  'com.labre.data-view.group.order',
  'Order',
];

export const DATA_VIEW_GROUP_OLDEST_FIRST: ChromeWording = [
  'com.labre.data-view.group.oldest-first',
  'Oldest first',
];

export const DATA_VIEW_GROUP_NEWEST_FIRST: ChromeWording = [
  'com.labre.data-view.group.newest-first',
  'Newest first',
];

export const DATA_VIEW_GROUP_DATE_RELATIVE: ChromeWording = [
  'com.labre.data-view.group.date.relative',
  'Relative',
];

export const DATA_VIEW_GROUP_DATE_DAY: ChromeWording = [
  'com.labre.data-view.group.date.day',
  'Day',
];

export const DATA_VIEW_GROUP_DATE_WEEK_MON: ChromeWording = [
  'com.labre.data-view.group.date.week-monday',
  'Week (starts Monday)',
];

export const DATA_VIEW_GROUP_DATE_WEEK_SUN: ChromeWording = [
  'com.labre.data-view.group.date.week-sunday',
  'Week (starts Sunday)',
];

export const DATA_VIEW_GROUP_DATE_MONTH: ChromeWording = [
  'com.labre.data-view.group.date.month',
  'Month',
];

export const DATA_VIEW_GROUP_DATE_YEAR: ChromeWording = [
  'com.labre.data-view.group.date.year',
  'Year',
];

export const DATA_VIEW_GROUP_NEW: ChromeWording = [
  'com.labre.data-view.group.new',
  'New Group',
];

export const DATA_VIEW_GROUP_DELETE_CARDS: ChromeWording = [
  'com.labre.data-view.group.delete-cards',
  'Delete Cards',
];

export const DATA_VIEW_GROUP_ADD: ChromeWording = [
  'com.labre.data-view.group.add',
  'Add',
];

export const DATA_VIEW_TYPE_CHECKBOX: ChromeWording = [
  'com.labre.data-view.property-type.checkbox',
  'Checkbox',
];

export const DATA_VIEW_TYPE_DATE: ChromeWording = [
  'com.labre.data-view.property-type.date',
  'Date',
];

export const DATA_VIEW_TYPE_MULTI_SELECT: ChromeWording = [
  'com.labre.data-view.property-type.multi-select',
  'Multi-select',
];

export const DATA_VIEW_TYPE_NUMBER: ChromeWording = [
  'com.labre.data-view.property-type.number',
  'Number',
];

export const DATA_VIEW_TYPE_PROGRESS: ChromeWording = [
  'com.labre.data-view.property-type.progress',
  'Progress',
];

export const DATA_VIEW_TYPE_SELECT: ChromeWording = [
  'com.labre.data-view.property-type.select',
  'Select',
];

export const DATA_VIEW_TYPE_PLAIN_TEXT: ChromeWording = [
  'com.labre.data-view.property-type.plain-text',
  'Plain-Text',
];

export const DATA_VIEW_NUMBER_FORMAT: ChromeWording = [
  'com.labre.data-view.number-format',
  'Number Format',
];

export const DATA_VIEW_NUMBER_FORMAT_COMMAS: ChromeWording = [
  'com.labre.data-view.number-format.number-with-commas',
  'Number With Commas',
];

export const DATA_VIEW_NUMBER_FORMAT_PERCENT: ChromeWording = [
  'com.labre.data-view.number-format.percent',
  'Percent',
];

export const DATA_VIEW_NUMBER_FORMAT_YEN: ChromeWording = [
  'com.labre.data-view.number-format.yen',
  'Japanese Yen',
];

export const DATA_VIEW_NUMBER_FORMAT_CNY: ChromeWording = [
  'com.labre.data-view.number-format.yuan',
  'Chinese Yuan',
];

export const DATA_VIEW_NUMBER_FORMAT_INR: ChromeWording = [
  'com.labre.data-view.number-format.rupee',
  'Indian Rupee',
];

export const DATA_VIEW_NUMBER_FORMAT_USD: ChromeWording = [
  'com.labre.data-view.number-format.us-dollar',
  'US Dollar',
];

export const DATA_VIEW_NUMBER_FORMAT_EUR: ChromeWording = [
  'com.labre.data-view.number-format.euro',
  'Euro',
];

export const DATA_VIEW_NUMBER_FORMAT_GBP: ChromeWording = [
  'com.labre.data-view.number-format.pound',
  'British Pound',
];

export const DATA_VIEW_DECIMALS_DECREASE: ChromeWording = [
  'com.labre.data-view.number-format.decrease-decimals',
  'Decrease decimal places',
];

export const DATA_VIEW_DECIMALS_INCREASE: ChromeWording = [
  'com.labre.data-view.number-format.increase-decimals',
  'Increase decimal places',
];

export const DATA_VIEW_SORT_ASCENDING: ChromeWording = [
  'com.labre.data-view.property.sort-ascending',
  'Sort Ascending',
];

export const DATA_VIEW_SORT_DESCENDING: ChromeWording = [
  'com.labre.data-view.property.sort-descending',
  'Sort Descending',
];

export const DATA_VIEW_ROW_EXPAND: ChromeWording = [
  'com.labre.data-view.row.expand',
  'Expand Row',
];

export const DATA_VIEW_ROW_INSERT_BEFORE: ChromeWording = [
  'com.labre.data-view.row.insert-before',
  'Insert Before',
];

export const DATA_VIEW_ROW_INSERT_AFTER: ChromeWording = [
  'com.labre.data-view.row.insert-after',
  'Insert After',
];

export const DATA_VIEW_ROW_DELETE: ChromeWording = [
  'com.labre.data-view.row.delete',
  'Delete Row',
];

export const DATA_VIEW_ROWS_DELETE: ChromeWording = [
  'com.labre.data-view.row.delete-many',
  'Delete Rows',
];

export const DATA_VIEW_CARD_EXPAND: ChromeWording = [
  'com.labre.data-view.card.expand',
  'Expand Card',
];

export const DATA_VIEW_CARD_MOVE_TO: ChromeWording = [
  'com.labre.data-view.card.move-to',
  'Move To',
];

export const DATA_VIEW_CARD_DELETE: ChromeWording = [
  'com.labre.data-view.card.delete',
  'Delete Card',
];

export const DATA_VIEW_CELLS_COPIED: ChromeWording = [
  'com.labre.data-view.clipboard.cells-copied',
  'Cells copied to the clipboard: {{count}}',
];

export const DATA_VIEW_ROWS_COPIED: ChromeWording = [
  'com.labre.data-view.clipboard.rows-copied',
  'Rows copied to the clipboard: {{count}}',
];

export const DATA_VIEW_STATS_CALCULATE: ChromeWording = [
  'com.labre.data-view.stats.calculate',
  'Calculate',
];

export const DATA_VIEW_STATS_GROUP_COUNT: ChromeWording = [
  'com.labre.data-view.stats.group.count',
  'Count',
];

export const DATA_VIEW_STATS_GROUP_MORE: ChromeWording = [
  'com.labre.data-view.stats.group.more',
  'More options',
];

export const DATA_VIEW_STATS_COUNT_ALL: ChromeWording = [
  'com.labre.data-view.stats.count-all',
  'Count All',
];

export const DATA_VIEW_STATS_ALL: ChromeWording = [
  'com.labre.data-view.stats.count-all.short',
  'All',
];

export const DATA_VIEW_STATS_COUNT_VALUES: ChromeWording = [
  'com.labre.data-view.stats.count-values',
  'Count Values',
];

export const DATA_VIEW_STATS_VALUES: ChromeWording = [
  'com.labre.data-view.stats.count-values.short',
  'Values',
];

export const DATA_VIEW_STATS_COUNT_UNIQUE: ChromeWording = [
  'com.labre.data-view.stats.count-unique-values',
  'Count Unique Values',
];

export const DATA_VIEW_STATS_UNIQUE: ChromeWording = [
  'com.labre.data-view.stats.count-unique-values.short',
  'Unique Values',
];

export const DATA_VIEW_STATS_COUNT_EMPTY: ChromeWording = [
  'com.labre.data-view.stats.count-empty',
  'Count Empty',
];

export const DATA_VIEW_STATS_COUNT_NOT_EMPTY: ChromeWording = [
  'com.labre.data-view.stats.count-not-empty',
  'Count Not Empty',
];

export const DATA_VIEW_STATS_NOT_EMPTY: ChromeWording = [
  'com.labre.data-view.stats.not-empty.short',
  'Not Empty',
];

export const DATA_VIEW_STATS_PERCENT_EMPTY: ChromeWording = [
  'com.labre.data-view.stats.percent-empty',
  'Percent Empty',
];

export const DATA_VIEW_STATS_PERCENT_NOT_EMPTY: ChromeWording = [
  'com.labre.data-view.stats.percent-not-empty',
  'Percent Not Empty',
];

export const DATA_VIEW_STATS_COUNT_UNCHECKED: ChromeWording = [
  'com.labre.data-view.stats.count-unchecked',
  'Count Unchecked',
];

export const DATA_VIEW_STATS_UNCHECKED: ChromeWording = [
  'com.labre.data-view.stats.unchecked.short',
  'Unchecked',
];

export const DATA_VIEW_STATS_COUNT_CHECKED: ChromeWording = [
  'com.labre.data-view.stats.count-checked',
  'Count Checked',
];

export const DATA_VIEW_STATS_CHECKED: ChromeWording = [
  'com.labre.data-view.stats.checked.short',
  'Checked',
];

export const DATA_VIEW_STATS_PERCENT_UNCHECKED: ChromeWording = [
  'com.labre.data-view.stats.percent-unchecked',
  'Percent Unchecked',
];

export const DATA_VIEW_STATS_PERCENT_CHECKED: ChromeWording = [
  'com.labre.data-view.stats.percent-checked',
  'Percent Checked',
];

export const DATA_VIEW_STATS_SUM: ChromeWording = [
  'com.labre.data-view.stats.sum',
  'Sum',
];

export const DATA_VIEW_STATS_AVERAGE: ChromeWording = [
  'com.labre.data-view.stats.average',
  'Average',
];

export const DATA_VIEW_STATS_MEDIAN: ChromeWording = [
  'com.labre.data-view.stats.median',
  'Median',
];

export const DATA_VIEW_STATS_MIN: ChromeWording = [
  'com.labre.data-view.stats.min',
  'Min',
];

export const DATA_VIEW_STATS_MAX: ChromeWording = [
  'com.labre.data-view.stats.max',
  'Max',
];

export const DATA_VIEW_STATS_RANGE: ChromeWording = [
  'com.labre.data-view.stats.range',
  'Range',
];

export const DATA_VIEW_SEARCH_ESCAPE: ChromeWording = [
  'com.labre.data-view.search.escape-key',
  'Esc',
];

/* ── Grouping settings ── */

export const DATA_VIEW_GROUPS: ChromeWording = [
  'com.labre.data-view.group.groups',
  'Groups',
];

/* ── Date groups and sort rules ── */

export const DATA_VIEW_DATE_TODAY: ChromeWording = [
  'com.labre.data-view.group.date.today',
  'Today',
];

export const DATA_VIEW_DATE_TOMORROW: ChromeWording = [
  'com.labre.data-view.group.date.tomorrow',
  'Tomorrow',
];

export const DATA_VIEW_DATE_YESTERDAY: ChromeWording = [
  'com.labre.data-view.group.date.yesterday',
  'Yesterday',
];

export const DATA_VIEW_DATE_NEXT_7_DAYS: ChromeWording = [
  'com.labre.data-view.group.date.next-7-days',
  'Next 7 days',
];

export const DATA_VIEW_DATE_NEXT_30_DAYS: ChromeWording = [
  'com.labre.data-view.group.date.next-30-days',
  'Next 30 days',
];

export const DATA_VIEW_DATE_LAST_7_DAYS: ChromeWording = [
  'com.labre.data-view.group.date.last-7-days',
  'Last 7 days',
];

export const DATA_VIEW_DATE_LAST_30_DAYS: ChromeWording = [
  'com.labre.data-view.group.date.last-30-days',
  'Last 30 days',
];

export const DATA_VIEW_GROUP_NO_VALUE: ChromeWording = [
  'com.labre.data-view.group.no-value',
  'No {{name}}',
];

export const DATA_VIEW_SORT_INVALID: ChromeWording = [
  'com.labre.data-view.sort.invalid',
  'This rule is invalid, click to delete',
];

export const DATA_VIEW_SORT_ASC: ChromeWording = [
  'com.labre.data-view.sort.ascending',
  'Ascending',
];

export const DATA_VIEW_SORT_DESC: ChromeWording = [
  'com.labre.data-view.sort.descending',
  'Descending',
];

export const DATA_VIEW_WORDINGS: readonly ChromeWording[] = [
  VIEW_SHOWN_AS_TABLE,
  VIEW_DUPLICATE_AS_TABLE,
  DATA_VIEW_NEW_PAGE,
  DATA_VIEW_NEW_RECORD,
  DATA_VIEW_UNGROUPED,
  DATA_VIEW_ADD_FILTER,
  DATA_VIEW_SEARCH_PLACEHOLDER,
  DATA_VIEW_SEARCH_CLEAR_HINT,
  VIEW_NAME_TABLE,
  VIEW_NAME_KANBAN,
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
  DATA_VIEW_COLOR_RULES,
  DATA_VIEW_COLOR_RULES_ADD,
  DATA_VIEW_COLOR_RULE,
  DATA_VIEW_COLOR_RULE_ADD_CONDITION,
  DATA_VIEW_COLOR_RULE_NO_CONDITION,
  DATA_VIEW_COLOR_RULE_MOVE_UP,
  DATA_VIEW_COLOR_RULE_MOVE_DOWN,
  DATA_VIEW_PROPERTIES,
  DATA_VIEW_NEW_PROPERTY,
  DATA_VIEW_PROPERTY_TYPE,
  DATA_VIEW_PROPERTY_HIDE_IN_VIEW,
  DATA_VIEW_VIEW_SETTINGS,
  DATA_VIEW_LAYOUT,
  DATA_VIEW_GROUP,
  DATA_VIEW_SORT,
  DATA_VIEW_PROPERTIES_SHOWN,
  DATA_VIEW_FILTER_COUNT,
  DATA_VIEW_SORT_COUNT,
  DATA_VIEW_PROPERTY_SETTINGS,
  DATA_VIEW_PROPERTY_NAME,
  DATA_VIEW_PROPERTY_TYPE_ENTRY,
  DATA_VIEW_INSERT_LEFT,
  DATA_VIEW_INSERT_RIGHT,
  DATA_VIEW_PROPERTIES_LOCKED,
  DATA_VIEW_ROWS_LOCKED,
  DATA_VIEW_SHOW_ALL,
  DATA_VIEW_HIDE_ALL,
  DATA_VIEW_ADD_PROPERTY,
  DATA_VIEW_EMPTY_VALUE,
  DATA_VIEW_FILTER_NEW,
  DATA_VIEW_FILTER_ADD_GROUP,
  DATA_VIEW_FILTER_GROUP,
  DATA_VIEW_FILTERS,
  DATA_VIEW_FILTER_AND,
  DATA_VIEW_FILTER_OR,
  DATA_VIEW_FILTER_WHERE,
  DATA_VIEW_FILTER_TURN_INTO_GROUP,
  DATA_VIEW_FILTER_WRAP_IN_GROUP,
  DATA_VIEW_FILTER_VALUE_PLACEHOLDER,
  DATA_VIEW_FILTER_INVALID,
  DATA_VIEW_FILTER_NOT,
  DATA_VIEW_FILTER_IS_CHECKED,
  DATA_VIEW_FILTER_IS_UNCHECKED,
  DATA_VIEW_FILTER_BEFORE,
  DATA_VIEW_FILTER_AFTER,
  DATA_VIEW_FILTER_CONTAINS_ONE_OF,
  DATA_VIEW_FILTER_NOT_CONTAINS_ONE_OF,
  DATA_VIEW_FILTER_CONTAINS_ALL,
  DATA_VIEW_FILTER_NOT_CONTAINS_ALL,
  DATA_VIEW_FILTER_CONTAINS,
  DATA_VIEW_FILTER_NOT_CONTAINS,
  DATA_VIEW_FILTER_STARTS_WITH,
  DATA_VIEW_FILTER_ENDS_WITH,
  DATA_VIEW_FILTER_IS,
  DATA_VIEW_FILTER_IS_NOT,
  DATA_VIEW_FILTER_IS_ONE_OF,
  DATA_VIEW_FILTER_IS_NOT_ONE_OF,
  DATA_VIEW_FILTER_IS_NOT_EMPTY,
  DATA_VIEW_FILTER_IS_EMPTY,
  DATA_VIEW_SORT_NEW,
  DATA_VIEW_SORT_ADD,
  DATA_VIEW_GROUP_BY,
  DATA_VIEW_GROUP_REMOVE,
  DATA_VIEW_GROUP_DATES_BY,
  DATA_VIEW_GROUP_ORDER,
  DATA_VIEW_GROUP_OLDEST_FIRST,
  DATA_VIEW_GROUP_NEWEST_FIRST,
  DATA_VIEW_GROUP_DATE_RELATIVE,
  DATA_VIEW_GROUP_DATE_DAY,
  DATA_VIEW_GROUP_DATE_WEEK_MON,
  DATA_VIEW_GROUP_DATE_WEEK_SUN,
  DATA_VIEW_GROUP_DATE_MONTH,
  DATA_VIEW_GROUP_DATE_YEAR,
  DATA_VIEW_GROUP_NEW,
  DATA_VIEW_GROUP_DELETE_CARDS,
  DATA_VIEW_GROUP_ADD,
  DATA_VIEW_TYPE_CHECKBOX,
  DATA_VIEW_TYPE_DATE,
  DATA_VIEW_TYPE_MULTI_SELECT,
  DATA_VIEW_TYPE_NUMBER,
  DATA_VIEW_TYPE_PROGRESS,
  DATA_VIEW_TYPE_SELECT,
  DATA_VIEW_TYPE_PLAIN_TEXT,
  DATA_VIEW_NUMBER_FORMAT,
  DATA_VIEW_NUMBER_FORMAT_COMMAS,
  DATA_VIEW_NUMBER_FORMAT_PERCENT,
  DATA_VIEW_NUMBER_FORMAT_YEN,
  DATA_VIEW_NUMBER_FORMAT_CNY,
  DATA_VIEW_NUMBER_FORMAT_INR,
  DATA_VIEW_NUMBER_FORMAT_USD,
  DATA_VIEW_NUMBER_FORMAT_EUR,
  DATA_VIEW_NUMBER_FORMAT_GBP,
  DATA_VIEW_DECIMALS_DECREASE,
  DATA_VIEW_DECIMALS_INCREASE,
  DATA_VIEW_SORT_ASCENDING,
  DATA_VIEW_SORT_DESCENDING,
  DATA_VIEW_ROW_EXPAND,
  DATA_VIEW_ROW_INSERT_BEFORE,
  DATA_VIEW_ROW_INSERT_AFTER,
  DATA_VIEW_ROW_DELETE,
  DATA_VIEW_ROWS_DELETE,
  DATA_VIEW_CARD_EXPAND,
  DATA_VIEW_CARD_MOVE_TO,
  DATA_VIEW_CARD_DELETE,
  DATA_VIEW_CELLS_COPIED,
  DATA_VIEW_ROWS_COPIED,
  DATA_VIEW_STATS_CALCULATE,
  DATA_VIEW_STATS_GROUP_COUNT,
  DATA_VIEW_STATS_GROUP_MORE,
  DATA_VIEW_STATS_COUNT_ALL,
  DATA_VIEW_STATS_ALL,
  DATA_VIEW_STATS_COUNT_VALUES,
  DATA_VIEW_STATS_VALUES,
  DATA_VIEW_STATS_COUNT_UNIQUE,
  DATA_VIEW_STATS_UNIQUE,
  DATA_VIEW_STATS_COUNT_EMPTY,
  DATA_VIEW_STATS_COUNT_NOT_EMPTY,
  DATA_VIEW_STATS_NOT_EMPTY,
  DATA_VIEW_STATS_PERCENT_EMPTY,
  DATA_VIEW_STATS_PERCENT_NOT_EMPTY,
  DATA_VIEW_STATS_COUNT_UNCHECKED,
  DATA_VIEW_STATS_UNCHECKED,
  DATA_VIEW_STATS_COUNT_CHECKED,
  DATA_VIEW_STATS_CHECKED,
  DATA_VIEW_STATS_PERCENT_UNCHECKED,
  DATA_VIEW_STATS_PERCENT_CHECKED,
  DATA_VIEW_STATS_SUM,
  DATA_VIEW_STATS_AVERAGE,
  DATA_VIEW_STATS_MEDIAN,
  DATA_VIEW_STATS_MIN,
  DATA_VIEW_STATS_MAX,
  DATA_VIEW_STATS_RANGE,
  DATA_VIEW_SEARCH_ESCAPE,
  DATA_VIEW_GROUPS,
  DATA_VIEW_DATE_TODAY,
  DATA_VIEW_DATE_TOMORROW,
  DATA_VIEW_DATE_YESTERDAY,
  DATA_VIEW_DATE_NEXT_7_DAYS,
  DATA_VIEW_DATE_NEXT_30_DAYS,
  DATA_VIEW_DATE_LAST_7_DAYS,
  DATA_VIEW_DATE_LAST_30_DAYS,
  DATA_VIEW_GROUP_NO_VALUE,
  DATA_VIEW_SORT_INVALID,
  DATA_VIEW_SORT_ASC,
  DATA_VIEW_SORT_DESC,
];
