import {
  backgroundSize,
  type FrameworkToolbox,
  type SerializedElementProps,
  type ToolboxItem,
  type ToolboxPoint,
} from '@labre/affine-block-surface/interchange';
import {
  ES_HOTSPOT,
  ES_STICKIES,
  LABEL_COLOR,
  type StickyOpts,
  stickyElements,
} from '@labre/affine-gfx-ddd-shared/headless';
import {
  ConnectorMode,
  PointStyle,
  StrokeStyle,
} from '@labre/affine-model/headless';
import { Bound } from '@labre/global/gfx';

import { EVENT_STORMING_BACKGROUND } from './background.js';
import { eventStormingCommandsManifest } from './commands-manifest.js';
import {
  ES_ROLE,
  ES_STICKY_ROLE,
  type EventStormingStickyKind,
} from './roles.js';
import { eventStormingStickySize } from './sticky-size.js';

/**
 * The Event Storming toolbar as pure builders (`docs/adr/0045`): the board,
 * the eight colour-coded stickies, the hotspot and the flow, with no editor
 * behind them. A sticky is the very builder the palette's prefab writes
 * (`stickyElements`, `@labre/affine-gfx-ddd-shared/headless`) with the options
 * `commands.ts` passes it ({@link eventStormingStickyOpts}), and
 * `createEventStormingBoard` and `activateEventStormingFlow` read the board
 * and the flow's style from here, so a sticky drawn by a host and one placed
 * from the toolbar are the same elements.
 */

/** Every flow is drawn this wide. */
const FLOW_STROKE_WIDTH = 2;

/** Each sticky kind's preset: the eight of the shared table, then the hotspot. */
const STICKY_PRESETS = {
  ...Object.fromEntries(ES_STICKIES.map(preset => [preset.kind, preset])),
  hotspot: ES_HOTSPOT,
} as Record<
  EventStormingStickyKind,
  { label: string; fill: string; text: string }
>;

/** The sticky kinds in the toolbar's order: the shared table's, hotspot last. */
const STICKY_KINDS: readonly EventStormingStickyKind[] = [
  ...ES_STICKIES.map(preset => preset.kind),
  'hotspot',
];

/**
 * What a sticky of `kind` is, as the prefab's options, its words `label`:
 * the kind's colours, its size (the aggregate is bigger), its shape (the
 * hotspot is a diamond) and its role, which is what makes it a domain EVENT
 * rather than an orange square for every rule in `rules.ts`. The toolbar
 * passes the seed in the host's language; a host with no editor its own words
 * or the English seed.
 */
export function eventStormingStickyOpts(
  kind: EventStormingStickyKind,
  label: string
): StickyOpts {
  const { fill, text } = STICKY_PRESETS[kind];
  return {
    fill,
    text,
    label,
    size: eventStormingStickySize(kind),
    ...(kind === 'hotspot' ? { shapeType: 'diamond' as const } : {}),
    role: ES_STICKY_ROLE[kind],
  };
}

/** The item id of a sticky kind: its role's own slug (`external-system`…). */
const stickyItemId = (kind: EventStormingStickyKind): string =>
  ES_STICKY_ROLE[kind].slice('es:'.length);

/**
 * A sticky of `kind` whose face is at `at`, named `name` or the toolbar's
 * English seed: the shadow, the face carrying the role and the words, and
 * their group, last.
 */
export function eventStormingStickyElements(
  kind: EventStormingStickyKind,
  at: ToolboxPoint,
  name?: string,
  local = stickyItemId(kind)
): SerializedElementProps[] {
  return stickyElements(
    at,
    eventStormingStickyOpts(kind, name?.trim() || STICKY_PRESETS[kind].label),
    local
  );
}

/** The board a storm is run on, at `at`. */
export function eventStormingBoardElement(
  at: ToolboxPoint,
  local = 'board'
): SerializedElementProps {
  const { width, height } = backgroundSize(EVENT_STORMING_BACKGROUND);
  return {
    type: EVENT_STORMING_BACKGROUND.type,
    id: local,
    // The board is a first-class role: rules frame stickies against
    // `es:board`, never against the `eventStorming` element type.
    role: EVENT_STORMING_BACKGROUND.role,
    resizeEnabled: EVENT_STORMING_BACKGROUND.geometry.resizable,
    xywh: new Bound(at.x, at.y, width, height).serialize(),
  };
}

/**
 * How a flow is drawn: presentation only, the meaning is the role. A plain
 * straight line with a rear arrowhead pointing at what FOLLOWS, which is the
 * target: the role's verb is "leads to", so the source is what happens first.
 */
export function eventStormingFlowStyle() {
  return {
    stroke: LABEL_COLOR,
    strokeStyle: StrokeStyle.Solid,
    strokeWidth: FLOW_STROKE_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Arrow,
  };
}

/**
 * A flow from what happens first to what follows: the connector the Flow
 * entry arms the tool with.
 */
export function eventStormingFlowElement(
  from: string,
  to: string,
  label?: string
): SerializedElementProps {
  return {
    type: 'connector',
    role: ES_ROLE.flow,
    mode: ConnectorMode.Straight,
    ...eventStormingFlowStyle(),
    source: { id: from },
    target: { id: to },
    ...(label?.trim() ? { text: label.trim() } : {}),
  };
}

/** The toolbar command's label, so a host names an item as the toolbar does. */
function label(command: string) {
  const id = `ddd-event-storming.${command}`;
  const row = eventStormingCommandsManifest.find(r => r.id === id);
  return {
    labelKey: row?.labelKey ?? id,
    labelFallback: row?.labelFallback ?? id,
  };
}

const sticky = (kind: EventStormingStickyKind): ToolboxItem => {
  const side = eventStormingStickySize(kind);
  return {
    id: stickyItemId(kind),
    ...label(`add${kind[0]?.toUpperCase()}${kind.slice(1)}`),
    texts: ['name'],
    size: { w: side, h: side },
    build: (at, texts, local) =>
      eventStormingStickyElements(kind, at, texts?.name, local),
  };
};

const BOARD_SIZE = backgroundSize(EVENT_STORMING_BACKGROUND);

/** Every item of the Event Storming toolbar, in the toolbar's order. */
export const EVENT_STORMING_TOOLBOX: FrameworkToolbox = {
  framework: 'ddd-event-storming',
  items: [
    {
      id: 'board',
      ...label('addBoard'),
      texts: [],
      size: { w: BOARD_SIZE.width, h: BOARD_SIZE.height },
      build: (at, _texts, local) => [eventStormingBoardElement(at, local)],
    },
    ...STICKY_KINDS.map(sticky),
  ],
  links: [
    {
      id: 'flow',
      ...label('addFlow'),
      build: (from, to, text) => eventStormingFlowElement(from, to, text),
    },
  ],
};
