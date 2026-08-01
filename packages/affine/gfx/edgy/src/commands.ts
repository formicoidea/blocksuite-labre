import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import type { TemplateResult } from 'lit';

import {
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
} from './toolbar/icons';

/**
 * The EDGY toolbox as commands. Before PF3 these seven artefacts existed ONLY
 * as hard-coded buttons, so EDGY was entirely invisible to Settings ›
 * Shortcuts; they are all bindable now, all keyless by default (`docs/adr/0008`).
 */
interface Spec {
  id: string;
  label: string;
  iconKey: string;
  category: 'diagrams' | 'elements';
  /** Historical `FrameworkElementEvent.element` value — do not rename. */
  element: string;
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
];

export const edgyCommands: CommandDescriptor[] = SPECS.map((spec, order) => ({
  id: `edgy.${spec.id}`,
  owner: 'edgy',
  kind: 'artefact',
  labelKey: `com.labre.commands.edgy.${spec.id}`,
  labelFallback: spec.label,
  category: spec.category,
  iconKey: spec.iconKey,
  surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
  order,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'always',
  run: spec.run,
  telemetry: { framework: 'edgy', element: spec.element },
}));

export const edgyCommandIcons: Record<string, TemplateResult> = {
  'edgy.facets': edgyFacetsIcon,
  'edgy.dynamic': edgyDynamicIcon,
  'edgy.board': edgyBoardIcon,
  'edgy.people': edgyPeopleIcon,
  'edgy.outcome': edgyOutcomeIcon,
  'edgy.object': edgyObjectIcon,
  'edgy.activity': edgyActivityIcon,
};
