import {
  addDot,
  addMarker,
  CD_SUBDOMAINS,
  MOVEMENT_COLOR,
  placeDddElement,
  TEAM_TOPOLOGIES,
} from '@labre/affine-gfx-ddd-shared';
import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import { svg, type TemplateResult } from 'lit';

import { activateMovement, createCoreDomainChart } from './actions';
import { subdomainRole } from './roles';

/**
 * The Core Domain Chart palette as commands: the background, the five
 * sub-domain dots, the three Team Topologies markers and the movement arrow.
 * The notation legend stays in the map-background context menu (toolbar
 * config) — the element toolbar is out of scope for `docs/adr/0008`.
 */
const chartSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="17" height="17" fill="#4d9900" fill-opacity="0.5"/><rect x="4" y="3" width="6" height="17" fill="#9933ff" fill-opacity="0.5"/><path d="M4 20 V3 M4 20 H21" stroke="currentColor" stroke-width="1.8"/></svg>`;
const dotSwatch = (color: string) =>
  svg`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="${color}" stroke="#1f2328" stroke-width="1.2"/></svg>`;
const movementSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><path d="M3 18 L16 7" stroke="${MOVEMENT_COLOR}" stroke-width="2" stroke-dasharray="3 3"/><path d="M12 6 L18 5 L17 11" stroke="${MOVEMENT_COLOR}" stroke-width="2" fill="none"/></svg>`;
const markerSwatch = (fill: string, letter: string) =>
  svg`<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" fill="${fill}" stroke="#1f2328" stroke-width="1.2"/><text x="12" y="16" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#1f2328">${letter}</text></svg>`;

interface Spec {
  id: string;
  label: string;
  iconKey: string;
  /** Historical `FrameworkElementEvent.element` value — do not rename. */
  element: string;
  icon: TemplateResult;
  run: (std: BlockStdScope) => void;
}

const SPECS: Spec[] = [
  {
    id: 'addChart',
    label: 'Core Domain Chart',
    iconKey: 'ddd-core-domain.chart',
    element: 'background',
    icon: chartSwatch,
    run: std =>
      placeDddElement(std, (surface, cx, cy) =>
        createCoreDomainChart(surface, cx, cy)
      ),
  },
  ...CD_SUBDOMAINS.map(
    (preset): Spec => ({
      id: `add${preset.kind[0].toUpperCase()}${preset.kind.slice(1)}`,
      label: preset.label,
      iconKey: `ddd-core-domain.subdomain.${preset.kind}`,
      element: `subdomain:${preset.kind}`,
      icon: dotSwatch(preset.fill),
      run: std =>
        placeDddElement(std, (surface, cx, cy) =>
          addDot(
            surface,
            std,
            cx,
            cy,
            preset.fill,
            preset.label,
            // The dot IS the sub-domain: the role rides on the ellipse, so a
            // rule about where a sub-domain sits measures the artefact and not
            // the group that also holds its name.
            subdomainRole(preset.kind)
          )
        ),
    })
  ),
  ...TEAM_TOPOLOGIES.map(
    (preset): Spec => ({
      id: `add${preset.kind[0].toUpperCase()}${preset.kind.slice(1)}`,
      label: preset.label,
      iconKey: `ddd-core-domain.team-topology.${preset.kind}`,
      element: `team-topology:${preset.kind}`,
      icon: markerSwatch(preset.fill, preset.letter),
      run: std =>
        placeDddElement(std, (surface, cx, cy) =>
          addMarker(surface, std, cx, cy, {
            fill: preset.fill,
            letter: preset.letter,
            label: preset.label,
          })
        ),
    })
  ),
  {
    id: 'addMovement',
    label: 'Movement over time',
    iconKey: 'ddd-core-domain.movement',
    // Historical telemetry value, unchanged by the gesture becoming a drag.
    element: 'movement',
    icon: movementSwatch,
    // No longer a free arrow dropped at the viewport centre: the movement is a
    // typed edge, so the user draws it from the current position to the future
    // one and the pair they drew IS the statement (`docs/adr/0010`).
    run: activateMovement,
  },
];

export const coreDomainCommands: CommandDescriptor[] = SPECS.map(
  (spec, order) => ({
    id: `ddd-core-domain.${spec.id}`,
    owner: 'ddd-core-domain',
    kind: 'artefact',
    labelKey: `com.labre.commands.ddd-core-domain.${spec.id}`,
    labelFallback: spec.label,
    category: 'chart',
    iconKey: spec.iconKey,
    surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
    order,
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'always',
    run: spec.run,
    telemetry: { framework: 'ddd-core-domain', element: spec.element },
  })
);

export const coreDomainCommandIcons: Record<string, TemplateResult> =
  Object.fromEntries(SPECS.map(spec => [spec.iconKey, spec.icon]));
