import type { ChromeWording } from '@labre/affine-shared/services';
import type {
  BlockStdScope,
  CommandDescriptor,
  CommandLegendEntry,
} from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import type { TemplateResult } from 'lit';

import {
  activateEdgyRelation,
  createEdgyBoard,
  createEdgyBox,
  createEdgyDynamic,
  createEdgyFacets,
  createEdgyPeople,
} from './actions';
import {
  EDGY_DYNAMIC_NODES,
  EDGY_ZONE_FILL,
  EDGY_ZONES,
  edgyElementLabel,
  edgyElementLabelKey,
  type EdgyElementName,
  type EdgyZone,
} from './metamodel';
import { NODE_FILL, NODE_STROKE } from './node/consts';
import { EDGY_ROLE } from './roles';
import {
  edgyActivityIcon,
  edgyBoardIcon,
  edgyDynamicIcon,
  edgyFacetsIcon,
  edgyObjectIcon,
  edgyOutcomeIcon,
  edgyPeopleIcon,
  edgyRelationIcon,
  edgyToolbarIcon,
} from './toolbar/icons';

/**
 * The EDGY toolbox as commands. Before PF3 these seven artefacts existed ONLY
 * as hard-coded buttons, so EDGY was entirely invisible to Settings ›
 * Shortcuts; they are all bindable now, all keyless by default (`docs/adr/0008`).
 *
 * An eighth entry joined them on the PO recette of 26/08/2026, and it is the
 * first EDGY command that arms a TOOL rather than dropping an artefact:
 * `addRelation`. Until it landed the 24 typed relations of the metamodel could
 * only be born of the "EDGY dynamic" template, so a practitioner drawing their
 * own board had no way of saying "this Process requires that Asset" — see
 * `../relation.ts` for why there is one entry and not twenty-two.
 */
/* ── The legend, SUBSCRIBED rather than tabulated (`docs/adr/0026`) ────── */

/**
 * The three intersection elements share ONE section: Organisation, Product and
 * Brand are not three facets, they are the three lenses between them, and the
 * diagram says so by drawing them in the overlaps. The key is the one the
 * facets seed already carries.
 */
const SECTION_INTERSECTIONS: ChromeWording = [
  'com.labre.edgy.seed.intersections-title',
  'Intersections',
];

/**
 * The two section titles that name a GROUPING of roles rather than a role —
 * "Base elements" and "Relations" — so each mints a key of its own where the
 * facets and the intersections reuse the metamodel's seeds.
 */
const SECTION_BASE: ChromeWording = [
  'com.labre.edgy.legend.section.base-elements',
  'Base elements',
];
const SECTION_RELATIONS: ChromeWording = [
  'com.labre.edgy.legend.section.relations',
  'Relations',
];

/** For `translations.ts`'s manifest. */
export const EDGY_LEGEND_CHROME_WORDINGS: readonly ChromeWording[] = [
  SECTION_BASE,
  SECTION_RELATIONS,
];

/**
 * One row per official element of `zone`, in the metamodel's own order, in the
 * fill the diagram PAINTS that zone with — derived, never restated, so a
 * thirteenth element gets its row the same way it gets its role.
 */
function zoneEntries(zone: EdgyZone, section: ChromeWording) {
  return (
    Object.entries(EDGY_DYNAMIC_NODES) as [
      EdgyElementName,
      (typeof EDGY_DYNAMIC_NODES)[EdgyElementName],
    ][]
  )
    .filter(([, node]) => node.zone === zone)
    .map(([name]) => ({
      role: EDGY_ROLE[name],
      row: { swatch: 'square' as const, color: EDGY_ZONE_FILL[zone] },
      section,
    }));
}

/**
 * The twelve official elements, all twelve subscribed by ONE command.
 *
 * They are stamped in exactly one place — the "EDGY dynamic" template
 * (`templates/dynamic.ts`) — and there is no "add a Content" gesture to hang
 * them off individually: twelve more catalogue entries for gestures the
 * framework does not offer would blow the senior sub-menu's cap for nothing.
 * So this is the case `CommandDescriptor.legend` is a LIST for, and the case
 * `CommandLegendEntry.section` exists for: one command, twelve rows, four
 * sub-titles.
 *
 * A facet's section says the facet's own name, so it reuses the key the
 * metamodel's seeds already carry: the legend and the facets diagram say
 * "Identity" with one key, not two.
 */
const DYNAMIC_LEGEND: CommandLegendEntry[] = EDGY_ZONES.flatMap(zone =>
  zoneEntries(
    zone.id,
    zone.group === 'facet'
      ? [edgyElementLabelKey(zone.id), edgyElementLabel(zone.id)]
      : SECTION_INTERSECTIONS
  )
);

/**
 * One of the four base elements, listed only when one is on the board BARE.
 *
 * `exact` is what makes "bare" true. Detection is otherwise an ancestor walk,
 * and the twelve official elements specialise these four — Content is an
 * object, Story an activity — so an "Object" row would appear on a board
 * carrying nothing but Contents, keyed to a white swatch that is drawn nowhere
 * on it. White because that is the fill the palette gives them.
 */
function baseEntry(
  kind: 'people' | 'outcome' | 'object' | 'activity'
): CommandLegendEntry {
  return {
    role: EDGY_ROLE[kind],
    exact: true,
    row: { swatch: 'square', color: NODE_FILL },
    section: SECTION_BASE,
  };
}

