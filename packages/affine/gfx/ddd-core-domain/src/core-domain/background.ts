import type {
  BackgroundTextDef,
  BackgroundTextStyle,
  FrameworkBackgroundDef,
} from '@labre/affine-block-surface';
import { CD_SUBDOMAINS, FONT_FAMILY } from '@labre/affine-gfx-ddd-shared';

import { CORE_DOMAIN_ROLE } from '../roles';

/**
 * The Core Domain Chart background, DECLARED.
 *
 * This file is the whole of what makes a Core Domain Chart look like a Core
 * Domain Chart. There is no chart-specific rendering code left: the primitive
 * (`FrameworkBackgroundDef` / `createFrameworkBackgroundRenderer` in
 * `@labre/affine-block-surface`) paints this declaration, and would paint any
 * other framework's the same way.
 *
 * Nothing here changes the DOCUMENT. The persisted element type is still
 * `coreDomain` and its props are untouched — `showZones`, `showLabels`,
 * `resizeEnabled` — they are simply named by the declaration instead of being
 * read by hand-written drawing code. A chart authored before this file existed
 * opens with the same geometry, the same bands and the same words: every
 * coordinate below is the old `consts.ts` value converted, once, into a ratio of
 * the plot, and `__tests__/background.unit.spec.ts` pins the conversion against
 * the absolute numbers it came from.
 *
 * ## Two readings of one frame
 *
 * `variantProp: 'variant'` (see `CoreDomainChartElementModel.variant`) selects
 * between the CLASSIC chart — Generic / Supporting / Core — and the MIGRATION
 * one, whose four quadrants name the migration conversation instead. Same axes,
 * same geometry, same element: only the regions and the vertical axis' title
 * change, which is precisely what a variant is for. No validation rule cites a
 * migration zone.
 */

/**
 * The authoring reference space, kept as documentation of where every ratio
 * below comes from: the chart was drawn at 900 × 820 with its plot inset by the
 * margins declared in {@link CORE_DOMAIN_BACKGROUND}, so the plot is 786 × 746
 * and `(absolute - origin) / span` is the conversion.
 */
const PLOT = { x0: 60, y0: 24, width: 786, height: 746 } as const;

/** An absolute X of the reference drawing, as a ratio of the plot. */
const rx = (x: number) => (x - PLOT.x0) / PLOT.width;
/** An absolute Y of the reference drawing, as a ratio of the plot. */
const ry = (y: number) => (y - PLOT.y0) / PLOT.height;
/** An absolute width, as a ratio of the plot width. */
const rw = (w: number) => w / PLOT.width;
/** An absolute height, as a ratio of the plot height. */
const rh = (h: number) => h / PLOT.height;

/**
 * The colour code: every colour is named, never repeated as a hex.
 *
 * The last five entries are the **legend**, and they are palette entries for a
 * reason: `core-domain.off-legend-colour` names them
 * (`ToneConventionDef.palette`) instead of restating a colour, so the notation
 * and the chart are restyled together, in one place. They are read straight off
 * `CD_SUBDOMAINS`, the very table the sub-menu builds its five dots from — the
 * convention and the swatches can therefore never drift apart.
 *
 * The zone tints carry their alpha BAKED INTO THE HEX (`…99` is the 0.6 the
 * old renderer set with `globalAlpha`): a zone fill is handed to `fillStyle`
 * verbatim, so eight-digit hex is how a translucent band is declared.
 */
const PALETTE = {
  axis: '#000000',
  title: '#000000',
  tick: '#777777',
  /** Zone names of the classic reading: white, over saturated bands. */
  zoneLabel: '#ffffff',
  /** Zone names of the migration reading: ink, over pale tints. */
  zoneLabelDark: '#1f2328',
  zoneGeneric: '#b3b3b399',
  zoneSupporting: '#9933ff99',
  zoneCore: '#4d990099',
  zoneLowHangingFruit: '#4d990026',
  zoneRiskSeeking: '#9933ff26',
  zoneRiskAverse: '#b3b3b326',
  zoneLastToothpaste: '#ff333326',
  ...Object.fromEntries(
    CD_SUBDOMAINS.map(preset => [preset.kind, preset.fill] as const)
  ),
} as const;

/** The palette entries the notation is made of — the tone convention's reference. */
export const CORE_DOMAIN_LEGEND_TONES: readonly string[] = CD_SUBDOMAINS.map(
  preset => preset.kind
);

const AXIS_TEXT: BackgroundTextStyle = { size: 14, weight: 600, color: '@title' };
const TICK_TEXT: BackgroundTextStyle = { size: 12, color: '@tick' };
const ZONE_TEXT: BackgroundTextStyle = {
  size: 20,
  weight: 700,
  color: '@zoneLabel',
};
const CORE_TEXT: BackgroundTextStyle = { ...ZONE_TEXT, size: 26 };
const MIGRATION_TEXT: BackgroundTextStyle = {
  size: 20,
  weight: 700,
  color: '@zoneLabelDark',
};

