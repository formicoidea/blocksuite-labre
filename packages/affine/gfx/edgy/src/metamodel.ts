/**
 * The EDGY metamodel, as DATA — the 12 official elements and the 24 canonical
 * relations that link them.
 *
 * It used to live in `templates/index.ts`, where it was drawn. It moved here
 * the day the roles started being DERIVED from it (`./roles.ts`): the template
 * needs the vocabulary to stamp its elements, and the vocabulary needs the
 * metamodel to know which verbs exist, so a single module holding both would be
 * a cycle. Nothing was renamed — `templates/index.ts` re-exports both tables
 * under the names they always had.
 *
 * This file is the ONE place the metamodel is written down. `roles.ts` derives
 * an edge role per verb from it, `rules.ts` derives the sanctioned sentences of
 * `edgy.non-canonical-link` from it, and the template draws it. Restating the
 * matrix anywhere else would be inviting the three to disagree.
 */

/**
 * Official pastel fills per zone (the `pictograms/Shape-*.svg` colors) — the
 * colour an element of that zone is DRAWN with, on the diagram and therefore in
 * the legend that documents it.
 *
 * Exported because the legend needs the same swatch the board uses: a swatch
 * restated as a second literal would be a colour free to drift away from the
 * one the eye sees.
 */
export const EDGY_ZONE_FILL = {
  identity: '#80ffb7',
  architecture: '#a6c0ff',
  experience: '#ff99bd',
  organisation: '#80eaff',
  brand: '#ffd580',
  product: '#e599ff',
} as const;

/** One of the six regions of the Venn: three facets, three intersections. */
export type EdgyZone = keyof typeof EDGY_ZONE_FILL;

/**
 * The six zones, in reading order — the three FACETS first, then the three
 * INTERSECTIONS, each named by the pair of circles it is the lens of (the very
 * pairs `element-renderer.ts` clips: A∩B, B∩C, A∩C).
 *
 * Written down as data because the split is otherwise readable only inside the
 * renderer's paint calls, and the legend has to group the twelve elements by
 * it. `group` is the only thing here a reader could not already derive from
 * {@link EDGY_DYNAMIC_NODES}.
 */
export const EDGY_ZONES: readonly {
  id: EdgyZone;
  group: 'facet' | 'intersection';
}[] = [
  { id: 'identity', group: 'facet' },
  { id: 'architecture', group: 'facet' },
  { id: 'experience', group: 'facet' },
  // Identity ∩ Architecture, Architecture ∩ Experience, Experience ∩ Identity.
  { id: 'organisation', group: 'intersection' },
  { id: 'product', group: 'intersection' },
  { id: 'brand', group: 'intersection' },
];

/**
 * The 24 canonical EDGY relations (source, target, verb, label position along
 * the link) — exported for the unit tests. 7 per facet + 3 between the
 * intersections. The optional 4th member mirrors the reference diagram's
 * placements: verbs of intersection-outgoing links sit near the far element
 * (`labelOffset.distance` ≈ .75), short peer links keep the middle.
 *
 * Read the way `docs/adr/0010` reads every typed edge: the SOURCE is the
 * subject of the verb and the TARGET its object, so each row is one sentence a
 * practitioner would say out loud — "content expresses purpose". That is what
 * makes the row usable as an {@link EndpointTriplet} without a single
 * coordinate taking part.
 */