interface Spec {
  id: string;
  label: string;
  /**
   * The sentence shown under the label — what the GESTURE means (M1 of
   * `docs/adr/0010`). Present only on the relation tool, and written HERE
   * rather than read off a role, unlike Wardley's two connectors: the tool arms
   * the PARENT role `edgy:relation`, which declares no `direction` because it
   * names no verb. There are twenty-two verbs behind this one button and the
   * metamodel picks which, so the only sentence that is true of every drag is
   * the generic one — subject first, object second.
   */
  description?: string;
  iconKey: string;
  category: 'diagrams' | 'elements' | 'relations';
  /**
   * `'tool'` arms something and reports `FrameworkToolPicked`; `'artefact'`
   * drops something and reports `FrameworkElementAdded`. Absent = `'artefact'`,
   * which is what the seven original EDGY entries are.
   */
  kind?: 'artefact' | 'tool';
  /** Historical `FrameworkElementEvent.element` value — do not rename. */
  element: string;
  /** Places the framework's board — see `CommandTelemetry.board`. */
  board?: true;
  /**
   * The legend row (or rows) this entry's artefact puts on the background it is
   * drawn on. Absent on the facets diagram and on the board: both are the frame
   * the elements are drawn INSIDE, and a legend must not list the paper.
   */
  legend?: CommandLegendEntry | CommandLegendEntry[];
  run: (std: BlockStdScope) => void | Promise<void>;
}

const SPECS: Spec[] = [
  {
    id: 'addFacets',
    label: 'Enterprise Design facets',
    iconKey: 'edgy.facets',
    category: 'diagrams',
    element: 'facets',
    run: createEdgyFacets,
  },
  {
    id: 'insertDynamic',
    label: 'EDGY dynamic (elements & relations)',
    iconKey: 'edgy.dynamic',
    category: 'diagrams',
    element: 'template:dynamic',
    legend: DYNAMIC_LEGEND,
    run: createEdgyDynamic,
  },
  {
    id: 'addBoard',
    label: 'EDGY board (hover spotlight)',
    iconKey: 'edgy.board',
    category: 'diagrams',
    element: 'board',
    board: true,
    run: createEdgyBoard,
  },
  {
    id: 'addPeople',
    label: 'People',
    iconKey: 'edgy.people',
    category: 'elements',
    element: 'node:people',
    legend: baseEntry('people'),
    run: createEdgyPeople,
  },
  {
    id: 'addOutcome',
    label: 'Outcome',
    iconKey: 'edgy.outcome',
    category: 'elements',
    element: 'node:outcome',
    legend: baseEntry('outcome'),
    run: std => createEdgyBox(std, 'outcome'),
  },
  {
    id: 'addObject',
    label: 'Object',
    iconKey: 'edgy.object',
    category: 'elements',
    element: 'node:object',
    legend: baseEntry('object'),
    run: std => createEdgyBox(std, 'object'),
  },
  {
    id: 'addActivity',
    label: 'Activity',
    iconKey: 'edgy.activity',
    category: 'elements',
    element: 'node:activity',
    legend: baseEntry('activity'),
    run: std => createEdgyBox(std, 'activity'),
  },
  {
    id: 'addRelation',
    label: 'Relation',
    description:
      'Drag from the element that is the subject of the relation to the one it is about; EDGY names the link itself.',
    iconKey: 'edgy.relation',
    category: 'relations',
    kind: 'tool',
    element: 'connector:relation',
    // ONE row for the whole relation family, keyed on the PARENT role: a board
    // carrying "content expresses purpose" carries `edgy:expresses`, which IS a
    // relation, and that is all the legend has to say. Twenty-two rows naming
    // the verbs would restate the metamodel rather than document the drawing —
    // and the verb travels on the link itself, visible, where it belongs.
    legend: {
      role: EDGY_ROLE.relation,
      // The stroke `activateEdgyRelation` arms the connector tool with.
      row: { swatch: 'line', color: NODE_STROKE },
      section: SECTION_RELATIONS,
    },
    run: std => activateEdgyRelation(std.get(GfxControllerIdentifier)),
  },
];

export const edgyCommands: CommandDescriptor[] = SPECS.map((spec, order) => ({
  id: `edgy.${spec.id}`,
  owner: 'edgy',
  kind: spec.kind ?? 'artefact',
  labelKey: `com.labre.commands.edgy.${spec.id}`,
  labelFallback: spec.label,
  ...(spec.description === undefined
    ? {}
    : {
        descriptionKey: `com.labre.commands.edgy.${spec.id}.description`,
        descriptionFallback: spec.description,
      }),
  category: spec.category,
  iconKey: spec.iconKey,
  surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
  order,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'always',
  run: spec.run,
  telemetry: { framework: 'edgy', element: spec.element, board: spec.board },
  ...(spec.legend ? { legend: spec.legend } : {}),
}));

export const edgyCommandIcons: Record<string, TemplateResult> = {
  'edgy.facets': edgyFacetsIcon,
  'edgy.dynamic': edgyDynamicIcon,
  'edgy.board': edgyBoardIcon,
  'edgy.people': edgyPeopleIcon,
  'edgy.outcome': edgyOutcomeIcon,
  'edgy.object': edgyObjectIcon,
  'edgy.activity': edgyActivityIcon,
  'edgy.relation': edgyRelationIcon,
  // The senior button's 56×56 glyph, so `FrameworkDescriptor.iconKey` resolves
  // through `getCommandIcon`.
  'edgy.toolbar': edgyToolbarIcon,
};
