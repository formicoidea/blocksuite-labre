import {
  ADD_TEXT_TOOLTIP,
  type ChromeWording,
  STYLE_GENERAL,
  STYLE_MENU_LABEL,
  STYLE_SCRIBBLED,
  TOOL_NAME_SHAPE,
} from '@labre/affine-shared/services';

/**
 * The shape toolbar's own wordings. `STYLE_GENERAL` / `STYLE_SCRIBBLED` /
 * `STYLE_MENU_LABEL` / `TOOL_NAME_SHAPE` are declared once in `chrome.ts`
 * (shared with `widgets/edgeless-toolbar` and `gfx/mindmap`) and re-exported
 * here under this package's own name, so a call site in this package can
 * import everything it needs from one place.
 */
export const SHAPE_STYLE_GENERAL = STYLE_GENERAL;
export const SHAPE_STYLE_SCRIBBLED = STYLE_SCRIBBLED;
export const SHAPE_STYLE_MENU_LABEL = STYLE_MENU_LABEL;
export const SHAPE_TOOL_NAME = TOOL_NAME_SHAPE;

/* ── Text-fit cycling button ───────────────────────────────────────────── */

export const SHAPE_TEXT_FIT_GROW: ChromeWording = [
  'com.labre.shape.text-fit.grow',
  'Grow shape',
];

export const SHAPE_TEXT_FIT_CONTAINED: ChromeWording = [
  'com.labre.shape.text-fit.contained',
  'Contained text',
];

export const SHAPE_TEXT_FIT_OVERFLOW: ChromeWording = [
  'com.labre.shape.text-fit.overflow',
  'Overflow text',
];

/**
 * The cycling button's aria-label and tooltip — interpolated with the
 * already-resolved mode label(s) rather than split into per-word keys (the
 * brief's "don't split a sentence" rule).
 */
export const SHAPE_TEXT_FIT_ARIA: ChromeWording = [
  'com.labre.shape.text-fit.aria',
  'Text fit: {{label}}',
];

export const SHAPE_TEXT_FIT_TOOLTIP: ChromeWording = [
  'com.labre.shape.text-fit.tooltip',
  'Text fit: {{label}} — click for {{nextLabel}}',
];

/* ── Toolbar actions ────────────────────────────────────────────────────── */

export const SHAPE_SWITCH_TYPE_LABEL: ChromeWording = [
  'com.labre.shape.toolbar.switch-type',
  'Switch shape type',
];

/**
 * The accessible name of the shape-type menu SHELL (#390) — its own wording,
 * not `` `${SHAPE_SWITCH_TYPE_LABEL}-menu` ``, which is what produced
 * "changer le type de forme-menu" on a French host. The fallback is the exact
 * identifier that composition produced in English.
 */
export const SHAPE_SWITCH_TYPE_MENU_ARIA: ChromeWording = [
  'com.labre.shape.toolbar.switch-type-menu',
  'switch shape type-menu',
];

export const SHAPE_ADD_TEXT_TOOLTIP = ADD_TEXT_TOOLTIP;

export const SHAPE_EDIT_VERTICES_TOOLTIP: ChromeWording = [
  'com.labre.shape.toolbar.edit-vertices',
  'Edit vertices',
];

/* ── Shape names (switch-type menu, drag basket) ───────────────────────── */

export const SHAPE_NAME_SQUARE: ChromeWording = [
  'com.labre.shape.name.square',
  'Square',
];

export const SHAPE_NAME_ELLIPSE: ChromeWording = [
  'com.labre.shape.name.ellipse',
  'Ellipse',
];

export const SHAPE_NAME_DIAMOND: ChromeWording = [
  'com.labre.shape.name.diamond',
  'Diamond',
];

export const SHAPE_NAME_TRIANGLE: ChromeWording = [
  'com.labre.shape.name.triangle',
  'Triangle',
];

export const SHAPE_NAME_POLYGON: ChromeWording = [
  'com.labre.shape.name.polygon',
  'Polygon',
];

export const SHAPE_NAME_ROUNDED_RECT: ChromeWording = [
  'com.labre.shape.name.rounded-rect',
  'Rounded rectangle',
];

/**
 * Every wording this package DECLARES (not the re-exported chrome ones — they
 * are `CHROME_WORDINGS` entries already, and listing them again here would
 * offer a host the same key twice).
 */
export const SHAPE_WORDINGS: readonly ChromeWording[] = [
  SHAPE_TEXT_FIT_GROW,
  SHAPE_TEXT_FIT_CONTAINED,
  SHAPE_TEXT_FIT_OVERFLOW,
  SHAPE_TEXT_FIT_ARIA,
  SHAPE_TEXT_FIT_TOOLTIP,
  SHAPE_SWITCH_TYPE_LABEL,
  SHAPE_SWITCH_TYPE_MENU_ARIA,
  SHAPE_EDIT_VERTICES_TOOLTIP,
  SHAPE_NAME_SQUARE,
  SHAPE_NAME_ELLIPSE,
  SHAPE_NAME_DIAMOND,
  SHAPE_NAME_TRIANGLE,
  SHAPE_NAME_POLYGON,
  SHAPE_NAME_ROUNDED_RECT,
];