export const EDGY_DYNAMIC_RELATIONS: [string, string, string, number?][] = [
  // Identity
  ['content', 'purpose', 'expresses'],
  ['content', 'story', 'conveys', 0.75],
  ['story', 'purpose', 'contextualises', 0.8],
  ['organisation', 'purpose', 'pursues', 0.8],
  ['organisation', 'story', 'authors', 0.6],
  ['brand', 'purpose', 'represents', 0.8],
  ['brand', 'story', 'evokes', 0.65],
  // Architecture
  ['organisation', 'process', 'performs', 0.8],
  ['process', 'capability', 'realises', 0.75],
  ['process', 'asset', 'requires'],
  ['capability', 'asset', 'requires', 0.75],
  ['organisation', 'capability', 'has', 0.6],
  ['product', 'capability', 'requires', 0.75],
  ['process', 'product', 'creates', 0.65],
  // Experience
  ['task', 'journey', 'is part of', 0.6],
  ['task', 'channel', 'uses', 0.6],
  ['journey', 'channel', 'traverses', 0.6],
  ['product', 'task', 'serves', 0.9],
  ['product', 'journey', 'features in', 0.8],
  ['brand', 'task', 'supports', 0.8],
  ['brand', 'journey', 'appears in', 0.9],
  // Intersections
  ['organisation', 'brand', 'builds', 0.85],
  ['organisation', 'product', 'makes', 0.65],
  ['product', 'brand', 'embodies', 0.8],
];

/**
 * The 12 elements, centred coordinates in REFERENCE coords (the fixed space
 * of consts.ts — the same space as `VENN`), laid out like the reference
 * "elements & relations" diagram: aligned top row, Story/Capability flanks,
 * Brand/Product astride the white centre, Task/Journey/Channel triangle.
 * Exported (with `dynToModel`) for the containment test.
 *
 * `kind` is the OFFICIAL kind of each element — the base shape EDGY draws it
 * with — and `roles.ts` reads it to give each of the twelve leaf roles its
 * parent. Written once, here, rather than restated as a second table nobody
 * would think to keep in step.
 *
 * `zone` is the region of the Venn the element belongs to, and it REPLACES the
 * fill this table used to carry: the fill is `EDGY_ZONE_FILL[zone]` and nothing
 * else, so an element cannot be filed under one facet and painted another's
 * colour. The template reads it to draw, the legend reads it to group and to
 * swatch.
 */
export type EdgyElementName =
  | 'content'
  | 'purpose'
  | 'organisation'
  | 'process'
  | 'asset'
  | 'story'
  | 'capability'
  | 'brand'
  | 'product'
  | 'task'
  | 'journey'
  | 'channel';

/**
 * The metamodel's own wording for one of its lowercase names — one of the
 * twelve elements, or one of the six zones. It is the name written on the
 * diagram, so it is also what the vocabulary falls back to and what the legend
 * prints as a row label or a section title. One expression, one wording.
 */
export const edgyElementLabel = (name: EdgyElementName | EdgyZone): string =>
  name.charAt(0).toUpperCase() + name.slice(1);

export const EDGY_DYNAMIC_NODES: Record<
  EdgyElementName,
  {
    kind: 'outcome' | 'object' | 'activity';
    cx: number;
    cy: number;
    w?: number;
    zone: EdgyZone;
  }
> = {
  content: { kind: 'object', cx: 237.5, cy: 100, zone: 'identity' },
  purpose: { kind: 'outcome', cx: 282.5, cy: 100, zone: 'identity' },
  organisation: {
    kind: 'object',
    cx: 340,
    cy: 100,
    w: 175,
    zone: 'organisation',
  },
  process: { kind: 'activity', cx: 397.5, cy: 100, zone: 'architecture' },
  asset: { kind: 'object', cx: 442.5, cy: 100, zone: 'architecture' },
  story: { kind: 'activity', cx: 255, cy: 152.5, zone: 'identity' },
  capability: {
    kind: 'outcome',
    cx: 425,
    cy: 152.5,
    w: 150,
    zone: 'architecture',
  },
  brand: { kind: 'object', cx: 280, cy: 195, zone: 'brand' },
  product: { kind: 'object', cx: 400, cy: 195, zone: 'product' },
  task: { kind: 'outcome', cx: 310, cy: 257.5, zone: 'experience' },
  journey: { kind: 'activity', cx: 370, cy: 257.5, zone: 'experience' },
  channel: { kind: 'object', cx: 340, cy: 297.5, zone: 'experience' },
};
