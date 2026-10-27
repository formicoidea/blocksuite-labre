import {
  backgroundSize,
  type FrameworkToolbox,
  type SerializedElementProps,
  type ToolboxLink,
  type ToolboxPoint,
} from '@labre/affine-block-surface/interchange';
import {
  bubbleElement,
  CLOUD,
  CM_BUBBLE,
  CM_RELATIONSHIPS,
  cloudElements,
  LABEL_COLOR,
} from '@labre/affine-gfx-ddd-shared/headless';
import {
  ConnectorMode,
  PointStyle,
  StrokeStyle,
} from '@labre/affine-model/headless';
import { Bound } from '@labre/global/gfx';

import { CONTEXT_MAP_BACKGROUND } from './background.js';
import { contextMapCommandsManifest } from './commands-manifest.js';
import {
  CM_PATTERN_ROLE,
  CONTEXT_MAP_ROLE,
  type ContextMapPatternKind,
} from './roles.js';
import {
  CONTEXT_MAP_SEED_BOUNDED_CONTEXT,
  CONTEXT_MAP_SEED_CLOUD,
} from './seeds.js';

/**
 * The Context Map toolbar as pure builders (`docs/adr/0045`): the board, the
 * bounded context, the cloud and the nine relationship patterns, with no
 * editor behind them. The bubble and the cloud are the very builders the
 * palette's prefabs write (`@labre/affine-gfx-ddd-shared/headless`), and
 * `createContextMapBoard` and `activateContextMapRelationship` read the board
 * and the pattern style from here, so a context drawn by a host and one
 * placed from the toolbar are the same element.
 */

/** Every relationship is drawn this wide, whatever its pattern. */
const RELATIONSHIP_STROKE_WIDTH = 2;

/**
 * How a pattern is drawn: presentation only, the meaning is the role. Dashed
 * for the two "no real integration" patterns (Separate Ways, Big Ball of
 * Mud), a rear arrowhead for the five upstream/downstream ones: the arrow
 * points at the DOWNSTREAM end, which is the target, since the role's verb is
 * "is upstream of".
 */
export function contextMapRelationshipStyle(kind: ContextMapPatternKind) {
  const preset = CM_RELATIONSHIPS.find(p => p.kind === kind);
  return {
    stroke: LABEL_COLOR,
    strokeStyle: preset?.dashed ? StrokeStyle.Dash : StrokeStyle.Solid,
    strokeWidth: RELATIONSHIP_STROKE_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: preset?.upDown ? PointStyle.Arrow : PointStyle.None,
  };
}

/** The board a context map is drawn on, at `at`. */
export function contextMapBoardElement(
  at: ToolboxPoint,
  local = 'board'
): SerializedElementProps {
  const { width, height } = backgroundSize(CONTEXT_MAP_BACKGROUND);
  return {
    type: CONTEXT_MAP_BACKGROUND.type,
    id: local,
    // The board is a first-class role: rules frame contexts against
    // `context-map:board`, never against the `contextMap` element type.
    role: CONTEXT_MAP_BACKGROUND.role,
    resizeEnabled: CONTEXT_MAP_BACKGROUND.geometry.resizable,
    xywh: new Bound(at.x, at.y, width, height).serialize(),
  };
}

/**
 * A bounded context at `at`, named `name` or the toolbar's English seed. The
 * role is what makes the pill a bounded CONTEXT every rule reads.
 */
export function contextMapContextElement(
  at: ToolboxPoint,
  name?: string,
  local = 'bounded-context'
): SerializedElementProps {
  return bubbleElement(
    at,
    name?.trim() || CONTEXT_MAP_SEED_BOUNDED_CONTEXT[1],
    CONTEXT_MAP_ROLE.context,
    local
  );
}

/**
 * A cloud (an outside system, a Big Ball of Mud) at `at`: the polygon carrying
 * `context-map:system`, its name and their group.
 */
export function contextMapSystemElements(
  at: ToolboxPoint,
  name?: string,
  local = 'system'
): SerializedElementProps[] {
  return cloudElements(
    at,
    name?.trim() || CONTEXT_MAP_SEED_CLOUD[1],
    CONTEXT_MAP_ROLE.system,
    local
  );
}

/**
 * A relationship of one pattern between two elements: the connector the
 * pattern's palette entry arms the tool with. Its source is the upstream
 * context for the five upstream/downstream patterns.
 */
export function contextMapRelationshipElement(
  kind: ContextMapPatternKind,
  from: string,
  to: string,
  label?: string
): SerializedElementProps {
  return {
    type: 'connector',
    role: CM_PATTERN_ROLE[kind],
    mode: ConnectorMode.Straight,
    ...contextMapRelationshipStyle(kind),
    source: { id: from },
    target: { id: to },
    ...(label?.trim() ? { text: label.trim() } : {}),
  };
}

/** The toolbar command's label, so a host names an item as the toolbar does. */
function label(command: string) {
  const id = `ddd-context-map.${command}`;
  const row = contextMapCommandsManifest.find(r => r.id === id);
  return {
    labelKey: row?.labelKey ?? id,
    labelFallback: row?.labelFallback ?? id,
  };
}

const kebab = (kind: string): string =>
  kind.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

const relationship = (kind: ContextMapPatternKind): ToolboxLink => ({
  id: kebab(kind),
  ...label(`add${kind[0]?.toUpperCase()}${kind.slice(1)}`),
  build: (from, to, text) =>
    contextMapRelationshipElement(kind, from, to, text),
});

const BOARD_SIZE = backgroundSize(CONTEXT_MAP_BACKGROUND);

/** Every item of the Context Map toolbar, in the toolbar's order. */
export const CONTEXT_MAP_TOOLBOX: FrameworkToolbox = {
  framework: 'ddd-context-map',
  items: [
    {
      id: 'board',
      ...label('addBoard'),
      texts: [],
      size: { w: BOARD_SIZE.width, h: BOARD_SIZE.height },
      build: (at, _texts, local) => [contextMapBoardElement(at, local)],
    },
    {
      id: 'bounded-context',
      ...label('addBoundedContext'),
      texts: ['name'],
      size: { w: CM_BUBBLE.w, h: CM_BUBBLE.h },
      build: (at, texts, local) => [
        contextMapContextElement(at, texts?.name, local),
      ],
    },
    {
      id: 'system',
      ...label('addCloud'),
      texts: ['name'],
      size: { w: CLOUD.w, h: CLOUD.h },
      build: (at, texts, local) =>
        contextMapSystemElements(at, texts?.name, local),
    },
  ],
  links: CM_RELATIONSHIPS.map(preset => relationship(preset.kind)),
};
