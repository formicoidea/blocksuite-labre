import {
  type AutoLegendSectionSpec,
  type AutoLegendSpec,
  roleLabel,
} from '@labre/affine-gfx-ddd-shared';
import type { RoleDefs } from '@labre/std/gfx';

import {
  EDGY_DYNAMIC_NODES,
  EDGY_ZONE_FILL,
  EDGY_ZONES,
  edgyElementLabel,
  type EdgyElementName,
  type EdgyZone,
} from './metamodel';
import { NODE_FILL, NODE_STROKE } from './node/consts';
import { EDGY_ROLE, EDGY_ROLES } from './roles';

/**
 * What an EDGY background's automatic legend can say — a TABLE, and nothing
 * else: the scan, the placement and the box are `createAutoLegend`'s job, the
 * same generic the three DDD backgrounds were given
 * (`@labre/affine-gfx-ddd-shared`, `shared/legend-auto.ts`). EDGY takes a
 * dependency on that package for the generic and the box prefab alone; moving
 * them to a neutral home would be the tidier answer and is not worth the churn
 * of this fix.
 *
 * Every row is DERIVED — from the metamodel (`./metamodel.ts`: which elements
 * exist, which zone each belongs to, what colour that zone is drawn in) and
 * from the role vocabulary's own labels (`./roles.ts`). Nothing here is
 * restated: a thirteenth element added to the metamodel gets its legend row the
 * same way it gets its role, with no edit to this file.
 *
 * ## The order
 *
 * By ZONE, and the order of the table carries it: the three facets first
 * (Identity, Architecture, Experience), then the three intersections in one
 * section, then the four base elements, then the relations — which is the
 * reading order of {@link EDGY_ZONES} and, before it, of the Venn itself.
 */

/**
 * The vocabulary the legend READS with: EDGY's own, with the twelve official
 * elements re-parented from their base kind to `edgy:element`.
 *
 * Detection is `roleIsA`, an ANCESTOR walk, so an entry written on
 * `edgy:object` lists itself as soon as ANY element that specialises Object —
 * Content, Asset, Channel, Organisation, Product, Brand — is on the board. For
 * a validation rule that is exactly right: a rule about objects is a rule about
 * all of them. For a LEGEND it is a small lie, because "Object" would then
 * appear on a board where nobody ever dropped a bare Object.
 *
 * Flattening the twelve makes each of them match itself and nothing else, and
 * leaves the relation chain untouched — the 22 verb roles keep `edgy:relation`
 * as their parent, which is what gives the single "Relation" row below. The
 * real vocabulary is not modified: `EDGY_ROLES` keeps its hierarchy and every
 * rule keeps reading it.
 *
 * The tidier fix lives in the shared generic — an `exact` flag on
 * `AutoLegendEntry` — and belongs to whoever owns `ddd-shared`.
 */
export const EDGY_LEGEND_ROLES: RoleDefs = Object.assign(
  Object.create(null),
  EDGY_ROLES,
  Object.fromEntries(
    (Object.keys(EDGY_DYNAMIC_NODES) as EdgyElementName[]).map(name => {
      const id = EDGY_ROLE[name];
      return [id, { ...EDGY_ROLES[id], parent: EDGY_ROLE.element }];
    })
  )
);

/** One row per official element of `zone`, in the metamodel's own order. */
function zoneEntries(zone: EdgyZone) {
  return (Object.entries(EDGY_DYNAMIC_NODES) as [
    EdgyElementName,
    (typeof EDGY_DYNAMIC_NODES)[EdgyElementName],
  ][])
    .filter(([, node]) => node.zone === zone)
    .map(([name]) => ({
      role: EDGY_ROLE[name],
      row: {
        swatch: 'square' as const,
        // The zone's fill, which IS what the diagram paints the element with.
        color: EDGY_ZONE_FILL[zone],
        label: roleLabel(EDGY_LEGEND_ROLES, EDGY_ROLE[name]),
      },
    }));
}

const FACET_SECTIONS: AutoLegendSectionSpec[] = EDGY_ZONES.filter(
  zone => zone.group === 'facet'
).map(zone => ({
  title: edgyElementLabel(zone.id),
  entries: zoneEntries(zone.id),
}));

/**
 * The three intersection elements in ONE section: Organisation, Product and
 * Brand are not three facets, they are the three lenses between them, and the
 * diagram says so by drawing them in the overlaps. Each keeps its own colour.
 */
const INTERSECTIONS_SECTION: AutoLegendSectionSpec = {
  title: 'Intersections',
  entries: EDGY_ZONES.filter(zone => zone.group === 'intersection').flatMap(
    zone => zoneEntries(zone.id)
  ),
};

/**
 * The four base elements, listed only when one is on the board BARE — an
 * element the user dropped from the toolbox and left as a People, an Outcome,
 * an Object or an Activity, without saying which of the twelve it is. White,
 * because that is the fill the palette gives them (`node/consts.ts`).
 */
const BASE_SECTION: AutoLegendSectionSpec = {
  title: 'Base elements',
  entries: (['people', 'outcome', 'object', 'activity'] as const).map(kind => ({
    role: EDGY_ROLE[kind],
    row: {
      swatch: 'square' as const,
      color: NODE_FILL,
      label: roleLabel(EDGY_LEGEND_ROLES, EDGY_ROLE[kind]),
    },
  })),
};

/**
 * ONE row for the whole relation family, keyed on the PARENT role: a board
 * carrying "content expresses purpose" carries `edgy:expresses`, which is a
 * relation, and that is all the legend has to say. Twenty-two rows naming the
 * verbs would restate the metamodel rather than document the drawing — and the
 * verb travels on the link itself, visible, where it belongs.
 */
const RELATIONS_SECTION: AutoLegendSectionSpec = {
  title: 'Relations',
  entries: [
    {
      role: EDGY_ROLE.relation,
      row: {
        swatch: 'line' as const,
        // The stroke `activateEdgyRelation` arms the connector tool with.
        color: NODE_STROKE,
        label: roleLabel(EDGY_LEGEND_ROLES, EDGY_ROLE.relation),
      },
    },
  ],
};

export const EDGY_AUTO_LEGEND: AutoLegendSpec = {
  title: 'Légende',
  roles: EDGY_LEGEND_ROLES,
  sections: [
    ...FACET_SECTIONS,
    INTERSECTIONS_SECTION,
    BASE_SECTION,
    RELATIONS_SECTION,
  ],
};
