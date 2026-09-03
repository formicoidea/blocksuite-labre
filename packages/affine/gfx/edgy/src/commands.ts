import type { BlockStdScope, CommandDescriptor } from '@labre/std';
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
  edgyActivityIcon,
  edgyBoardIcon,
  edgyDynamicIcon,
  edgyFacetsIcon,
  edgyObjectIcon,
  edgyOutcomeIcon,
  edgyPeopleIcon,
  edgyRelationIcon,
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
    run: createEdgyPeople,
  },
  {
    id: 'addOutcome',
    label: 'Outcome',
    iconKey: 'edgy.outcome',
    category: 'elements',
    element: 'node:outcome',
    run: std => createEdgyBox(std, 'outcome'),
  },
  {
    id: 'addObject',
    label: 'Object',
    iconKey: 'edgy.object',
    category: 'elements',
    element: 'node:object',
    run: std => createEdgyBox(std, 'object'),
  },
  {
    id: 'addActivity',
    label: 'Activity',
    iconKey: 'edgy.activity',
    category: 'elements',
    element: 'node:activity',
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
};
