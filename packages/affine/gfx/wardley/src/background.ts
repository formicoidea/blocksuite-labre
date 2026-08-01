import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';

import {
  ARROW,
  AXIS_LABELS,
  CARD_RADIUS,
  COLORS,
  FONT_FAMILY,
  FONTS,
  LINE,
  MARGIN,
  OFFSETS,
  PHASE_LABELS,
  REF_WIDTH,
} from './consts';
import { WARDLEY_WASHES } from './gradient';
import { WARDLEY_RED } from './node/consts';
import { WARDLEY_ROLE } from './roles';

/**
 * The Wardley map background, DECLARED (PF2.12).
 *
 * This file is the whole of what makes a Wardley background look like a Wardley
 * background. There is no Wardley rendering code left: the primitive
 * (`FrameworkBackgroundDef` / `createFrameworkBackgroundRenderer` in
 * `@labre/affine-block-surface`) paints this declaration, and would paint any
 * other framework's the same way.
 *
 * Nothing here changes the DOCUMENT. The persisted element type is still
 * `wardley` and its props are untouched — `variant`, `banded`, the ten label
 * texts, the six visibility toggles — they are simply named by the declaration
 * instead of being read by hand-written drawing code. A map authored before
 * this file existed opens with the same geometry, the same zones and the same
 * words.
 *
 * ## i18n
 *
 * Every label declares BOTH a `labelKey` (the vocabulary, for a host that ships
 * a locale) and a `prop` (the user's own text, which always wins).
 *
 * For the key to be REACHABLE the prop has to be able to be absent, so the ten
 * label fields on `WardleyBackgroundElementModel` default to `undefined`: an
 * `undefined` default is written nowhere (see `field.ts`), so a map the user
 * has never renamed carries no label key at all and falls through to the
 * vocabulary. The moment the user edits a label in place, the prop is written
 * and wins forever after — which is exactly the old behaviour, arrived at from
 * the other side.
 *
 * A map authored before this change carries all ten props with their English
 * values and is completely unaffected.
 */

/**
 * Green, for the benefit half of the tone convention (Q5).
 *
 * Declared here rather than in `node/consts.ts` because nothing DRAWS it: no
 * Wardley artefact is created green, and the framework has no "benefit" role
 * yet. It exists so the convention has a reference colour to be judged against
 * — the day an artefact of that kind is created, it takes this entry, and the
 * check-up already knows about it.
 *
 * Picked in the same register as {@link WARDLEY_RED}, so a map using both reads
 * as one palette rather than as two decisions.
 */
const BENEFIT_GREEN = '#2f9e63';

/**
 * The colour code: every colour below is named, never repeated as a hex.
 *
 * The last three entries are the **tone convention** (PF13.8 / Q5), and they are
 * palette entries for a reason: the check-up rule names them
 * (`ToneConventionDef.palette`) instead of restating a colour, so the convention
 * and the map are restyled together, in one place, by whoever owns the frame.
 * Nothing paints them — see {@link BENEFIT_GREEN} — which is exactly what a
 * declared REFERENCE looks like.
 */
const PALETTE = {
  card: COLORS.card,
  cardBorder: COLORS.cardBorder,
  axis: COLORS.axis,
  divider: COLORS.divider,
  label: COLORS.label,
  band0: COLORS.band[0],
  band1: COLORS.band[1],
  band2: COLORS.band[2],
  band3: COLORS.band[3],
  /** The landscape: everything the map is MADE of, drawn in greys. */
  landscape: COLORS.label,
  /** Reserved for what is moving — change points, investments, costs. */
  change: WARDLEY_RED,
  /** Reserved for benefits and functional differences. */
  benefit: BENEFIT_GREEN,
} as const;

const AXIS_TEXT = { size: FONTS.axis, color: '@axis' } as const;
const PHASE_TEXT = { size: FONTS.phase, color: '@label' } as const;
const DIRECTION_TEXT = { size: FONTS.direction, color: '@label' } as const;
const VISIBILITY_TEXT = { size: FONTS.visibility, color: '@label' } as const;

/**
 * The four evolution phases, as named zones of the plot. `banded` tints them,
 * `showColumnLabels` names them; the dashed dividers between them are the
 * graduations of the evolution axis, declared with it.
 */