/** A centred zone name, gated by `showLabels` like every other word on the chart. */
function zoneLabel(
  id: string,
  key: string,
  fallback: string,
  x: number,
  y: number,
  style: BackgroundTextStyle
): BackgroundTextDef {
  return {
    id,
    labelKey: `com.labre.core-domain.background.zone.${key}`,
    fallback,
    anchor: { x: rx(x), y: ry(y) },
    style,
    align: 'center',
    visibleProp: 'showLabels',
  };
}

/**
 * The classic reading: the three named bands of the DDD Crew chart, plus the
 * fourth (unnamed) quadrant the template tints without ever writing on.
 *
 * `variants: ['classic']` is what makes them a READING rather than the chart:
 * turn the frame to `migration` and these regions are not there — which is also
 * why `core-domain.outsourced-core` falls silent on a migration chart instead of
 * measuring against a quadrant nobody can see.
 *
 * NOTE on the ids: they are the plan's, and `supporting-high-complexity` names
 * the bottom-right quadrant — high differentiation, LOW complexity, since the
 * complexity axis runs upwards. Flagged for the PO rather than silently
 * renamed: no rule cites it, so the id is free to be corrected in one line.
 */
const CLASSIC_ZONES: FrameworkBackgroundDef['zones'] = [
  {
    id: 'generic',
    variants: ['classic'],
    rect: { x: rx(70), y: ry(30), w: rw(150), h: rh(720) },
    fill: '@zoneGeneric',
    fillVisibleProp: 'showZones',
    label: zoneLabel('generic', 'generic', 'Generic', 150, 474, ZONE_TEXT),
  },
  {
    id: 'supporting-low-diff',
    variants: ['classic'],
    rect: { x: rx(220), y: ry(30), w: rw(220), h: rh(720) },
    fill: '@zoneSupporting',
    fillVisibleProp: 'showZones',
    label: zoneLabel(
      'supporting',
      'supporting',
      'Supporting',
      340,
      474,
      ZONE_TEXT
    ),
  },
  {
    id: 'core',
    variants: ['classic'],
    rect: { x: rx(440), y: ry(30), w: rw(400), h: rh(360) },
    fill: '@zoneCore',
    fillVisibleProp: 'showZones',
    label: zoneLabel('core', 'core', 'Core', 640, 214, CORE_TEXT),
  },
  {
    // The template tints this one and writes nothing on it, so neither does the
    // declaration: an invented name would be prose nobody asked for.
    id: 'supporting-high-complexity',
    variants: ['classic'],
    rect: { x: rx(440), y: ry(390), w: rw(400), h: rh(360) },
    fill: '@zoneSupporting',
    fillVisibleProp: 'showZones',
  },
];

/**
 * The migration reading: the same frame, four quadrants, and the vocabulary of
 * a modernisation conversation.
 *
 * Regions of READING only — deliberately not cited by any rule. What counts as
 * a low-hanging fruit is a judgement about cost and appetite that no coordinate
 * decides, and a rule reading it off a dot's position would be inventing a
 * verdict the chart never claimed.
 */
