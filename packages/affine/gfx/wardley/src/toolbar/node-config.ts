import {
  neutralPalettes,
  paletteColorAction,
  shapeToolbarConfig,
} from '@labre/affine-gfx-shape';
import {
  type Color,
  type Palette,
  type ShapeElementModel,
  WardleyNodeElementModel,
} from '@labre/affine-model';
import {
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

/** The two hex digits `AREA_FILL` carries — the zone's ~60 % opacity. */
const AREA_ALPHA = AREA_FILL.slice(-2);

/** A plain 6-digit hex, the only shape a swatch value takes. */
const SIX_DIGIT_HEX = /^#[0-9a-f]{6}$/i;

/**
 * What a picked swatch WRITES on a Wardley node.
 *
 * The identity on every artefact but one. A zone is drawn over the components
 * it groups, so its fill is a WASH — `#c6dbfc99`, the alpha being the whole of
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
const WARDLEY_PALETTES: Palette[] = [
  { key: 'Wonder', value: '#3ec9f2' },
  { key: 'Peace', value: '#5b9cf6' },
  { key: 'War', value: '#9d6df0' },
  { key: 'Wonder light', value: '#b9e9fa' },
  { key: 'Peace light', value: '#c6dbfc' },
  { key: 'War light', value: '#d9c9fa' },
  { key: 'Wardley red', value: WARDLEY_RED },
  { key: 'Inertia', value: INERTIA_COLOR },
  { key: 'Method grey', value: METHOD_FILL },
];

/**
 * From the default editor palette we keep ONLY the neutrals — the historical
 * colours are dropped in favour of the Wardley swatches above.
 */
export const WARDLEY_PALETTE_LIST: Palette[] = [
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
