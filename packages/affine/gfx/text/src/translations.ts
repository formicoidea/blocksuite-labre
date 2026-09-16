import {
  type ChromeWording,
  FONT_SIZE_LABEL,
  FONT_STYLE_ITALIC,
  FONT_WEIGHT_LIGHT,
  FONT_WEIGHT_REGULAR,
  FONT_WEIGHT_SEMIBOLD,
} from '@labre/affine-shared/services';

/**
 * The shared text toolbar's own wordings (`createTextActions`, rendered by
 * every framework that draws real text — shape, mindmap, connector,
 * edgeless-text). `FONT_SIZE_LABEL` / `FONT_WEIGHT_*` / `FONT_STYLE_ITALIC`
 * are declared once in `chrome.ts` (shared with `widgets/edgeless-toolbar`'s
 * own font-weight-and-style panel, and `blocks/edgeless-text`'s font-size
 * dropdown) and re-exported here under this package's own name.
 */
export const TEXT_TOOLBAR_FONT_SIZE = FONT_SIZE_LABEL;
export const TEXT_TOOLBAR_FONT_WEIGHT_LIGHT = FONT_WEIGHT_LIGHT;
export const TEXT_TOOLBAR_FONT_WEIGHT_REGULAR = FONT_WEIGHT_REGULAR;
export const TEXT_TOOLBAR_FONT_WEIGHT_SEMIBOLD = FONT_WEIGHT_SEMIBOLD;
export const TEXT_TOOLBAR_FONT_STYLE_ITALIC = FONT_STYLE_ITALIC;

export const TEXT_TOOLBAR_FONT: ChromeWording = [
  'com.labre.text-toolbar.font',
  'Font',
];

export const TEXT_TOOLBAR_TEXT_COLOR: ChromeWording = [
  'com.labre.text-toolbar.text-color',
  'Text color',
];

export const TEXT_TOOLBAR_FONT_STYLE: ChromeWording = [
  'com.labre.text-toolbar.font-style',
  'Font style',
];

export const TEXT_TOOLBAR_ALIGNMENT: ChromeWording = [
  'com.labre.text-toolbar.alignment',
  'Alignment',
];

/**
 * The three alignment values — a different concept from a mindmap's own
 * "Left" / "Right" layout direction (`gfx/mindmap`'s
 * `MINDMAP_LAYOUT_LEFT`/`RIGHT`), so kept as this package's own keys rather
 * than shared: the English word coincides, the meaning does not.
 */
export const TEXT_ALIGN_LEFT: ChromeWording = [
  'com.labre.text-toolbar.align.left',
  'Left',
];

export const TEXT_ALIGN_CENTER: ChromeWording = [
  'com.labre.text-toolbar.align.center',
  'Center',
];

export const TEXT_ALIGN_RIGHT: ChromeWording = [
  'com.labre.text-toolbar.align.right',
  'Right',
];

/** The editor's own placeholder for an empty standalone text element. */
export const TEXT_EDITOR_PLACEHOLDER: ChromeWording = [
  'com.labre.text-toolbar.editor-placeholder',
  'Type from here',
];

/** Every wording this package DECLARES (see `SHAPE_WORDINGS`'s own note). */
export const TEXT_WORDINGS: readonly ChromeWording[] = [
  TEXT_TOOLBAR_FONT,
  TEXT_TOOLBAR_TEXT_COLOR,
  TEXT_TOOLBAR_FONT_STYLE,
  TEXT_TOOLBAR_ALIGNMENT,
  TEXT_ALIGN_LEFT,
  TEXT_ALIGN_CENTER,
  TEXT_ALIGN_RIGHT,
  TEXT_EDITOR_PLACEHOLDER,
];
