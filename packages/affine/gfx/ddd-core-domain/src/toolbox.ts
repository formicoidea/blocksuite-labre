import {
  backgroundSize,
  type FrameworkToolbox,
  type SerializedElementProps,
  type ToolboxItem,
  type ToolboxPoint,
} from '@labre/affine-block-surface/interchange';
import {
  CD_SUBDOMAINS,
  DOT_SIZE,
  dotElements,
  MARKER_SIZE,
  markerElements,
  MOVEMENT_COLOR,
  TEAM_TOPOLOGIES,
} from '@labre/affine-gfx-ddd-shared/headless';
import {
  ConnectorMode,
  PointStyle,
  StrokeStyle,
} from '@labre/affine-model/headless';
import { Bound } from '@labre/global/gfx';

import { coreDomainCommandsManifest } from './commands-manifest.js';
import { CORE_DOMAIN_BACKGROUND } from './core-domain/background.js';
import {
  type CdMarkerKind,
  type CdSubdomainKind,
  CORE_DOMAIN_ROLE,
  markerRole,
  subdomainRole,
} from './roles.js';

/**
 * The Core Domain Chart toolbar as pure builders (`docs/adr/0045`): the chart,
 * the five sub-domain dots, the three Team Topologies markers and the movement
 * over time, with no editor behind them. The dots and the markers are the very
 * builders the palette's prefabs write (`@labre/affine-gfx-ddd-shared/headless`),
 * and `createCoreDomainChart` and `activateMovement` read the chart and the
 * movement style from here, so a dot drawn by a host and one placed from the
 * toolbar are the same element.
 */

/** The stroke width the movement arrow has always been drawn at. */
const MOVEMENT_STROKE_WIDTH = 2;

/**
 * How a movement is drawn: a red dashed line, the arrow at the far end. The
 * look rides on the connector, the meaning is `core-domain:movement`.
 */
export function coreDomainMovementStyle() {
  return {
    stroke: MOVEMENT_COLOR,
    strokeStyle: StrokeStyle.Dash,
    strokeWidth: MOVEMENT_STROKE_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Arrow,
  };
}

/** The chart a core domain map is drawn on, at `at`. */
export function coreDomainChartElement(
  at: ToolboxPoint,
  local = 'chart'
): SerializedElementProps {
  const { width, height } = backgroundSize(CORE_DOMAIN_BACKGROUND);
  return {
    type: CORE_DOMAIN_BACKGROUND.type,
    id: local,
    // The chart is a first-class role: rules position artefacts against
    // `core-domain:chart`, never against the `coreDomain` element type.
    role: CORE_DOMAIN_BACKGROUND.role,
    resizeEnabled: CORE_DOMAIN_BACKGROUND.geometry.resizable,
    xywh: new Bound(at.x, at.y, width, height).serialize(),
  };
}

const kebab = (kind: string): string =>
  kind.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

/**
 * A sub-domain dot of one preset whose ellipse is at `at`, captioned `name` or
 * the toolbar's English seed: the ellipse carrying the preset's role, the
 * caption to its right and their group.
 */
export function coreDomainSubdomainElements(
  kind: CdSubdomainKind,
  at: ToolboxPoint,
  name?: string,
  local = kebab(kind)
): SerializedElementProps[] {
  const preset = CD_SUBDOMAINS.find(p => p.kind === kind);
  if (!preset) return [];
  return dotElements(
    at,
    preset.fill,
    name?.trim() || preset.label,
    subdomainRole(kind),
    local
  );
}

/**
 * A Team Topologies marker of one interaction mode whose square is at `at`,
 * captioned `name` or the toolbar's English seed: the square carrying the
 * mode's role, its letter, the caption and their group.
 */
export function coreDomainMarkerElements(
  kind: CdMarkerKind,
  at: ToolboxPoint,
  name?: string,
  local = kebab(kind)
): SerializedElementProps[] {
  const preset = TEAM_TOPOLOGIES.find(p => p.kind === kind);
  if (!preset) return [];
  return markerElements(
    at,
    {
      fill: preset.fill,
      letter: preset.letter,
      label: name?.trim() || preset.label,
      role: markerRole(kind),
    },
    local
  );
}

/**
 * A movement over time between two elements: the connector the palette's
 * entry arms the tool with. Its source is the current position, its target
 * the future one, the pair `core-domain.malformed-movement` reads back.
 */
export function coreDomainMovementElement(
  from: string,
  to: string,
  label?: string
): SerializedElementProps {
  return {
    type: 'connector',
    role: CORE_DOMAIN_ROLE.movement,
    mode: ConnectorMode.Straight,
    ...coreDomainMovementStyle(),
    source: { id: from },
    target: { id: to },
    ...(label?.trim() ? { text: label.trim() } : {}),
  };
}

/** The toolbar command's label, so a host names an item as the toolbar does. */
function label(command: string) {
  const id = `ddd-core-domain.${command}`;
  const row = coreDomainCommandsManifest.find(r => r.id === id);
  return {
    labelKey: row?.labelKey ?? id,
    labelFallback: row?.labelFallback ?? id,
  };
}

const command = (kind: string) =>
  `add${kind[0]?.toUpperCase()}${kind.slice(1)}`;

const subdomain = (kind: CdSubdomainKind): ToolboxItem => ({
  id: kebab(kind),
  ...label(command(kind)),
  texts: ['name'],
  size: { w: DOT_SIZE, h: DOT_SIZE },
  build: (at, texts, local) =>
    coreDomainSubdomainElements(kind, at, texts?.name, local),
});

const marker = (kind: CdMarkerKind): ToolboxItem => ({
  id: kebab(kind),
  ...label(command(kind)),
  texts: ['name'],
  size: { w: MARKER_SIZE, h: MARKER_SIZE },
  build: (at, texts, local) =>
    coreDomainMarkerElements(kind, at, texts?.name, local),
});

const CHART_SIZE = backgroundSize(CORE_DOMAIN_BACKGROUND);

/** Every item of the Core Domain Chart toolbar, in the toolbar's order. */
export const CORE_DOMAIN_TOOLBOX: FrameworkToolbox = {
  framework: 'ddd-core-domain',
  items: [
    {
      id: 'chart',
      ...label('addChart'),
      texts: [],
      size: { w: CHART_SIZE.width, h: CHART_SIZE.height },
      build: (at, _texts, local) => [coreDomainChartElement(at, local)],
    },
    ...CD_SUBDOMAINS.map(preset => subdomain(preset.kind)),
    ...TEAM_TOPOLOGIES.map(preset => marker(preset.kind)),
  ],
  links: [
    {
      id: 'movement',
      ...label('addMovement'),
      build: (from, to, text) => coreDomainMovementElement(from, to, text),
    },
  ],
};
