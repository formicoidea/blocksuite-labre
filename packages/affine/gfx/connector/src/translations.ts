import { ConnectorMode } from '@labre/affine-model';
import {
  ADD_TEXT_TOOLTIP,
  type ChromeWording,
  STYLE_MENU_LABEL,
} from '@labre/affine-shared/services';

/**
 * This package's own wordings, joined into `PACKAGE_WORDINGS` in
 * `@labre/affine/translations` — see that file and
 * `packages/affine/shared/src/services/translation-service/README.md`.
 */

/* ── The three connector modes, said everywhere a connector is edited ─── */

export const CONNECTOR_MODE_STRAIGHT: ChromeWording = [
  'com.labre.connector.mode.straight',
  'Straight',
];
export const CONNECTOR_MODE_ELBOWED: ChromeWording = [
  'com.labre.connector.mode.elbowed',
  'Elbowed',
];
export const CONNECTOR_MODE_CURVE: ChromeWording = [
  'com.labre.connector.mode.curve',
  'Curve',
];

/**
 * `ConnectorMode` → its wording, so a render site resolves a mode without
 * repeating the three-way switch. Supersedes `getConnectorModeName`
 * (`packages/affine/model`, a red-zone-adjacent package this lot leaves
 * untouched): that helper's own English literals are now dead for display —
 * its sole caller (`connector-tool-button.ts`) reads this table instead.
 */
export const CONNECTOR_MODE_WORDING: Record<ConnectorMode, ChromeWording> = {
  [ConnectorMode.Straight]: CONNECTOR_MODE_STRAIGHT,
  [ConnectorMode.Orthogonal]: CONNECTOR_MODE_ELBOWED,
  [ConnectorMode.Curve]: CONNECTOR_MODE_CURVE,
};

/* ── The connector contextual toolbar ──────────────────────────────────── */

export const CONNECTOR_LABEL_CONNECTOR: ChromeWording = [
  'com.labre.connector.toolbar.connector',
  'Connector',
];

export const CONNECTOR_LABEL_STROKE_STYLE: ChromeWording = [
  'com.labre.connector.toolbar.stroke-style',
  'Stroke style',
];

export const CONNECTOR_LABEL_STYLE = STYLE_MENU_LABEL;

export const CONNECTOR_LABEL_START_POINT_STYLE: ChromeWording = [
  'com.labre.connector.toolbar.start-point-style',
  'Start point style',
];

/* ── The menu shells' accessible names (#390) ─────────────────────────────
 *
 * Each `aria-label` is its own wording rather than `` `${label}-menu` ``: the
 * four labels above go through the seam, so the composition read "style de
 * point de départ-menu" on a French host. Fallbacks are the exact identifiers
 * the composition produced in English. The plain "Style" menu reuses the
 * shared `MENU_ARIA_STYLE` — three toolbars draw that same menu.
 */

export const CONNECTOR_START_POINT_STYLE_MENU_ARIA: ChromeWording = [
  'com.labre.connector.toolbar.start-point-style-menu',
  'start point style-menu',
];

export const CONNECTOR_TOOLTIP_FLIP_DIRECTION: ChromeWording = [
  'com.labre.connector.toolbar.flip-direction',
  'Flip direction',
];

export const CONNECTOR_LABEL_END_POINT_STYLE: ChromeWording = [
  'com.labre.connector.toolbar.end-point-style',
  'End point style',
];

export const CONNECTOR_END_POINT_STYLE_MENU_ARIA: ChromeWording = [
  'com.labre.connector.toolbar.end-point-style-menu',
  'end point style-menu',
];

export const CONNECTOR_LABEL_SHAPE: ChromeWording = [
  'com.labre.connector.toolbar.shape',
  'Shape',
];

export const CONNECTOR_SHAPE_MENU_ARIA: ChromeWording = [
  'com.labre.connector.toolbar.shape-menu',
  'shape-menu',
];

export const CONNECTOR_TOOLTIP_CONNECTOR_SHAPE: ChromeWording = [
  'com.labre.connector.toolbar.connector-shape',
  'Connector shape',
];

/**
 * "Add text" — the contextual-toolbar action AND the label editor's own
 * empty-state placeholder say the exact same word, one key.
 */
export const CONNECTOR_ADD_TEXT = ADD_TEXT_TOOLTIP;

export const CONNECTOR_WORDINGS: readonly ChromeWording[] = [
  CONNECTOR_MODE_STRAIGHT,
  CONNECTOR_MODE_ELBOWED,
  CONNECTOR_MODE_CURVE,
  CONNECTOR_LABEL_CONNECTOR,
  CONNECTOR_LABEL_STROKE_STYLE,
  CONNECTOR_LABEL_START_POINT_STYLE,
  CONNECTOR_START_POINT_STYLE_MENU_ARIA,
  CONNECTOR_TOOLTIP_FLIP_DIRECTION,
  CONNECTOR_LABEL_END_POINT_STYLE,
  CONNECTOR_END_POINT_STYLE_MENU_ARIA,
  CONNECTOR_LABEL_SHAPE,
  CONNECTOR_SHAPE_MENU_ARIA,
  CONNECTOR_TOOLTIP_CONNECTOR_SHAPE,
];
