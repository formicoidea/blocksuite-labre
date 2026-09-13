import type { NamedPalette } from '@labre/affine-components/color-picker';
import {
  neutralPalettes,
  paletteColorAction,
  shapeToolbarConfig,
} from '@labre/affine-gfx-shape';
import {
  type Color,
  type ShapeElementModel,
  WardleyNodeElementModel,
} from '@labre/affine-model';
import {
  type ChromeWording,
  type ToolbarActions,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';

import {
  AREA_FILL,
  INERTIA_COLOR,
  METHOD_FILL,
  WARDLEY_RED,
} from '../node/consts';

/** The two hex digits `AREA_FILL` carries — the zone's ~25 % opacity. */
const AREA_ALPHA = AREA_FILL.slice(-2);

/** A plain 6-digit hex, the only shape a swatch value takes. */
const SIX_DIGIT_HEX = /^#[0-9a-f]{6}$/i;

/**
 * What a picked swatch WRITES on a Wardley node.
 *
 * The identity on every artefact but one. A zone is drawn over the components
 * it groups, so its fill is a WASH — `#c6dbfc40`, the alpha being the whole of
 * what keeps the map readable underneath — and a picker that wrote the swatch
 * as-is would replace it with an opaque hue and hide the map the zone annotates
 * (recette of #213). So a swatch picked for an area keeps the zone's alpha.
 *
 * Only a bare 6-digit hex is touched: a value that already carries alpha is
 * somebody's deliberate choice from the custom picker, and a theme token
 * (`--affine-…`) is not a hex at all and must reach the document intact.
 */
export function wardleyFillColor(
  model: ShapeElementModel,
  value: Color
): Color {
  if (!(model instanceof WardleyNodeElementModel)) return value;
  if (model.kind !== 'area') return value;
  if (typeof value !== 'string' || !SIX_DIGIT_HEX.test(value)) return value;
  return `${value}${AREA_ALPHA}`;
}

/**
 * The nine Wardley swatches' own names, resolved by `resolvePaletteLabel`
 * (`@labre/affine-components/color-picker`) through each swatch's own
 * {@link NamedPalette.labelWording} — the framework-agnostic mechanism a
 * gfx module uses to name a palette without touching `Palette`
 * (`packages/affine/model`, RED ZONE) or importing another framework.
 *
 * Exported so `../translations.ts` can list them in the manifest under
 * source `chrome`, the same treatment `WARDLEY_TOOLBAR_WORDINGS` already
 * gets — a swatch's name is toolbar chrome, re-rendered on every locale
 * switch, never seeded into a document.
 */
export const WARDLEY_PALETTE_WORDING_WONDER: ChromeWording = [
  'com.labre.wardley.palette.wonder',
  'Wonder',
];
export const WARDLEY_PALETTE_WORDING_PEACE: ChromeWording = [
  'com.labre.wardley.palette.peace',
  'Peace',
];
export const WARDLEY_PALETTE_WORDING_WAR: ChromeWording = [
  'com.labre.wardley.palette.war',
  'War',
];
export const WARDLEY_PALETTE_WORDING_WONDER_LIGHT: ChromeWording = [
  'com.labre.wardley.palette.wonder-light',
  'Wonder light',
];
export const WARDLEY_PALETTE_WORDING_PEACE_LIGHT: ChromeWording = [
  'com.labre.wardley.palette.peace-light',
  'Peace light',
];
export const WARDLEY_PALETTE_WORDING_WAR_LIGHT: ChromeWording = [
  'com.labre.wardley.palette.war-light',
  'War light',
];
export const WARDLEY_PALETTE_WORDING_RED: ChromeWording = [
  'com.labre.wardley.palette.wardley-red',
  'Wardley red',
];
export const WARDLEY_PALETTE_WORDING_INERTIA: ChromeWording = [
  'com.labre.wardley.palette.inertia',
  'Inertia',
];
export const WARDLEY_PALETTE_WORDING_METHOD_GREY: ChromeWording = [
  'com.labre.wardley.palette.method-grey',
  'Method grey',
];

export const WARDLEY_PALETTE_WORDINGS: readonly ChromeWording[] = [
  WARDLEY_PALETTE_WORDING_WONDER,
  WARDLEY_PALETTE_WORDING_PEACE,
  WARDLEY_PALETTE_WORDING_WAR,
  WARDLEY_PALETTE_WORDING_WONDER_LIGHT,
  WARDLEY_PALETTE_WORDING_PEACE_LIGHT,
  WARDLEY_PALETTE_WORDING_WAR_LIGHT,
  WARDLEY_PALETTE_WORDING_RED,
  WARDLEY_PALETTE_WORDING_INERTIA,
  WARDLEY_PALETTE_WORDING_METHOD_GREY,
];

/**
 * The Wardley **evolution cycle**, surfaced as ready-made swatches in the node
 * colour picker: Wonder / Peace / War, the three climatic phases a component
 * travels through in Simon Wardley's pattern — saturated first, then the light
 * shades for a fill under a label — followed by the three colours the notation
 * itself already uses (the evolution arrow's red, the inertia bar, a method's
 * neutral fill).
 *
 * They are SHORTCUTS, never constraints: nothing in the map reads a colour, so
 * an author is free to ignore them, and the custom picker stays one click away.
 */
const WARDLEY_PALETTES: NamedPalette[] = [
  {
    key: 'Wonder',
    value: '#3ec9f2',
    labelWording: WARDLEY_PALETTE_WORDING_WONDER,
  },
  {
    key: 'Peace',
    value: '#5b9cf6',
    labelWording: WARDLEY_PALETTE_WORDING_PEACE,
  },
  { key: 'War', value: '#9d6df0', labelWording: WARDLEY_PALETTE_WORDING_WAR },
  {
    key: 'Wonder light',
    value: '#b9e9fa',
    labelWording: WARDLEY_PALETTE_WORDING_WONDER_LIGHT,
  },
  {
    key: 'Peace light',
    value: '#c6dbfc',
    labelWording: WARDLEY_PALETTE_WORDING_PEACE_LIGHT,
  },
  {
    key: 'War light',
    value: '#d9c9fa',
    labelWording: WARDLEY_PALETTE_WORDING_WAR_LIGHT,
  },
  {
    key: 'Wardley red',
    value: WARDLEY_RED,
    labelWording: WARDLEY_PALETTE_WORDING_RED,
  },
  {
    key: 'Inertia',
    value: INERTIA_COLOR,
    labelWording: WARDLEY_PALETTE_WORDING_INERTIA,
  },
  {
    key: 'Method grey',
    value: METHOD_FILL,
    labelWording: WARDLEY_PALETTE_WORDING_METHOD_GREY,
  },
];

/**
 * From the default editor palette we keep ONLY the neutrals — the historical
 * colours are dropped in favour of the Wardley swatches above.
 */
export const WARDLEY_PALETTE_LIST: NamedPalette[] = [
  ...WARDLEY_PALETTES,
  ...neutralPalettes(),
];

/**
 * Wardley nodes are {@link ShapeElementModel} subclasses, so the shape toolbar's
 * actions (which target `getSurfaceModelsByType(ShapeElementModel)`) operate on
 * them directly. We re-register only the line-style action plus a colour picker
 * seeded with the Wardley swatches, so the circle's fill / stroke color / stroke
 * width stay editable — while excluding the shape-only actions (switch type, add
 * inner text) that don't make sense for a Wardley node.
 */
const KEEP_ACTION_IDS = new Set(['d.style']);

/**
 * The shape toolbar's vertex editor, kept for ONE artefact: an area drawn as a
 * polygon.
 *
 * Every other polygon on a Wardley map has an outline that IS the notation — an
 * accelerator points right and a decelerator points left, and dragging a barb
 * would turn a statement about the climate into a grey blob. A zone is the
 * opposite: its whole job is to follow the components it groups, so moving its
 * corners is the point of choosing the polygon over the rectangle.
 *
 * The shape action's own `when` already asks for a single ungrouped polygon —
 * which excludes the two climate arrows, since both are grouped with their name
 * — but it is narrowed HERE to `kind === 'area'` rather than left to rely on
 * that: an arrow selected from inside its group, or one an author ungrouped,
 * would otherwise offer a gesture that can only damage it.
 */
const VERTEX_ACTION_ID = 'f1.edit-vertices';

function isAreaSelection(ctx: ToolbarContext): boolean {
  const models = ctx.getSurfaceModelsByType(WardleyNodeElementModel);
  return models.length > 0 && models.every(model => model.kind === 'area');
}

const areaVertexActions: ToolbarActions = shapeToolbarConfig.actions
  .filter(action => action.id === VERTEX_ACTION_ID)
  .map(action => {
    const when = action.when;
    return {
      ...action,
      when: (ctx: ToolbarContext) =>
        isAreaSelection(ctx) &&
        (typeof when === 'function' ? when(ctx) : when !== false),
    };
  });

const wardleyNodeToolbarConfig = {
  actions: [
    ...shapeToolbarConfig.actions.filter(action =>
      KEEP_ACTION_IDS.has(action.id)
    ),
    ...areaVertexActions,
    paletteColorAction('e.color', WARDLEY_PALETTE_LIST, wardleyFillColor),
  ],
  when: shapeToolbarConfig.when,
} as ToolbarModuleConfig;

export const wardleyNodeToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:wardleyNode'),
  config: wardleyNodeToolbarConfig,
});