const EVOLUTION_ZONES: FrameworkBackgroundDef['zones'] = [
  {
    id: 'genesis',
    rect: { x: 0, y: 0, w: 0.175, h: 1 },
    fill: '@band0',
    fillVisibleProp: 'banded',
    label: {
      id: 'phase0',
      prop: 'phase0',
      labelKey: 'com.labre.wardley.background.phase.genesis',
      fallback: PHASE_LABELS.genesis,
      anchor: { x: 0, y: 1, dx: OFFSETS.phasePad, dy: OFFSETS.phaseBaseline },
      style: PHASE_TEXT,
      align: 'left',
      visibleProp: 'showColumnLabels',
    },
  },
  {
    id: 'custom-built',
    rect: { x: 0.175, y: 0, w: 0.225, h: 1 },
    fill: '@band1',
    fillVisibleProp: 'banded',
    label: {
      id: 'phase1',
      prop: 'phase1',
      labelKey: 'com.labre.wardley.background.phase.custom-built',
      fallback: PHASE_LABELS.customBuilt,
      anchor: {
        x: 0.175,
        y: 1,
        dx: OFFSETS.phasePad,
        dy: OFFSETS.phaseBaseline,
      },
      style: PHASE_TEXT,
      align: 'left',
      visibleProp: 'showColumnLabels',
    },
  },
  {
    id: 'product',
    rect: { x: 0.4, y: 0, w: 0.3, h: 1 },
    fill: '@band2',
    fillVisibleProp: 'banded',
    label: {
      id: 'phase2',
      prop: 'phase2',
      labelKey: 'com.labre.wardley.background.phase.product',
      fallback: PHASE_LABELS.product,
      anchor: { x: 0.4, y: 1, dx: OFFSETS.phasePad, dy: OFFSETS.phaseBaseline },
      style: PHASE_TEXT,
      align: 'left',
      visibleProp: 'showColumnLabels',
    },
  },
  {
    id: 'commodity',
    rect: { x: 0.7, y: 0, w: 0.3, h: 1 },
    fill: '@band3',
    fillVisibleProp: 'banded',
    label: {
      id: 'phase3',
      prop: 'phase3',
      labelKey: 'com.labre.wardley.background.phase.commodity',
      fallback: PHASE_LABELS.commodity,
      anchor: { x: 0.7, y: 1, dx: OFFSETS.phasePad, dy: OFFSETS.phaseBaseline },
      style: PHASE_TEXT,
      align: 'left',
      visibleProp: 'showColumnLabels',
    },
  },
];

/**
 * The two axes. Evolution runs along the bottom with its phase dividers as
 * graduations; Value Chain runs up the left edge. Both arrows point "forward",
 * i.e. towards more evolved / more visible.
 *
 * The end labels (Uncharted / Industrialized, Visible / Invisible) carry their
 * own visibility: naming where an axis leads has always been a separate toggle
 * from drawing the axis, and the declaration keeps it that way.
 */
const WARDLEY_AXES: FrameworkBackgroundDef['axes'] = [
  {
    id: 'evolution',
    orientation: 'horizontal',
    at: 1,
    arrow: 'forward',
    arrowSize: ARROW,
    stroke: { color: '@axis', width: LINE.axis },
    visibleProp: 'showXAxis',
    title: {
      id: 'xAxisTitle',
      prop: 'xAxisTitle',
      labelKey: 'com.labre.wardley.background.axis.evolution',
      fallback: AXIS_LABELS.xAxis,
      anchor: {
        x: 1,
        y: 1,
        dx: -OFFSETS.evolutionPadRight,
        dy: OFFSETS.phaseBaseline,
      },
      style: AXIS_TEXT,
      align: 'right',
    },
    endLabels: [
      {
        id: 'evolutionStart',
        prop: 'evolutionStart',
        labelKey: 'com.labre.wardley.background.evolution.start',
        fallback: AXIS_LABELS.evolutionStart,
        anchor: {
          x: 0,
          y: 0,
          dx: OFFSETS.directionPadLeft,
          dy: OFFSETS.directionTop,
        },
        style: DIRECTION_TEXT,
        align: 'left',
        visibleProp: 'showCornerLabels',
      },
      {
        id: 'evolutionEnd',
        prop: 'evolutionEnd',
        labelKey: 'com.labre.wardley.background.evolution.end',
        fallback: AXIS_LABELS.evolutionEnd,
        anchor: {
          x: 1,
          y: 0,
          dx: -OFFSETS.directionPadRight,
          dy: OFFSETS.directionTop,
        },
        style: DIRECTION_TEXT,
        align: 'right',
        visibleProp: 'showCornerLabels',
      },
    ],
    ticks: {
      ticks: [{ at: 0.175 }, { at: 0.4 }, { at: 0.7 }],
      stroke: { color: '@divider', width: LINE.divider, dash: [5, 5] },
      visibleProp: 'showColumnDividers',
    },
  },
  {
    id: 'value-chain',
    orientation: 'vertical',
    at: 0,
    arrow: 'forward',
    arrowSize: ARROW,
    stroke: { color: '@axis', width: LINE.axis },
    visibleProp: 'showYAxis',
    title: {
      id: 'yAxisTitle',
      prop: 'yAxisTitle',
      labelKey: 'com.labre.wardley.background.axis.value-chain',
      fallback: AXIS_LABELS.yAxis,
      anchor: { x: 0, y: 0.5, dx: -OFFSETS.yHug, dy: 0 },
      style: AXIS_TEXT,
      vertical: true,
    },
    endLabels: [
      {
        id: 'visibilityHigh',
        prop: 'visibilityHigh',
        labelKey: 'com.labre.wardley.background.visibility.high',
        fallback: AXIS_LABELS.visibilityHigh,
        anchor: { x: 0, y: 0, dx: -OFFSETS.yHug, dy: OFFSETS.visibleTop },
        style: VISIBILITY_TEXT,
        vertical: true,
        visibleProp: 'showVisibilityLabels',
      },
      {
        id: 'visibilityLow',
        prop: 'visibilityLow',
        labelKey: 'com.labre.wardley.background.visibility.low',
        fallback: AXIS_LABELS.visibilityLow,
        anchor: { x: 0, y: 1, dx: -OFFSETS.yHug, dy: -OFFSETS.invisibleBottom },
        style: VISIBILITY_TEXT,
        vertical: true,
        visibleProp: 'showVisibilityLabels',
      },
    ],
  },
];

