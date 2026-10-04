import {
  ATTACHMENT_LABEL,
  type ChromeWording,
  ICON_BUTTON_COMING_SOON,
  IMAGE_LABEL,
  TOOL_NAME_FRAME,
  TOOL_NAME_NOTE,
} from '@labre/affine-shared/services';

/**
 * The generic edgeless toolbar's own wordings — not a specific tool's, the
 * toolbar chrome itself. `STYLE_GENERAL`/`STYLE_SCRIBBLED` (`config/consts.ts`'s
 * `LINE_STYLE_LIST`) and `FONT_WEIGHT_*`/`FONT_STYLE_ITALIC`
 * (`panel/font-weight-and-style-panel.ts`) are declared once in `chrome.ts`
 * (shared with `gfx/shape` and `gfx/text`) and imported directly there rather
 * than re-declared here. `EDGELESS_TOOLBAR_COMING_SOON` (L7 dedupe: the same
 * word as `@labre/affine-components`'s own icon-button placeholder) aliases
 * `ICON_BUTTON_COMING_SOON` for the same reason.
 */
export const EDGELESS_TOOLBAR_COMING_SOON = ICON_BUTTON_COMING_SOON;

export const EDGELESS_TOOLBAR_MORE_TOOLS: ChromeWording = [
  'com.labre.edgeless-toolbar.more-tools',
  'More Tools',
];

/**
 * A family the element still carries but the host no longer configures
 * (#396): the font picker keeps its name, greyed, with this mark. `{{name}}`
 * is the family name, a proper name the host does not translate.
 */
export const EDGELESS_TOOLBAR_FONT_FAMILY_UNAVAILABLE: ChromeWording = [
  'com.labre.edgeless-toolbar.font-family-unavailable',
  '{{name}} (unavailable)',
];

/* ── Selection pane (ADR 0031) ────────────────────────────────────────── */

/** The pane's title, and the toolbar button's tooltip. */
export const SELECTION_PANE_TITLE: ChromeWording = [
  'com.labre.selection-pane.title',
  'Selection pane',
];

/**
 * The catalogue's own "Close": the same word on the same kind of side panel,
 * so one key (L7 dedupe: one chrome word, one key). The manifest already
 * declares it for the catalogue, so it is not listed again below.
 */
export const SELECTION_PANE_CLOSE: ChromeWording = [
  'com.labre.catalogue.close',
  'Close',
];

/** What the pane says on a canvas with nothing on it, or nothing filtered. */
export const SELECTION_PANE_EMPTY: ChromeWording = [
  'com.labre.selection-pane.empty',
  'Nothing on the canvas',
];

export const SELECTION_PANE_FILTER: ChromeWording = [
  'com.labre.selection-pane.filter',
  'Filter',
];

/** The filter entry that shows every element again. */
export const SELECTION_PANE_FILTER_ALL: ChromeWording = [
  'com.labre.selection-pane.filter.all',
  'All elements',
];

/** A frame offered by the filter; `{{name}}` is the frame's own title. */
export const SELECTION_PANE_FILTER_FRAME: ChromeWording = [
  'com.labre.selection-pane.filter.frame',
  'Frame: {{name}}',
];

/** A framework board offered by the filter; `{{name}}` is its wording. */
export const SELECTION_PANE_FILTER_BOARD: ChromeWording = [
  'com.labre.selection-pane.filter.board',
  'Board: {{name}}',
];

/** The eye of a visible row: hide it for this viewer only (ADR 0031 §8). */
export const SELECTION_PANE_HIDE: ChromeWording = [
  'com.labre.selection-pane.hide',
  'Hide for me',
];

/** The eye of a row this viewer hid: show it again. */
export const SELECTION_PANE_SHOW: ChromeWording = [
  'com.labre.selection-pane.show',
  'Show',
];

/**
 * A row's menu entry that hides it for EVERYONE (ADR 0031 §7): written to
 * the document, painted with the theme's warning tokens.
 */
export const SELECTION_PANE_HIDE_FOR_EVERYONE: ChromeWording = [
  'com.labre.selection-pane.hide-for-everyone',
  'Hide for everyone',
];

/** The same entry on a row hidden for everyone: show it to everyone again. */
export const SELECTION_PANE_SHOW_FOR_EVERYONE: ChromeWording = [
  'com.labre.selection-pane.show-for-everyone',
  'Show for everyone',
];

/** The pane's head button that adds a user layer (ADR 0031 §2). */
export const SELECTION_PANE_NEW_LAYER: ChromeWording = [
  'com.labre.selection-pane.new-layer',
  'New layer',
];

