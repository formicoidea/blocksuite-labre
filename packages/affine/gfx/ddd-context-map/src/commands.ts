import {
  addBubble,
  addCloud,
  CM_RELATIONSHIPS,
  placeDddElement,
} from '@labre/affine-gfx-ddd-shared';
import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { svg, type TemplateResult } from 'lit';

import {
  activateContextMapRelationship,
  createContextMapBoard,
} from './actions';
import { CONTEXT_MAP_ROLE } from './roles';

/**
 * The Context Map palette as commands: the board, the bounded-context bubble,
 * the cloud and the nine relationship patterns (`docs/adr/0008`).
 *
 * Two entries changed shape in WS2 and neither changed its telemetry: the
 * bubble now carries the `context-map:context` role, and the nine patterns arm
 * the connector tool instead of dropping a drawing.
 *
 * The notation legend is deliberately NOT a palette entry any more (PO recette,
 * 27/08/2026): the ONE legend is the automatic one on the selected board's
 * contextual toolbar (`toolbar/board-config.ts`) — the same call Core Domain
 * Chart makes. A palette that could also drop a second, static legend was two
 * answers to one question.
 */
const boardSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4.5" width="19" height="15" rx="2" fill="#ffffff" stroke="currentColor" stroke-width="1.6"/><rect x="5.5" y="8" width="6" height="3.5" rx="1.75" fill="#e6f0fa" stroke="#2f6fb0" stroke-width="1.1"/><rect x="13" y="13" width="6" height="3.5" rx="1.75" fill="#e6f0fa" stroke="#2f6fb0" stroke-width="1.1"/><path d="M11.5 10.5 L13.5 13.8" stroke="currentColor" stroke-width="1.2"/></svg>`;
const bubbleSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="10" rx="5" fill="#e6f0fa" stroke="#2f6fb0" stroke-width="1.6"/></svg>`;
const cloudSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><path d="M6 17 C3 17 2 14 4.5 12.5 C4 9 8 8 9.5 10 C11 6.5 16 7.5 16 11 C19 10.5 20.5 14 18 16 C18 17 16.5 17 15 17 Z" fill="#f0eef6" stroke="#6d6e71" stroke-width="1.4"/></svg>`;
const relationSwatch = (dashed: boolean, arrow: boolean) =>
  svg`<svg viewBox="0 0 24 24" fill="none"><path d="M3 12 H${arrow ? 17 : 21}" stroke="currentColor" stroke-width="2" stroke-dasharray="${dashed ? '3 3' : '0'}"/>${arrow ? svg`<path d="M15 8 L21 12 L15 16" stroke="currentColor" stroke-width="2" fill="none"/>` : ''}</svg>`;

interface Spec {
  id: string;
  label: string;
  iconKey: string;
  /** Historical `FrameworkElementEvent.element` value — do not rename. */
  element: string;
  /** Places the framework's board — see `CommandTelemetry.board`. */
  board?: true;
  icon: TemplateResult;
  run: (std: BlockStdScope) => void;
}

const SPECS: Spec[] = [
  {
    id: 'addBoard',
    label: 'Context Map board',
    iconKey: 'ddd-context-map.board',
    // A NEW telemetry value, and the only one in this file: every other entry
    // below keeps the `element` string it has emitted since ADR 0008.
    element: 'board',
    board: true,
    icon: boardSwatch,
    run: std => createContextMapBoard(std.get(GfxControllerIdentifier)),
  },
  {
    id: 'addBoundedContext',
    label: 'Bounded Context',
    iconKey: 'ddd-context-map.bubble',
    element: 'bounded-context',
    icon: bubbleSwatch,
    run: std =>
      placeDddElement(std, (surface, cx, cy) =>
        // The role is what makes a bubble a bounded CONTEXT rather than a blue
        // pill: every rule in `rules.ts` reads it, and a pill drawn before WS2
        // carries none and is never evaluated (promesse #71).
        addBubble(surface, cx, cy, 'Bounded Context', CONTEXT_MAP_ROLE.context)
      ),
  },
  {
    id: 'addCloud',
    label: 'Cloud / System (Big Ball of Mud)',
    iconKey: 'ddd-context-map.cloud',
    element: 'cloud',
    icon: cloudSwatch,
    run: std =>
      placeDddElement(std, (surface, cx, cy) =>
        addCloud(surface, std, cx, cy, 'System')
      ),
  },
  ...CM_RELATIONSHIPS.map(
    (preset): Spec => ({
      id: `add${preset.kind[0].toUpperCase()}${preset.kind.slice(1)}`,
      label: preset.label,
      iconKey: `ddd-context-map.relationship.${preset.kind}`,
      element: `relationship:${preset.kind}`,
      icon: relationSwatch(preset.dashed, preset.upDown),
      // No longer a placement: the nine patterns arm the connector tool and the
      // user DRAWS the relation between two contexts. See
      // `activateContextMapRelationship` for why the free-floating group had to
      // go. The telemetry `element` value is untouched.
      run: std =>
        activateContextMapRelationship(
          std.get(GfxControllerIdentifier),
          preset.kind,
          { upDown: preset.upDown, dashed: preset.dashed }
        ),
    })
  ),
];

export const contextMapCommands: CommandDescriptor[] = SPECS.map(
  (spec, order) => ({
    id: `ddd-context-map.${spec.id}`,
    owner: 'ddd-context-map',
    kind: 'artefact',
    labelKey: `com.labre.commands.ddd-context-map.${spec.id}`,
    labelFallback: spec.label,
    category: 'map',
    iconKey: spec.iconKey,
    surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
    order,
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'always',
    run: spec.run,
    telemetry: {
      framework: 'ddd-context-map',
      element: spec.element,
      board: spec.board,
    },
  })
);

export const contextMapCommandIcons: Record<string, TemplateResult> =
  Object.fromEntries(SPECS.map(spec => [spec.iconKey, spec.icon]));
