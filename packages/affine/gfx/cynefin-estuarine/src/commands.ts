import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import type { TemplateResult } from 'lit';

import {
  createConstraintHexagon,
  createCynefin,
  createEstuarineMap,
} from './actions';
import {
  cynefinMenuIcon,
  estuarineMenuIcon,
  hexagonMenuIcon,
} from './toolbar/icons';

/**
 * The Cynefin / Estuarine toolbox as commands. One senior button hosts both
 * frameworks, so they share the `cynefin-estuarine` owner — which is also the
 * flag key; the historical PostHog value stays `'cynefin'` through
 * `FrameworkDescriptor.telemetryKey` (`docs/adr/0008`).
 */
interface Spec {
  id: string;
  label: string;
  iconKey: string;
  element: string;
  /** Places the framework's board — see `CommandTelemetry.board`. */
  board?: true;
  run: (std: BlockStdScope) => void;
}

const SPECS: Spec[] = [
  {
    id: 'addCynefin',
    label: 'Cynefin framework',
    iconKey: 'cynefin.frame',
    element: 'cynefin',
    board: true,
    run: createCynefin,
  },
  {
    id: 'addEstuarineMap',
    label: 'Estuarine map',
    iconKey: 'estuarine.map',
    element: 'estuarine',
    board: true,
    run: createEstuarineMap,
  },
  {
    id: 'addConstraintHexagon',
    label: 'Hexagon node',
    iconKey: 'estuarine.hexagon',
    element: 'node:hexagon',
    run: createConstraintHexagon,
  },
];

export const cynefinEstuarineCommands: CommandDescriptor[] = SPECS.map(
  (spec, order) => ({
    id: `cynefin-estuarine.${spec.id}`,
    owner: 'cynefin-estuarine',
    kind: 'artefact',
    labelKey: `com.labre.commands.cynefin-estuarine.${spec.id}`,
    labelFallback: spec.label,
    category: 'frames',
    iconKey: spec.iconKey,
    surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
    order,
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'always',
    run: spec.run,
    telemetry: {
      framework: 'cynefin-estuarine',
      element: spec.element,
      board: spec.board,
    },
  })
);

export const cynefinEstuarineCommandIcons: Record<string, TemplateResult> = {
  'cynefin.frame': cynefinMenuIcon,
  'estuarine.map': estuarineMenuIcon,
  'estuarine.hexagon': hexagonMenuIcon,
};
