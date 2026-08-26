import type { BpmnNodeKind } from '@labre/affine-model';
import type { RoleDef, RoleDefs, RoleId } from '@labre/std/gfx';

/**
 * BPMN role vocabulary (B1).
 *
 * A role is the semantic identity of a BPMN artefact — no rule will ever look at
 * a shape type, and none ever could here: the whole notation is drawn with three
 * native shapes, and an ellipse is a start event, an end event or somebody's
 * doodle depending entirely on what the author meant. The `kind` discriminant
 * the pack already carries answers a different question (which glyph to paint);
 * the role answers what the glyph MEANS.
 *
 * Hierarchy is DATA (`parent`), never TS inheritance: `bpmn:start-event` and
 * `bpmn:end-event` specialise `bpmn:event`, so a rule written on the parent
 * applies to both for free (see `roleIsA`). The three parents are declared even
 * though the lean pack ships only one or two children each, because BPMN's own
 * taxonomy is exactly this shape — events, activities, gateways — and the full
 * pack lands ~20 artefacts under them (message and timer events, sub-process and
 * call activity, the parallel and inclusive gateways). The tree is written once,
 * here, so those arrive as leaves rather than as a reshuffle.
 *
 * The **pool** is parent-less on purpose, the same call `wardley:map` makes: it
 * is the FRAME the flow objects are drawn in, and a rule written on the artefacts
 * must never fall on the lane they sit in.
 *
 * ## Compatibility
 *
 * Nothing is backfilled. A process drawn before today carries nodes, pools and
 * connectors with no role, so it is never evaluated and never says a word — the
 * same promise every role in this library has made (PRD principle 8).
 */

/** Every role this framework declares. */
export type BpmnRole =
  | 'event'
  | 'start-event'
  | 'end-event'
  | 'activity'
  | 'task'
  | 'gateway'
  | 'gateway-exclusive'
  | 'pool'
  | 'sequence-flow'
  | 'message-flow';

export type BpmnRoleId = `bpmn:${BpmnRole}`;

/**
 * How {@link BPMN_ROLE} is keyed: by the `kind` used at the creation sites,
 * camelCased where the role id is not a single word. Spelled out so the table
 * below stays exhaustive over {@link BpmnRole} — a role added to the union and
 * forgotten here is a compile error.
 */
type BpmnRoleKey =
  | Exclude<
      BpmnRole,
      | 'start-event'
      | 'end-event'
      | 'gateway-exclusive'
      | 'sequence-flow'
      | 'message-flow'
    >
  | 'startEvent'
  | 'endEvent'
  | 'gatewayExclusive'
  | 'sequenceFlow'
  | 'messageFlow';

/** Role ids, keyed by the `kind` used at the creation sites. */
export const BPMN_ROLE = {
  // The three families of flow object, and the leaves the lean pack draws.
  event: 'bpmn:event',
  startEvent: 'bpmn:start-event',
  endEvent: 'bpmn:end-event',
  activity: 'bpmn:activity',
  task: 'bpmn:task',
  gateway: 'bpmn:gateway',
  gatewayExclusive: 'bpmn:gateway-exclusive',
  // The frame.
  pool: 'bpmn:pool',
  // The two connecting objects.
  sequenceFlow: 'bpmn:sequence-flow',
  messageFlow: 'bpmn:message-flow',
} as const satisfies Record<BpmnRoleKey, BpmnRoleId>;

/** i18n key stem of a role id: `bpmn:start-event` → `com.labre.bpmn.role.start-event`. */
const roleKey = (id: RoleId) =>
  `com.labre.bpmn.role.${id.slice('bpmn:'.length)}`;

const FLOW_OBJECT_DEFS: readonly RoleDef[] = [
  // The three parents. None of them is ever STAMPED on an element — the palette
  // always says which event, which activity, which gateway — and that is the
  // point: they exist so a rule can be written once about "an event" and stay
  // written when the full pack adds the message and timer ones under them.
  {
    id: BPMN_ROLE.event,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.event),
    labelFallback: 'Event',
  },
  {
    id: BPMN_ROLE.startEvent,
    parent: BPMN_ROLE.event,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.startEvent),
    labelFallback: 'Start event',
  },
  {
    id: BPMN_ROLE.endEvent,
    parent: BPMN_ROLE.event,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.endEvent),
    labelFallback: 'End event',
  },
  {
    id: BPMN_ROLE.activity,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.activity),
    labelFallback: 'Activity',
  },
  // The plain task — the only activity the lean pack draws. Sub-process and call
  // activity join it under `bpmn:activity` in the full pack.
  {
    id: BPMN_ROLE.task,
    parent: BPMN_ROLE.activity,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.task),
    labelFallback: 'Task',
  },
  {
    id: BPMN_ROLE.gateway,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.gateway),
    labelFallback: 'Gateway',
  },
  // The exclusive (XOR) gateway. Its siblings — parallel, inclusive,
  // event-based — are the same diamond with another marker inside, which is
  // exactly why the marker must not be what a rule reads.
  {
    id: BPMN_ROLE.gatewayExclusive,
    parent: BPMN_ROLE.gateway,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.gatewayExclusive),
    labelFallback: 'Exclusive gateway',
  },
];

