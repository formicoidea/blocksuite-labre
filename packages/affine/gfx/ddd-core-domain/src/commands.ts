import {
  addDot,
  addMarker,
  cdSubdomainSeedKey,
  CD_SUBDOMAINS,
  coreDomainToolbarIcon,
  MOVEMENT_COLOR,
  placeDddElement,
  teamTopologySeedKey,
  TEAM_TOPOLOGIES,
} from '@labre/affine-gfx-ddd-shared';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import type {
  BlockStdScope,
  CommandDescriptor,
  CommandLegendEntry,
} from '@labre/std';
import type { RoleId } from '@labre/std/gfx';
import { svg, type TemplateResult } from 'lit';

import { activateMovement, createCoreDomainChart } from './actions';
import {
  CORE_DOMAIN_ROLE,
  CORE_DOMAIN_ROLES,
  markerRole,
  subdomainRole,
} from './roles';

/**
 * The legend wording of a sub-domain dot: the ROLE's own i18n key — so a host
 * catalogue still wins and no key is invented — with the PALETTE's shorter
 * label as the fallback.
 *
 * The two differ for three of the five: `roles.ts` spells out "Bounded context
 * (current position)" where the chart's legend has always read "Bounded
 * context". A host resolving the key reads the same word either way; this keeps
 * the host-less fallback reading what it has read since the button shipped.
 * Both halves come from declarations that already exist — neither is restated.
 */
function subdomainWording(
  role: RoleId,
  label: string
): CommandLegendEntry['labelWording'] {
  const { labelKey } = CORE_DOMAIN_ROLES[role];
  return labelKey ? [labelKey, label] : undefined;
}

/**
 * The automatic legend's own section titles — text stamped onto the chart the
 * moment the legend is built, like any other seed, and declared HERE because
 * the rows that file themselves under them are subscribed by the commands
 * below. The box title itself is not one of them: it says the shared word
 * "Legend" and reuses `BOARD_LEGEND_TITLE`.
 *
 * Three sub-titles for a framework whose ten commands all sit in ONE category:
 * `section` is what keeps them, and in particular the one that explains the
 * C/X/F letters (`docs/adr/0026`).
 */
export const CORE_DOMAIN_SEED_LEGEND_SUBDOMAINS: ChromeWording = [
  'com.labre.ddd-core-domain.seed.legend-subdomains',
  'Sub-domains',
];
export const CORE_DOMAIN_SEED_LEGEND_TEAM_MODES: ChromeWording = [
  'com.labre.ddd-core-domain.seed.legend-team-modes',
  'Team interaction modes',
];
export const CORE_DOMAIN_SEED_LEGEND_MOVEMENT: ChromeWording = [
  'com.labre.ddd-core-domain.seed.legend-movement',
  'Movement',
];

/**
 * The Core Domain Chart palette as commands: the background, the five
 * sub-domain dots, the three Team Topologies markers and the movement arrow.
 * The notation legend stays in the map-background context menu (toolbar
 * config) — the element toolbar is out of scope for `docs/adr/0008`.
 */
const chartSwatch = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="17" height="17" fill="#4d9900" fill-opacity="0.5"/><rect x="4" y="3" width="6" height="17" fill="#9933ff" fill-opacity="0.5"/><path d="M4 20 V3 M4 20 H21" stroke="currentColor" stroke-width="1.8"/></svg>`;
const dotSwatch = (color: string) =>
  svg`<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="${color}" stroke="${NOTATION_NEUTRALS.ink}" stroke-width="1.2"/></svg>`;
const movementSwatch = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 18 L16 7" stroke="${MOVEMENT_COLOR}" stroke-width="2" stroke-dasharray="3 3"/><path d="M12 6 L18 5 L17 11" stroke="${MOVEMENT_COLOR}" stroke-width="2" fill="none"/></svg>`;
const markerSwatch = (fill: string, letter: string) =>
  svg`<svg width="24" height="24" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" fill="${fill}" stroke="${NOTATION_NEUTRALS.ink}" stroke-width="1.2"/><text x="12" y="16" text-anchor="middle" font-size="11" font-family="sans-serif" fill="${NOTATION_NEUTRALS.ink}">${letter}</text></svg>`;