const MIGRATION_ZONES: FrameworkBackgroundDef['zones'] = [
  {
    id: 'last-toothpaste',
    variants: ['migration'],
    rect: { x: 0, y: 0, w: 0.5, h: 0.5 },
    fill: '@zoneLastToothpaste',
    fillVisibleProp: 'showZones',
    label: {
      id: 'lastToothpaste',
      labelKey: 'com.labre.core-domain.background.zone.last-toothpaste',
      fallback: 'Last toothpaste',
      anchor: { x: 0.25, y: 0.25 },
      style: MIGRATION_TEXT,
      align: 'center',
      visibleProp: 'showLabels',
    },
  },
  {
    id: 'risk-seeking',
    variants: ['migration'],
    rect: { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    fill: '@zoneRiskSeeking',
    fillVisibleProp: 'showZones',
    label: {
      id: 'riskSeeking',
      labelKey: 'com.labre.core-domain.background.zone.risk-seeking',
      fallback: 'Risk-seeking',
      anchor: { x: 0.75, y: 0.25 },
      style: MIGRATION_TEXT,
      align: 'center',
      visibleProp: 'showLabels',
    },
  },
  {
    id: 'risk-averse',
    variants: ['migration'],
    rect: { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    fill: '@zoneRiskAverse',
    fillVisibleProp: 'showZones',
    label: {
      id: 'riskAverse',
      labelKey: 'com.labre.core-domain.background.zone.risk-averse',
      fallback: 'Risk-averse',
      anchor: { x: 0.25, y: 0.75 },
      style: MIGRATION_TEXT,
      align: 'center',
      visibleProp: 'showLabels',
    },
  },
  {
    id: 'lhf',
    variants: ['migration'],
    rect: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    fill: '@zoneLowHangingFruit',
    fillVisibleProp: 'showZones',
    label: {
      id: 'lowHangingFruit',
      labelKey: 'com.labre.core-domain.background.zone.lhf',
      fallback: 'Low-hanging fruit',
      anchor: { x: 0.75, y: 0.75 },
      style: MIGRATION_TEXT,
      align: 'center',
      visibleProp: 'showLabels',
    },
  },
];

/**
 * The two axes. Complexity runs up the left edge, Business differentiation
 * along the bottom; both arrows point "forward", i.e. towards MORE.
 *
 * Neither axis carries a `visibleProp`: the frame of reference is the chart, and
 * the template has never offered to hide it. `showLabels` gates the WORDS — the
 * titles and the four Low/High ticks — which is the toggle the toolbar has
 * always had (and which the `showLabels` prop has always claimed to cover, zone
 * names included).
 *
 * `arrowSize: 9` reproduces the reference arrowhead's LENGTH exactly; the
 * primitive draws it 9 wide against the template's 10, a half-unit either side
 * of a nine-unit triangle.
 */
const CORE_DOMAIN_AXES: FrameworkBackgroundDef['axes'] = [
  {
    id: 'complexity',
    orientation: 'vertical',
    at: 0,
    arrow: 'forward',
    arrowSize: 9,
    stroke: { color: '@axis', width: 2 },
    title: {
      id: 'complexityTitle',
      // The classic reading's vertical axis. The migration one relabels it —
      // see `MIGRATION_AXIS_TITLE` below, and why it rides in `endLabels`.
      variants: ['classic'],
      labelKey: 'com.labre.core-domain.background.axis.complexity',
      fallback: 'Complexity',
      anchor: { x: 0, y: ry(400), dx: -32 },
      style: AXIS_TEXT,
      vertical: true,
      visibleProp: 'showLabels',
    },
    endLabels: [
      {
        id: 'complexityLow',
        labelKey: 'com.labre.core-domain.background.complexity.low',
        fallback: 'Low',
        anchor: { x: 0, y: ry(758), dx: -12 },
        style: TICK_TEXT,
        vertical: true,
        visibleProp: 'showLabels',
      },
      {
        id: 'complexityHigh',
        labelKey: 'com.labre.core-domain.background.complexity.high',
        fallback: 'High',
        anchor: { x: 0, y: ry(44), dx: -22 },
        style: TICK_TEXT,
        vertical: true,
        visibleProp: 'showLabels',
      },
      /**
       * The migration reading's vertical axis title, at the very position and
       * in the very style the classic one occupies.
       *
       * It rides in `endLabels` because an axis declares ONE `title`, and the
       * two are alternatives selected by the variant rather than two things
       * drawn together. `endLabels` is the only list of free texts an axis
       * owns; the alternative would have been a second declaration of the whole
       * background, which is exactly what a variant exists to avoid.
       */
      {
        id: 'complexityTitleMigration',
        variants: ['migration'],
        labelKey: 'com.labre.core-domain.background.axis.migration-cost',
        fallback: 'Cost of migration',
        anchor: { x: 0, y: ry(400), dx: -32 },
        style: AXIS_TEXT,
        vertical: true,
        visibleProp: 'showLabels',
      },
    ],
  },
  {
    id: 'differentiation',
    orientation: 'horizontal',
    at: 1,
    arrow: 'forward',
    arrowSize: 9,
    stroke: { color: '@axis', width: 2 },
    title: {
      id: 'differentiationTitle',
      labelKey: 'com.labre.core-domain.background.axis.differentiation',
      fallback: 'Business differentiation',
      anchor: { x: rx(450), y: 1, dy: 30 },
      style: AXIS_TEXT,
      align: 'center',
      visibleProp: 'showLabels',
    },
    endLabels: [
      {
        id: 'differentiationLow',
        labelKey: 'com.labre.core-domain.background.differentiation.low',
        fallback: 'Low',
        anchor: { x: rx(84), y: 1, dy: 22 },
        style: TICK_TEXT,
        align: 'center',
        visibleProp: 'showLabels',
      },
      {
        id: 'differentiationHigh',
        labelKey: 'com.labre.core-domain.background.differentiation.high',
        fallback: 'High',
        anchor: { x: rx(838), y: 1, dy: 22 },
        style: TICK_TEXT,
        align: 'center',
        visibleProp: 'showLabels',
      },
    ],
  },
];

export const CORE_DOMAIN_BACKGROUND: FrameworkBackgroundDef = {
  type: 'coreDomain',
  // The chart is a first-class role: validation rules position artefacts
  // against `core-domain:chart`, never against the `coreDomain` element type.
  role: CORE_DOMAIN_ROLE.chart,
  variantProp: 'variant',
  geometry: {
    width: 900,
    height: 820,
    lockAspectRatio: true,
    // The chart has always offered its handles (`resizeEnabled` defaults to
    // true on the model); the declaration says so, and the toolbar toggle takes
    // over from there.
    resizable: true,
    margin: { top: 24, right: 54, bottom: 50, left: 60 },
  },
  chrome: {
    fontFamily: FONT_FAMILY,
    palette: PALETTE,
    // No card, on purpose: the template draws its translucent bands straight
    // onto the canvas, and painting a white rectangle under them would be a
    // visual change dressed up as a refactor.
    surface: {},
  },
  zones: [...CLASSIC_ZONES, ...MIGRATION_ZONES],
  axes: CORE_DOMAIN_AXES,
};
