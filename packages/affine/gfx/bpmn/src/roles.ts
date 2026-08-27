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
 * applies to both for free (see `roleIsA`). The three families were declared
 * while the lean pack still shipped one or two children each, precisely so that
 * the descriptive profile could land underneath them without a reshuffle — and
 * that is what happened: the message and timer starts, the message and terminate
 * ends, the user and service tasks, the sub-process, the call activity and the
 * parallel gateway all arrived as LEAVES, and everything already written about
 * "an event" or "an activity" stayed written.
 *
 * The tree is now three levels deep on two branches — `bpmn:message-start-event`
 * is a `bpmn:start-event` is a `bpmn:event`, and `bpmn:user-task` is a
 * `bpmn:task` is a `bpmn:activity` — which `roleIsA` walks for free.
 *
 * The **pool** is parent-less on purpose, the same call `wardley:map` makes: it
 * is the FRAME the flow objects are drawn in, and a rule written on the artefacts
 * must never fall on the lane they sit in. `bpmn:data` is a family of its own for
 * the same reason inverted: a data object is not a flow object, it is never
 * executed, and a rule about the WORK must not fall on the paperwork. And
 * `bpmn:text-annotation` is parent-less AND childless — a note the author wrote
 * on the picture, which belongs to no family because it says nothing the process
 * does.
 *
 * ## Compatibility
 *
 * Nothing is backfilled. A process drawn before today carries nodes, pools and
 * connectors with no role, so it is never evaluated and never says a word — the
 * same promise every role in this library has made (PRD principle 8).
 */

/** Every role this framework declares. */
export type BpmnRole =
  // Events.
  | 'event'
  | 'start-event'
  | 'message-start-event'
  | 'timer-start-event'
  | 'end-event'
  | 'message-end-event'
  | 'terminate-end-event'
  // Activities.
  | 'activity'
  | 'task'
  | 'user-task'
  | 'service-task'
  | 'sub-process'
  | 'call-activity'
  // Gateways.
  | 'gateway'
  | 'gateway-exclusive'
  | 'parallel-gateway'
  // Data.
  | 'data'
  | 'data-object'
  | 'data-store'
  // The lone artifact.
  | 'text-annotation'
  // The frame.
  | 'pool'
  // Connecting objects.
  | 'sequence-flow'
  | 'message-flow'
  | 'association';

export type BpmnRoleId = `bpmn:${BpmnRole}`;

/**
 * How {@link BPMN_ROLE} is keyed: by the `kind` used at the creation sites where
 * a kind exists, camelCased; by its own name where none does (the families, the
 * pool, the flows). Spelled out rather than derived because the two vocabularies
 * do not agree word for word — the kind is `startEventMessage` (it sorts with
 * its siblings in a palette) and the role is `bpmn:message-start-event` (it is
 * what the BPMN spec calls the thing).
 */
type BpmnRoleKey =
  | 'event'
  | 'startEvent'
  | 'startEventMessage'
  | 'startEventTimer'
  | 'endEvent'
  | 'endEventMessage'
  | 'endEventTerminate'
  | 'activity'
  | 'task'
  | 'taskUser'
  | 'taskService'
  | 'subProcess'
  | 'callActivity'
  | 'gateway'
  | 'gatewayExclusive'
  | 'gatewayParallel'
  | 'data'
  | 'dataObject'
  | 'dataStore'
  | 'textAnnotation'
  | 'pool'
  | 'sequenceFlow'
  | 'messageFlow'
  | 'association';

