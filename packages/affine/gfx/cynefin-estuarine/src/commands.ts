import { frameworkChord } from '@labre/affine-shared/utils';
import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import type { TemplateResult } from 'lit';

import {
  createConstraintHexagon,
  createCynefin,
  createEstuarineMap,
} from './actions';
import {
  cynefinMenuIcon,
  cynefinToolbarIcon,
  estuarineMenuIcon,
  hexagonMenuIcon,
} from './toolbar/icons';

/**
 * The first keystroke of every Cynefin / Estuarine chord (`y c` places a
 * Cynefin framework): `c` is the connector tool, so the second letter of the
 * name. Spelled again as `FrameworkDescriptor.chordPrefix` in
 * `@labre/affine`'s `frameworks.ts`; `chord-prefixes.unit.spec.ts` holds the
 * two together (`docs/adr/0055`).
 */
const CYNEFIN_CHORD_PREFIX = 'y';

/**
 * The Cynefin / Estuarine toolbox as commands. One senior button hosts both
 * frameworks, so they share the `cynefin-estuarine` owner — which is also the
 * flag key; the historical PostHog value stays `'cynefin'` through
 * `FrameworkDescriptor.telemetryKey` (`docs/adr/0008`).
 */
interface Spec {
  id: string;
  /**
   * Second keystroke of the chord, after {@link CYNEFIN_CHORD_PREFIX}; absent =
   * keyless by intent (`docs/adr/0055`).
   */
  key?: string;
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
    key: 'c',
    label: 'Cynefin framework',
    iconKey: 'cynefin.frame',
    element: 'cynefin',
    board: true,
    run: createCynefin,
  },
  {
    id: 'addEstuarineMap',
    key: 'e',
    label: 'Estuarine map',
    iconKey: 'estuarine.map',
    element: 'estuarine',
    board: true,
    run: createEstuarineMap,
  },
  {
    id: 'addConstraintHexagon',
    key: 'h',
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
    defaultKeys: frameworkChord(CYNEFIN_CHORD_PREFIX, spec.key),
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
  // The senior button's 56×56 glyph, so `FrameworkDescriptor.iconKey` resolves
  // through `getCommandIcon`. Historical key: `cynefin`, not
  // `cynefin-estuarine`.
  'cynefin.toolbar': cynefinToolbarIcon,
};
