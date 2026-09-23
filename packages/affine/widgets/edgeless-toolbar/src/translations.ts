import {
  type ChromeWording,
  ICON_BUTTON_COMING_SOON,
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

/** Every wording this package declares, in the order it renders them. */
export const EDGELESS_TOOLBAR_WORDINGS: readonly ChromeWording[] = [
  EDGELESS_TOOLBAR_MORE_TOOLS,
  EDGELESS_TOOLBAR_FONT_FAMILY_UNAVAILABLE,
];