/** Role ids, keyed by the `kind` used at the creation sites. */
export const BPMN_ROLE = {
  // Events: the family, the two starts and the two ends, and the leaves the
  // descriptive profile draws under each.
  event: 'bpmn:event',
  startEvent: 'bpmn:start-event',
  startEventMessage: 'bpmn:message-start-event',
  startEventTimer: 'bpmn:timer-start-event',
  endEvent: 'bpmn:end-event',
  endEventMessage: 'bpmn:message-end-event',
  endEventTerminate: 'bpmn:terminate-end-event',
  // Activities.
  activity: 'bpmn:activity',
  task: 'bpmn:task',
  taskUser: 'bpmn:user-task',
  taskService: 'bpmn:service-task',
  subProcess: 'bpmn:sub-process',
  callActivity: 'bpmn:call-activity',
  // Gateways. `gateway-exclusive` keeps the word order it shipped with — it is
  // written in documents already — while its sibling takes the spec's own
  // ("parallel gateway"). An id in a stored document is not a naming
  // convention: it is a value, and renaming it would orphan every process that
  // carries it.
  gateway: 'bpmn:gateway',
  gatewayExclusive: 'bpmn:gateway-exclusive',
  gatewayParallel: 'bpmn:parallel-gateway',
  // Data — a family of its own, never a flow object.
  data: 'bpmn:data',
  dataObject: 'bpmn:data-object',
  dataStore: 'bpmn:data-store',
  // The lone artifact: a note on the picture.
  textAnnotation: 'bpmn:text-annotation',
  // The frame.
  pool: 'bpmn:pool',
  // The connecting objects.
  sequenceFlow: 'bpmn:sequence-flow',
  messageFlow: 'bpmn:message-flow',
  association: 'bpmn:association',
} as const satisfies Record<BpmnRoleKey, BpmnRoleId>;

/**
 * Compile-time proof that {@link BPMN_ROLE} is total over {@link BpmnRole} in
 * the OTHER direction too: `satisfies Record<BpmnRoleKey, …>` only checks that
 * every key is present, so without this a role added to the union and forgotten
 * in the table would slip through as long as its key was also forgotten. Reads
 * as `never` — and therefore fails to accept `true` — the moment one does.
 */
type _UnmappedBpmnRole = Exclude<
  BpmnRoleId,
  (typeof BPMN_ROLE)[keyof typeof BPMN_ROLE]
>;
const _everyRoleIsMapped: [_UnmappedBpmnRole] extends [never] ? true : never =
  true;
void _everyRoleIsMapped;

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
  // The two TRIGGERED starts. Children of the plain start event and not
  // siblings of it: "the process starts here" is true of all three, and a rule
  // about where a process begins must not have to enumerate the triggers.
  {
    id: BPMN_ROLE.startEventMessage,
    parent: BPMN_ROLE.startEvent,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.startEventMessage),
    labelFallback: 'Message start event',
  },
  {
    id: BPMN_ROLE.startEventTimer,
    parent: BPMN_ROLE.startEvent,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.startEventTimer),
    labelFallback: 'Timer start event',
  },
  {
    id: BPMN_ROLE.endEvent,
    parent: BPMN_ROLE.event,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.endEvent),
    labelFallback: 'End event',
  },
  // ...and the two ends that do something on the way out.
  {
    id: BPMN_ROLE.endEventMessage,
    parent: BPMN_ROLE.endEvent,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.endEventMessage),
    labelFallback: 'Message end event',
  },
  {
    id: BPMN_ROLE.endEventTerminate,
    parent: BPMN_ROLE.endEvent,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.endEventTerminate),
    labelFallback: 'Terminate end event',
  },
  {
    id: BPMN_ROLE.activity,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.activity),
    labelFallback: 'Activity',
  },
  // The plain task — one unit of work, done by someone or something unnamed.
  {
    id: BPMN_ROLE.task,
    parent: BPMN_ROLE.activity,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.task),
    labelFallback: 'Task',
  },
  // The two typed tasks, under the plain one: they are tasks that also say WHO
  // performs them. A rule about the work applies to all three; a rule about
  // human hand-offs reads only the first.
  {
    id: BPMN_ROLE.taskUser,
    parent: BPMN_ROLE.task,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.taskUser),
    labelFallback: 'User task',
  },
  {
    id: BPMN_ROLE.taskService,
    parent: BPMN_ROLE.task,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.taskService),
    labelFallback: 'Service task',
  },
  // Sub-process and call activity are activities but NOT tasks: a task is
  // atomic and these two stand for a whole process each — one defined inline,
  // one defined elsewhere and reused. Filing them under `bpmn:task` would make
  // "every task is one unit of work" false.
  {
    id: BPMN_ROLE.subProcess,
    parent: BPMN_ROLE.activity,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.subProcess),
    labelFallback: 'Sub-process',
  },
  {
    id: BPMN_ROLE.callActivity,
    parent: BPMN_ROLE.activity,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.callActivity),
    labelFallback: 'Call activity',
  },
  {
    id: BPMN_ROLE.gateway,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.gateway),
    labelFallback: 'Gateway',
  },
  // The exclusive (XOR) gateway and the parallel (AND) one. Same diamond, and
  // the marker inside is the only thing that tells them apart on the canvas —
  // which is exactly why the marker must not be what a rule reads.
  {
    id: BPMN_ROLE.gatewayExclusive,
    parent: BPMN_ROLE.gateway,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.gatewayExclusive),
    labelFallback: 'Exclusive gateway',
  },
  {
    id: BPMN_ROLE.gatewayParallel,
    parent: BPMN_ROLE.gateway,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.gatewayParallel),
    labelFallback: 'Parallel gateway',
  },
];

