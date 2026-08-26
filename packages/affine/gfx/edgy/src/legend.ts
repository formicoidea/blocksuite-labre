import {
  type AutoLegendSectionSpec,
  type AutoLegendSpec,
  roleLabel,
} from '@labre/affine-gfx-ddd-shared';

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
        label: roleLabel(EDGY_ROLES, EDGY_ROLE[name]),
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
 *
 * `exact` is what makes "bare" true. Detection is otherwise an ancestor walk,
 * and the twelve official elements specialise these four — Content is an
 * object, Story an activity — so an "Object" row would appear on a board
 * carrying nothing but Contents, keyed to a white swatch that is drawn nowhere
 * on it. The relation entry below keeps the walk, because there the parent row
 * IS the fair summary: a board carrying `edgy:expresses` carries a relation.
 */
const BASE_SECTION: AutoLegendSectionSpec = {
  title: 'Base elements',
  entries: (['people', 'outcome', 'object', 'activity'] as const).map(kind => ({
    role: EDGY_ROLE[kind],
    exact: true,
    row: {
      swatch: 'square' as const,
      color: NODE_FILL,
      label: roleLabel(EDGY_ROLES, EDGY_ROLE[kind]),
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
        label: roleLabel(EDGY_ROLES, EDGY_ROLE.relation),
      },
    },
  ],
};

export const EDGY_AUTO_LEGEND: AutoLegendSpec = {
  title: 'Légende',
  roles: EDGY_ROLES,
  sections: [
    ...FACET_SECTIONS,
    INTERSECTIONS_SECTION,
    BASE_SECTION,
    RELATIONS_SECTION,
  ],
};