interface Spec {
  id: string;
  label: string;
  iconKey: string;
  /** Historical `FrameworkElementEvent.element` value — do not rename. */
  element: string;
  /** Places the framework's board — see `CommandTelemetry.board`. */
  board?: true;
  /**
   * `tool` when the entry ARMS a drawing tool instead of placing an artefact:
   * the placement tool must not wrap it, and it reports `FrameworkToolPicked`.
   */
  kind?: 'artefact' | 'tool';
  icon: TemplateResult;
  run: (std: BlockStdScope) => void;
  /** The row this entry's artefact puts in the chart's legend, if any. */
  legend?: CommandLegendEntry;
}

const SPECS: Spec[] = [
  {
    id: 'addChart',
    label: 'Core Domain Chart',
    iconKey: 'ddd-core-domain.chart',
    element: 'background',
    board: true,
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
            // Translated HERE and once: the caption is document content the
            // moment it lands (ADR 0023), so the host's catalogue is asked at
            // placement and never again.
            translateKey(std, cdSubdomainSeedKey(preset.kind), preset.label),
            // The dot IS the sub-domain: the role rides on the ellipse, so a
            // rule about where a sub-domain sits measures the artefact and not
            // the group that also holds its name.
            subdomainRole(preset.kind)
          )
        ),
      // Row and command out of the SAME preset, which also keeps this list and
      // `core-domain.off-legend-colour` naming the same five colours by
      // construction.
      legend: {
        role: subdomainRole(preset.kind),
        section: CORE_DOMAIN_SEED_LEGEND_SUBDOMAINS,
        labelWording: subdomainWording(
          subdomainRole(preset.kind),
          preset.label
        ),
        row: { swatch: 'dot', color: preset.fill },
      },
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
            // Translated HERE and once: the caption is document content the
            // moment it lands (ADR 0023), so the host's catalogue is asked at
            // placement and never again.
            label: translateKey(
              std,
              teamTopologySeedKey(preset.kind),
              preset.label
            ),
            // The square IS the marker, so the role rides on it and not on the
            // group that also holds its caption — the same call as the dot.
            // Without this the automatic legend, which detects by role and only
            // by role, could not see the markers at all.
            role: markerRole(preset.kind),
          })
        ),
      // The LETTER is what identifies a marker on the chart — the squares are
      // three colours a reader has no key to — so the row shows the same square
      // with the same letter in it, from the same preset the palette draws with.
      legend: {
        role: markerRole(preset.kind),
        section: CORE_DOMAIN_SEED_LEGEND_TEAM_MODES,
        row: { swatch: 'square', color: preset.fill, letter: preset.letter },
      },
    })
  ),
  {
    id: 'addMovement',
    label: 'Movement over time',
    iconKey: 'ddd-core-domain.movement',
    // Historical telemetry value, unchanged by the gesture becoming a drag.
    element: 'movement',
    kind: 'tool',
    icon: movementSwatch,
    // No longer a free arrow dropped at the viewport centre: the movement is a
    // typed edge, so the user draws it from the current position to the future
    // one and the pair they drew IS the statement (`docs/adr/0010`).
    run: activateMovement,
    legend: {
      role: CORE_DOMAIN_ROLE.movement,
      section: CORE_DOMAIN_SEED_LEGEND_MOVEMENT,
      // The style `activateMovement` arms the connector tool with: a red dashed
      // line.
      row: { swatch: 'line', color: MOVEMENT_COLOR, dashed: true },
    },
  },
];

export const coreDomainCommands: CommandDescriptor[] = SPECS.map(
  (spec, order) => ({
    id: `ddd-core-domain.${spec.id}`,
    owner: 'ddd-core-domain',
    kind: spec.kind ?? 'artefact',
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
    telemetry: {
      framework: 'ddd-core-domain',
      element: spec.element,
      board: spec.board,
    },
    legend: spec.legend,
  })
);

export const coreDomainCommandIcons: Record<string, TemplateResult> = {
  ...Object.fromEntries(SPECS.map(spec => [spec.iconKey, spec.icon])),
  // The senior button's 56×56 glyph, so `FrameworkDescriptor.iconKey` resolves
  // through `getCommandIcon`.
  'ddd-core-domain.toolbar': coreDomainToolbarIcon,
};