/**
 * Data — the paperwork, not the work.
 *
 * A family of its own, parent-less like the pool: a data object is never
 * executed, never has a duration and is never on the happy path, so a rule
 * written about the flow objects must not fall on it. The two leaves are the
 * only distinction BPMN itself draws here — a data OBJECT lives and dies with
 * the process instance, a data STORE outlives it.
 */
const DATA_DEFS: readonly RoleDef[] = [
  {
    id: BPMN_ROLE.data,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.data),
    labelFallback: 'Data',
  },
  {
    id: BPMN_ROLE.dataObject,
    parent: BPMN_ROLE.data,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.dataObject),
    labelFallback: 'Data object',
  },
  {
    id: BPMN_ROLE.dataStore,
    parent: BPMN_ROLE.data,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.dataStore),
    labelFallback: 'Data store',
  },
];

/**
 * The text annotation: a note the author wrote ON the picture.
 *
 * Parent-less and childless. It is not a flow object, not data and not a frame
 * — it is commentary, and the one thing every rule in this framework must agree
 * on is that commentary is never evidence. Declared all the same, so a reader
 * (and the audit) can tell an annotation from an unnamed rectangle somebody
 * left behind.
 */
const ANNOTATION_DEFS: readonly RoleDef[] = [
  {
    id: BPMN_ROLE.textAnnotation,
    kind: 'node',
    labelKey: roleKey(BPMN_ROLE.textAnnotation),
    labelFallback: 'Text annotation',
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
  /**
   * The association — the line that ties an annotation or a data object to the
   * work it is about.
   *
   * Declared WITHOUT a `direction`, and that is the whole point of it. Tier 1 of
   * `docs/adr/0010` says an edge role names a relation with a VERB, source the
   * subject and target the object; an association names no relation and has no
   * verb. "This note is about that task" reads identically from either end, and
   * the spec agrees: an association is undirected unless it carries data, which
   * the descriptive profile does not.
   *
   * The consequence is deliberate and is the reason to write it down here: the
   * hover reveal shows its LABEL and no sentence, and the "reverse direction"
   * toolbar entry has nothing to offer — because there is no direction to be
   * wrong about, so there is none to fix.
   */
  {
    id: BPMN_ROLE.association,
    kind: 'edge',
    labelKey: roleKey(BPMN_ROLE.association),
    labelFallback: 'Association',
  },
];

const DEFS: readonly RoleDef[] = [
  ...FLOW_OBJECT_DEFS,
  ...DATA_DEFS,
  ...ANNOTATION_DEFS,
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
 * kind means which role. Total over {@link BpmnNodeKind} by its type, so a new
 * kind cannot land without being given a meaning.
 */
export const BPMN_ROLE_OF_KIND: Record<BpmnNodeKind, RoleId> = {
  startEvent: BPMN_ROLE.startEvent,
  startEventMessage: BPMN_ROLE.startEventMessage,
  startEventTimer: BPMN_ROLE.startEventTimer,
  endEvent: BPMN_ROLE.endEvent,
  endEventMessage: BPMN_ROLE.endEventMessage,
  endEventTerminate: BPMN_ROLE.endEventTerminate,
  task: BPMN_ROLE.task,
  taskUser: BPMN_ROLE.taskUser,
  taskService: BPMN_ROLE.taskService,
  subProcess: BPMN_ROLE.subProcess,
  callActivity: BPMN_ROLE.callActivity,
  gatewayExclusive: BPMN_ROLE.gatewayExclusive,
  gatewayParallel: BPMN_ROLE.gatewayParallel,
  dataObject: BPMN_ROLE.dataObject,
  dataStore: BPMN_ROLE.dataStore,
  textAnnotation: BPMN_ROLE.textAnnotation,
};