/** The hint on the active layer's row: where new elements land. */
export const SELECTION_PANE_ACTIVE_LAYER: ChromeWording = [
  'com.labre.selection-pane.active-layer',
  'New elements go into this layer',
];

/** The menu of a row, opened by a right click or its "more" button. */
export const SELECTION_PANE_ROW_MENU: ChromeWording = [
  'com.labre.selection-pane.row-menu',
  'More actions',
];

/** The padlock of a locked row; the unlocked one reads `TOOLBAR_LOCK`. */
export const SELECTION_PANE_UNLOCK: ChromeWording = [
  'com.labre.selection-pane.unlock',
  'Unlock',
];

export const SELECTION_PANE_EXPAND: ChromeWording = [
  'com.labre.selection-pane.expand',
  'Expand',
];

export const SELECTION_PANE_COLLAPSE: ChromeWording = [
  'com.labre.selection-pane.collapse',
  'Collapse',
];

/**
 * The wording of a row whose element carries no text and no role: its KIND.
 *
 * The kinds the pane is the first to name get their own keys below; the
 * others reuse the word their tool, slash entry or label already declares (L7
 * dedupe: one chrome word, one key), restated here with the owner's exact
 * fallback because this package cannot import every owner's table.
 */
const SELECTION_PANE_OWN_TYPE_WORDINGS = {
  shape: ['com.labre.selection-pane.type.shape', 'Shape'],
  text: ['com.labre.selection-pane.type.text', 'Text'],
  group: ['com.labre.selection-pane.type.group', 'Group'],
  brush: ['com.labre.selection-pane.type.brush', 'Drawing'],
  'affine:bookmark': ['com.labre.selection-pane.type.bookmark', 'Link'],
  'affine:latex': ['com.labre.selection-pane.type.latex', 'Equation'],
} as const satisfies Record<string, ChromeWording>;

/** One wording per element type and gfx block flavour the library ships. */
export const SELECTION_PANE_TYPE_WORDINGS: Readonly<
  Record<string, ChromeWording>
> = {
  ...SELECTION_PANE_OWN_TYPE_WORDINGS,
  'affine:edgeless-text': SELECTION_PANE_OWN_TYPE_WORDINGS.text,
  connector: ['com.labre.connector.toolbar.connector', 'Connector'],
  mindmap: ['com.labre.surface-ref.type.mindmap', 'Mind map'],
  highlighter: ['com.labre.highlight.label', 'Highlight'],
  'affine:frame': TOOL_NAME_FRAME,
  'affine:note': TOOL_NAME_NOTE,
  'affine:image': IMAGE_LABEL,
  'affine:attachment': ATTACHMENT_LABEL,
};

/** Every `affine:embed-*` flavour: the iframe embed's own word. */
export const SELECTION_PANE_TYPE_EMBED: ChromeWording = [
  'com.labre.embed.iframe.slash.name',
  'Embed',
];

/** A kind the library does not ship: a framework's own element type. */
export const SELECTION_PANE_TYPE_ELEMENT: ChromeWording = [
  'com.labre.selection-pane.type.element',
  'Element',
];

/** Every wording this package declares, in the order it renders them. */
export const EDGELESS_TOOLBAR_WORDINGS: readonly ChromeWording[] = [
  EDGELESS_TOOLBAR_MORE_TOOLS,
  EDGELESS_TOOLBAR_FONT_FAMILY_UNAVAILABLE,
  SELECTION_PANE_TITLE,
  SELECTION_PANE_EMPTY,
  SELECTION_PANE_FILTER,
  SELECTION_PANE_FILTER_ALL,
  SELECTION_PANE_FILTER_FRAME,
  SELECTION_PANE_FILTER_BOARD,
  SELECTION_PANE_HIDE,
  SELECTION_PANE_SHOW,
  SELECTION_PANE_HIDE_FOR_EVERYONE,
  SELECTION_PANE_SHOW_FOR_EVERYONE,
  SELECTION_PANE_ROW_MENU,
  SELECTION_PANE_NEW_LAYER,
  SELECTION_PANE_ACTIVE_LAYER,
  SELECTION_PANE_UNLOCK,
  SELECTION_PANE_EXPAND,
  SELECTION_PANE_COLLAPSE,
  // Only the kinds this pane names first; the reused words are declared by
  // their owners.
  ...Object.values(SELECTION_PANE_OWN_TYPE_WORDINGS),
  SELECTION_PANE_TYPE_ELEMENT,
];