export const WARDLEY_BACKGROUND: FrameworkBackgroundDef = {
  type: 'wardley',
  // The map is a first-class role: validation rules position artefacts against
  // `wardley:map`, never against the `wardley` element type.
  role: WARDLEY_ROLE.map,
  variantProp: 'variant',
  geometry: {
    width: REF_WIDTH,
    height: (REF_WIDTH * 9) / 16,
    lockAspectRatio: true,
    // A map is a frame you place things on, not a shape you nudge: the handles
    // stay locked until the user asks for them from the toolbar.
    resizable: false,
    margin: MARGIN,
  },
  chrome: {
    fontFamily: FONT_FAMILY,
    palette: PALETTE,
    surface: {
      fill: '@card',
      border: { color: '@cardBorder', width: LINE.card, radius: CARD_RADIUS },
    },
    washes: WARDLEY_WASHES,
  },
  zones: EVOLUTION_ZONES,
  axes: WARDLEY_AXES,
  /**
   * The **zone of punctuated equilibrium**: how wide, as a ratio of the plot,
   * the frontier between two evolution phases really is.
   *
   * Wardley's point is that a phase transition is not a coordinate. Things do
   * not become products at `x = 0.4`; they resist, then move, and the inertia
   * that resists lives AROUND the frontier. A rule asking "is this symbol at
   * the transition" therefore measures against this band, not against the
   * dashed line the renderer draws.
   *
   * `0.1` of the plot — ±5% either side of the divider — chosen on the PO
   * recette of 01/08/2026, where two bars dropped by eye on the "Product" and
   * "Commodity" dividers had to come out green. In model units that is ±76 on
   * the 1600-wide reference map (against the 40 absolute units it replaces) and
   * ±36 on an 800-wide one — the same band to the eye at every size, which is
   * the whole reason it is a ratio. Still narrow enough to mean something: the
   * narrowest gap between two transitions is 0.225 of the plot, so its middle
   * stays 0.0625 of the plot clear of either band.
   */
  transitionBandWidth: 0.1,
};

/**
 * The props the in-place label editor is allowed to write.
 *
 * A closed list, not `string`: the hit test reports whatever `prop` a
 * declaration names, and since #73 an element preserves keys it does not
 * declare — so a typo in the declaration would happily persist a junk key onto
 * every map it was double-clicked on. This is the gate between "the
 * declaration says so" and "the document gets it".
 */
export const WARDLEY_LABEL_PROPS = [
  'xAxisTitle',
  'yAxisTitle',
  'evolutionStart',
  'evolutionEnd',
  'visibilityHigh',
  'visibilityLow',
  'phase0',
  'phase1',
  'phase2',
  'phase3',
] as const;

export type WardleyLabelProp = (typeof WARDLEY_LABEL_PROPS)[number];

export function isWardleyLabelProp(prop: string): prop is WardleyLabelProp {
  return (WARDLEY_LABEL_PROPS as readonly string[]).includes(prop);
}