// The pool: the participant's own lane, the frame the flow objects are drawn in.
// Parent-less, like `wardley:map` — a rule written on the flow objects must
// never match the pool that holds them.
const POOL_DEFS: readonly RoleDef[] = [
  {
    id: BPMN_ROLE.pool,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.pool),
    labelFallback: 'Pool',
  },
];

/**
 * The two connecting objects.
 *
 * Neither specialises the other, and there is deliberately no `bpmn:flow`
 * parent: a sequence flow stays inside one pool and orders the work, a message
 * flow crosses between pools and carries nothing but the message. They are two
 * different sentences, and a rule about one must never fall on the other.
 */
const FLOW_DEFS: readonly RoleDef[] = [
  /**
   * The sequence flow, pre-authorised as a typed edge by `docs/adr/0010`.
   *
   * Tier 1 of that ADR is generic — `source` is the subject of the role's verb,
   * `target` its object — and tier 2 is this `direction` block: the verb is "is
   * followed by", so the source is what happens FIRST and the target is what
   * comes next. That is the whole of what makes an arrow on this canvas a
   * statement the author made rather than a by-product of which end their finger
   * landed on first, and it is what the hover reveal reads back with the `bpmn`
   * flag off.
   */
  {
    id: BPMN_ROLE.sequenceFlow,
    kind: 'edge',
    labelKey: roleKey(BPMN_ROLE.sequenceFlow),
    labelFallback: 'Sequence flow',
    direction: {
      verbKey: `${roleKey(BPMN_ROLE.sequenceFlow)}.verb`,
      verbFallback: 'is followed by',
      gestureHintKey: `${roleKey(BPMN_ROLE.sequenceFlow)}.gesture`,
      gestureHintFallback: 'Drag from what happens first to what follows.',
    },
  },
  /**
   * The message flow — RESERVED.
   *
   * Declared in the vocabulary and stamped by nothing: the lean pack ships no
   * creation tool for it, and the full pack adds one next session. It is written
   * down now rather than later because the vocabulary is the one thing a stored
   * document points at: an id declared today reads correctly whenever it is
   * first written, whereas an id invented after the fact has to be reconciled
   * with whatever the intervening months stamped.
   *
   * Its verb is its own — a message flow says nothing about ORDER, only about
   * who told whom — which is precisely why it is not a child of the sequence
   * flow.
   */
  {
    id: BPMN_ROLE.messageFlow,
    kind: 'edge',
    labelKey: roleKey(BPMN_ROLE.messageFlow),
    labelFallback: 'Message flow',
    direction: {
      verbKey: `${roleKey(BPMN_ROLE.messageFlow)}.verb`,
      verbFallback: 'sends a message to',
      gestureHintKey: `${roleKey(BPMN_ROLE.messageFlow)}.gesture`,
      gestureHintFallback:
        'Drag from the participant that sends the message to the one that receives it.',
    },
  },
];

const DEFS: readonly RoleDef[] = [
  ...FLOW_OBJECT_DEFS,
  ...POOL_DEFS,
  ...FLOW_DEFS,
];

// Null prototype: this is a lookup table keyed by ids that may one day come
// from host-supplied packs, so `defs['toString']` must not resolve.
export const BPMN_ROLES: RoleDefs = Object.assign(
  Object.create(null),
  Object.fromEntries(DEFS.map(def => [def.id, def]))
);

/**
 * The legacy `kind` discriminant → the role it means.
 *
 * `kind` STAYS: it is persisted, it drives the renderer and it is what the
 * palette writes. What it is not, from today, is the semantic authority — the
 * ROLE is. The two are posted side by side at every creation site, the way
 * Wardley already does it, and this table is the single place that says which
 * kind means which role. Total over {@link BpmnNodeKind} by its type, so a fifth
 * kind cannot land without being given a meaning.
 */
export const BPMN_ROLE_OF_KIND: Record<BpmnNodeKind, RoleId> = {
  startEvent: BPMN_ROLE.startEvent,
  endEvent: BPMN_ROLE.endEvent,
  task: BPMN_ROLE.task,
  gatewayExclusive: BPMN_ROLE.gatewayExclusive,
};
