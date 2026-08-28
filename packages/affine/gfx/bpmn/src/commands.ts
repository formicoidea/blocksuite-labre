import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import type { TemplateResult } from 'lit';

import {
  activateBpmnAssociation,
  activateBpmnMessageFlow,
  activateBpmnSequenceFlow,
  addBpmnLane,
  bpmnLanesOf,
  bpmnPoolsForLaneEdit,
  bpmnPoolsSelected,
  createBpmnNode,
  createBpmnPool,
  exportBpmnXmlFile,
  importBpmnSvgFile,
  importBpmnXmlFile,
  removeBpmnLane,
} from './actions';
import {
  bpmnAssociationIcon,
  bpmnCallActivityIcon,
  bpmnDataObjectIcon,
  bpmnDataStoreIcon,
  bpmnEndIcon,
  bpmnEndMessageIcon,
  bpmnEndTerminateIcon,
  bpmnExportXmlIcon,
  bpmnGatewayIcon,
  bpmnGatewayParallelIcon,
  bpmnGroupIcon,
  bpmnImportSvgIcon,
  bpmnImportXmlIcon,
  bpmnLaneAddIcon,
  bpmnLaneRemoveIcon,
  bpmnMessageIcon,
  bpmnPoolIcon,
  bpmnSequenceIcon,
  bpmnStartIcon,
  bpmnStartMessageIcon,
  bpmnStartTimerIcon,
  bpmnSubProcessIcon,
  bpmnTaskIcon,
  bpmnTaskServiceIcon,
  bpmnTaskUserIcon,
  bpmnTextAnnotationIcon,
} from './toolbar/icons';

/**
 * The BPMN toolbox as commands. Like EDGY, BPMN had a menu and zero manifest
 * entries before PF3 — invisible to Settings › Shortcuts (`docs/adr/0008`).
 *
 * ## Twenty-five, and the fifteen
 *
 * The descriptive-profile pack draws 17 artefacts, 3 connecting objects and 3
 * swimlane gestures; the two directions of the `.bpmn` format make 25, against a
 * senior sub-menu that holds 14. That is not a problem to be solved: PF6 built
 * the arbitration for exactly this day (`selectSeniorMenuCommands`), and past
 * the cap the sub-menu becomes the thirteen commands THIS user reaches for plus
 * "More artefacts…" — fourteen buttons, exactly the cap.
 *
 * What a framework still owes is a sensible COLD START, and it owes it twice:
 *
 * - the FIFTEEN it nominates for the row — the fourteen toolbox entries flagged
 *   `senior` below, plus `bpmn.importXml`, which carries its own nomination on
 *   its descriptor. The toolbox fourteen are one of each family plus the
 *   variants an architect reaches for hourly (the user and service tasks, the
 *   sub-process, the call activity, the parallel gateway, the message flow, the
 *   data object, the annotation). What stays out is the TRIGGER variants of
 *   start and end — a plain event is the honest first draft, and the envelope or
 *   the clock is a refinement — the data store, and the two things you reach for
 *   only once something is already drawn: the association and the group.
 *
 *   Since the eligibility ruling of 2026-08-28 this list is not merely a cold
 *   start but the whole ELIGIBLE pool: usage ranks membership inside it and can
 *   no longer promote a command from outside it, so a command left out of it
 *   lives in the catalogue sidepanel and nowhere else. That is the right home
 *   for `bpmn.exportXml`, whose subject is a board you already have and which is
 *   reached from the pool's "⋮" — it declines the row on purpose.
 *
 *   `bpmn.importXml` does NOT, since the PO decision of the same day: an import
 *   is where a board COMES FROM, and the sub-menu is the first thing a user
 *   opens on an empty canvas. Fifteen nominations against a cap of fourteen is
 *   the arbitration doing its job, not an overflow — see the note on
 *   {@link importCommand}, which is where that reversal is argued;
 * - the THIRTEEN a user with no history actually meets, which is the authored
 *   head of those fifteen. That is a different list again, and it is the one
 *   that gets seen first — see the note on {@link SPECS} for why the
 *   declarations lead with the core rather than by family. The import is the
 *   last nomination, so it is one of the two the "More artefacts…" button covers
 *   until somebody reaches for it.
 *
 * All 25 are in the catalogue, all 25 are bindable from Settings › Shortcuts,
 * and none of them is unreachable.
 */
interface Spec {
  id: string;
  label: string;
  iconKey: string;
  kind: 'artefact' | 'tool';
  /**
   * The catalogue section this entry is filed under. Kebab ids; the header
   * wording is the host's (`com.labre.catalogue.category.<id>`), with the
   * panel's own `humanizeCategory` as the fallback — so the framework names its
   * sections and invents no prose for them.
   */
  category:
    | 'events'
    | 'activities'
    | 'gateways'
    | 'flows'
    | 'data'
    | 'annotations'
    | 'swimlanes';
  /**
   * Nominated for the sub-menu — the fourteen TOOLBOX entries it may ever show,
   * beside the one nomination that is not a toolbox entry at all
   * ({@link importCommand}). Since 2026-08-28 this is an eligibility
   * declaration, not a starting position: usage ranks membership INSIDE the
   * nominated list and never promotes into it, and a cold start opens on its
   * first thirteen.
   */
  senior: boolean;
  /** Historical `FrameworkElementEvent.element` value — do not rename. */
  element: string;
  run: (std: BlockStdScope) => void;
}

/**
 * Declaration order is DISPLAY order, and past the cap it is also the COLD
 * START — which is why it leads with the canonical core rather than with the
 * events.
 *
 * `selectSeniorMenuCommands` falls back to the authored head of the NOMINATED
 * list for a user who has invoked nothing yet. The row held seven when the
 * recette caught this, and an order grouped strictly by family spent all seven
 * on events: start, three of its variants, two ends, task. A first contact with
 * BPMN with no gateway, no sequence flow and no pool — every button drawing a
 * circle, and nothing to connect them with. Caught in a live recette, and it is
 * pure data.
 *
 * The first seven are therefore the seven artefacts a process cannot be drawn
 * without: start, end, task, exclusive gateway, sequence flow, pool, message
 * flow. Everything else follows in family blocks. The row seats thirteen since
 * 2026-08-28, which makes the head wider but not less load-bearing: a framework
 * whose declarations opened on six variants of one family would still meet a
 * user with a lopsided first contact. Nothing about position STABILITY changes
 * — author order is still the position law, and usage only ever changes
 * membership, never where a button sits (`docs/adr/0008`, amendments of
 * 2026-08-26 and 2026-08-28).
 *
 * The catalogue reads off the same order, so its headers now appear in
 * first-encounter order — events, activities, gateways, flows, swimlanes, data,
 * annotations — and the entries inside each keep author order. Both are better
 * reading than the strict grouping was: swimlanes climbs to where a pool
 * belongs, and the events section opens on the plain start and end rather than
 * burying them under their own variants.
 */
const SPECS: Spec[] = [
  /* ── The core: a drawable process, from the first click ─────────────── */
  {
    id: 'addStartEvent',
    label: 'Start event',
    iconKey: 'bpmn.start',
    kind: 'artefact',
    category: 'events',
    senior: true,
    element: 'node:startEvent',
    run: std => createBpmnNode(std, 'startEvent'),
  },
  {
    id: 'addEndEvent',
    label: 'End event',
    iconKey: 'bpmn.end',
    kind: 'artefact',
    category: 'events',
    senior: true,
    element: 'node:endEvent',
    run: std => createBpmnNode(std, 'endEvent'),
  },
  {
    id: 'addTask',
    label: 'Task',
    iconKey: 'bpmn.task',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:task',
    run: std => createBpmnNode(std, 'task'),
  },
  {
    id: 'addExclusiveGateway',
    label: 'Exclusive gateway',
    iconKey: 'bpmn.gateway',
    kind: 'artefact',
    category: 'gateways',
    senior: true,
    element: 'node:gatewayExclusive',
    run: std => createBpmnNode(std, 'gatewayExclusive'),
  },
  {
    id: 'sequenceFlowTool',
    label: 'Sequence flow',
    iconKey: 'bpmn.sequence',
    kind: 'tool',
    category: 'flows',
    senior: true,
    element: 'connector:sequence',
    run: activateBpmnSequenceFlow,
  },
  {
    id: 'addPool',
    label: 'Pool',
    iconKey: 'bpmn.pool',
    kind: 'artefact',
    category: 'swimlanes',
    senior: true,
    element: 'pool',
    run: createBpmnPool,
  },
  {
    // Seventh, and the last of the cold start: the moment there are two
    // participants there is a message between them, and it is the one arrow a
    // sequence flow may never stand in for.
    id: 'messageFlowTool',
    label: 'Message flow',
    iconKey: 'bpmn.message',
    kind: 'tool',
    category: 'flows',
    senior: true,
    element: 'connector:message',
    run: activateBpmnMessageFlow,
  },
  /* ── Activities: the typed tasks and the two that stand for a process ─ */
  {
    id: 'addUserTask',
    label: 'User task',
    iconKey: 'bpmn.task.user',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:taskUser',
    run: std => createBpmnNode(std, 'taskUser'),
  },
  {
    id: 'addServiceTask',
    label: 'Service task',
    iconKey: 'bpmn.task.service',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:taskService',
    run: std => createBpmnNode(std, 'taskService'),
  },
  {
    id: 'addSubProcess',
    label: 'Sub-process',
    iconKey: 'bpmn.sub-process',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:subProcess',
    run: std => createBpmnNode(std, 'subProcess'),
  },
  {
    id: 'addCallActivity',
    label: 'Call activity',
    iconKey: 'bpmn.call-activity',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:callActivity',
    run: std => createBpmnNode(std, 'callActivity'),
  },
  /* ── The other gateway ──────────────────────────────────────────────── */
  {
    // `addParallelGateway`, matching the word order of the sibling that already
    // shipped (`addExclusiveGateway`) — a command id is a value a host override
    // table points at, and the pair reads as a pair in every list that sorts.
    id: 'addParallelGateway',
    label: 'Parallel gateway',
    iconKey: 'bpmn.gateway.parallel',
    kind: 'artefact',
    category: 'gateways',
    senior: true,
    element: 'node:gatewayParallel',
    run: std => createBpmnNode(std, 'gatewayParallel'),
  },
  /* ── Event variants: what TRIGGERS a start, what an end does on the way
       out. Refinements of the two plain events above, so they follow them. ─ */
  {
    id: 'addMessageStartEvent',
    label: 'Message start event',
    iconKey: 'bpmn.start.message',
    kind: 'artefact',
    category: 'events',
    senior: false,
    element: 'node:startEventMessage',
    run: std => createBpmnNode(std, 'startEventMessage'),
  },
  {
    id: 'addTimerStartEvent',
    label: 'Timer start event',
    iconKey: 'bpmn.start.timer',
    kind: 'artefact',
    category: 'events',
    senior: false,
    element: 'node:startEventTimer',
    run: std => createBpmnNode(std, 'startEventTimer'),
  },
  {
    id: 'addMessageEndEvent',
    label: 'Message end event',
    iconKey: 'bpmn.end.message',
    kind: 'artefact',
    category: 'events',
    senior: false,
    element: 'node:endEventMessage',
    run: std => createBpmnNode(std, 'endEventMessage'),
  },
  {
    id: 'addTerminateEndEvent',
    label: 'Terminate end event',
    iconKey: 'bpmn.end.terminate',
    kind: 'artefact',
    category: 'events',
    senior: false,
    element: 'node:endEventTerminate',
    run: std => createBpmnNode(std, 'endEventTerminate'),
  },
  /* ── The last connecting object ─────────────────────────────────────── */
  {
    id: 'associationTool',
    label: 'Association',
    iconKey: 'bpmn.association',
    kind: 'tool',
    category: 'flows',
    senior: false,
    element: 'connector:association',
    run: activateBpmnAssociation,
  },
  /* ── Data ───────────────────────────────────────────────────────────── */
  {
    id: 'addDataObject',
    label: 'Data object',
    iconKey: 'bpmn.data-object',
    kind: 'artefact',
    category: 'data',
    senior: true,
    element: 'node:dataObject',
    run: std => createBpmnNode(std, 'dataObject'),
  },
  {
    id: 'addDataStore',
    label: 'Data store',
    iconKey: 'bpmn.data-store',
    kind: 'artefact',
    category: 'data',
    senior: false,
    element: 'node:dataStore',
    run: std => createBpmnNode(std, 'dataStore'),
  },
  /* ── Artifacts: what an author writes ON the picture ────────────────── */
  {
    id: 'addTextAnnotation',
    label: 'Text annotation',
    iconKey: 'bpmn.text-annotation',
    kind: 'artefact',
    category: 'annotations',
    senior: true,
    element: 'node:textAnnotation',
    run: std => createBpmnNode(std, 'textAnnotation'),
  },
  {
    // Filed with the annotation and not in a section of its own: both are
    // things an author writes ON the picture rather than parts of the process,
    // and BPMN 2.0.2 §10.4 exempts both from every rule for the same reason.
    id: 'addGroup',
    label: 'Group',
    iconKey: 'bpmn.group',
    kind: 'artefact',
    category: 'annotations',
    // Out of the fourteen, and not because it is unimportant: a lasso is drawn
    // round a part of the process that is already there, so it is never the
    // first thing reached for on a blank board — which is precisely what the
    // senior row is a shortcut to.
    senior: false,
    element: 'node:group',
    run: std => createBpmnNode(std, 'group'),
  },
];

const toolboxCommands: CommandDescriptor[] = SPECS.map((spec, order) => ({
  id: `bpmn.${spec.id}`,
  owner: 'bpmn',
  kind: spec.kind,
  labelKey: `com.labre.commands.bpmn.${spec.id}`,
  labelFallback: spec.label,
  category: spec.category,
  iconKey: spec.iconKey,
  // The catalogue holds all of them; `senior` decides which fourteen the
  // sub-menu opens on before this user has reached for anything.
  surfaces: spec.senior
    ? ['senior-menu', 'catalogue', 'palette', 'agent']
    : ['catalogue', 'palette', 'agent'],
  order,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'always',
  run: spec.run,
  telemetry: { framework: 'bpmn', element: spec.element },
}));

/**
 * The LANE commands (B4) — the first BPMN entries that are not a toolbox slot.
 *
 * A lane is a subdivision of a pool that already exists, so there is nothing to
 * pick up off a palette and drop: these act on a SELECTION. That is why they
 * decline `'senior-menu'` — a permanently greyed entry in the sub-menu of a
 * framework you have not drawn anything with yet is furniture, not an
 * affordance. They keep `'catalogue'`, which every framework command carries,
 * so a host catalogue and Settings › Shortcuts still list them, and they join
 * `'contextual-toolbar'`, whose entry is declared by the pool's own
 * `ToolbarModuleConfig` and INVOKES these — one behaviour, one availability
 * rule, one telemetry emission (`docs/adr/0008`, `docs/adr/0010` M3).
 */
const LANE_COMMON = {
  owner: 'bpmn',
  kind: 'action',
  // The same section as the pool they divide: the catalogue reads "here is the
  // frame, and here is what you do to it" in one place, which is where a reader
  // looking for lanes actually looks.
  category: 'swimlanes',
  surfaces: ['catalogue', 'contextual-toolbar', 'palette', 'agent'],
  scope: 'edgeless',
  // Keyless by intent — still bindable from Settings › Shortcuts, which is what
  // `toShortcutDescriptor` being total buys.
  defaultKeys: { mac: [], other: [] },
  availability: 'selection',
} satisfies Partial<CommandDescriptor>;

const laneCommands: CommandDescriptor[] = [
  {
    ...LANE_COMMON,
    id: 'bpmn.addLane',
    labelKey: 'com.labre.commands.bpmn.addLane',
    labelFallback: 'Add lane',
    descriptionKey: 'com.labre.commands.bpmn.addLane.description',
    descriptionFallback:
      'Divide the selected pool into lanes; the new one takes an equal share.',
    iconKey: 'bpmn.lane-add',
    // Ranked after every toolbox entry, so the catalogue reads "here is what
    // BPMN draws" before "here is what you do to it". They still land in the
    // `swimlanes` section beside the pool — a section is where a command is
    // FILED, and `order` only decides where it sits inside it.
    order: SPECS.length,
    run: addBpmnLane,
    telemetry: { framework: 'bpmn', element: 'pool:lane-add' },
    // Narrows `'selection'`, never contradicts it: a selection holding no
    // unlocked pool has nothing to divide. Read-only rides in
    // `bpmnPoolsForLaneEdit` for the reason the union documents — it holds ONE
    // value, and `'selection'` is the precondition a catalogue has to show.
    when: std => bpmnPoolsForLaneEdit(std).length > 0,
  },
  {
    ...LANE_COMMON,
    id: 'bpmn.removeLane',
    labelKey: 'com.labre.commands.bpmn.removeLane',
    labelFallback: 'Remove lane',
    descriptionKey: 'com.labre.commands.bpmn.removeLane.description',
    descriptionFallback:
      'Remove the last lane of the selected pool. Nothing drawn in it moves.',
    iconKey: 'bpmn.lane-remove',
    order: SPECS.length + 1,
    run: removeBpmnLane,
    telemetry: { framework: 'bpmn', element: 'pool:lane-remove' },
    // …and additionally: a pool with no lane has none to remove.
    when: std =>
      bpmnPoolsForLaneEdit(std).some(model => bpmnLanesOf(model).length > 0),
  },
];

/**
 * The EXPORT — the first BPMN command whose subject is the whole board.
 *
 * ## Why it hangs off the pool's toolbar and still exports everything
 *
 * A pool is the only thing on the canvas that is unambiguously "this drawing is
 * a BPMN process", so it is where a reader looks for what to do with one. What
 * it is NOT is the scope: a BPMN document is a process, half a process is not a
 * smaller process, and a file holding one participant of a two-participant
 * collaboration would be a picture of a conversation with one side deleted. The
 * selected pool decides the FILENAME and nothing else — see
 * {@link exportBpmnXmlFile}.
 *
 * ## Surfaces
 *
 * It declines `'senior-menu'` for the same reason the lane gestures do: the
 * sub-menu is what you reach for to DRAW something, and this draws nothing. It
 * keeps `'catalogue'`, which is not a category claim but the registry's own
 * invariant — the catalogue is the TOTAL surface, and a command missing from it
 * is unreachable the moment its framework overflows the fourteen slots (pinned
 * by `registry.unit.spec.ts`). On the row itself it sits in the "⋮" menu rather
 * than as a button: it is the rarest thing anybody does to a pool, and the row
 * is already three entries wide.
 */
const exportCommand: CommandDescriptor = {
  id: 'bpmn.exportXml',
  owner: 'bpmn',
  kind: 'action',
  labelKey: 'com.labre.commands.bpmn.exportXml',
  labelFallback: 'Export BPMN XML',
  descriptionKey: 'com.labre.commands.bpmn.exportXml.description',
  descriptionFallback:
    'Download the whole board as a BPMN 2.0 XML file, ready to open in any BPMN tool.',
  // Filed with the import it is the other half of — see {@link INTERCHANGE}.
  // It shipped filed under `swimlanes`, because the pool's "⋮" is where it is
  // REACHED from and there was no better section for a command with no sibling;
  // a category is where a command is FILED, and it has one now.
  category: 'interchange',
  iconKey: 'bpmn.export-xml',
  surfaces: ['catalogue', 'contextual-toolbar', 'palette', 'agent'],
  order: SPECS.length + 2,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'selection',
  run: exportBpmnXmlFile,
  telemetry: { framework: 'bpmn', element: 'pool:export-xml' },
  // A pool in the selection, and no more than that: an export READS, so unlike
  // the lane gestures it is offered on a locked pool and on a read-only
  // document — which is precisely the board somebody wants to take away.
  when: std => bpmnPoolsSelected(std).length > 0,
};

/**
 * The IMPORT — the other direction of the same format, and the first BPMN
 * command that needs nothing on the board at all.
 *
 * ## `interchange`, and why the export moved into it
 *
 * These two are one subject: this board as a `.bpmn` file, out and in. The
 * export was filed under `swimlanes` because that is the toolbar it is reached
 * from and because a section of one is not a section; a category is where a
 * command is FILED and not where it is reached from, and filing the pair apart
 * would make the catalogue say that taking a process away and bringing one back
 * are different kinds of thing. `order` is untouched, so nothing MOVES inside a
 * section — the position law of `docs/adr/0008` is about rank, and this is
 * membership.
 *
 * ## Surfaces: four, and the one it declines
 *
 * `'senior-menu'` since the PO decision of 2026-08-28, which REVERSES the
 * ruling this comment used to carry ("the sub-menu is a row of things you DRAW,
 * and this draws nothing you chose"). The distinction survives for the EXPORT,
 * which is still catalogue-and-toolbar only: an export is what you do to a
 * board you already have, and it is reached from the pool it is about. An
 * import is where a board COMES FROM. On an empty canvas the sub-menu is the
 * first thing a user opens, and "start from a file somebody sent me" belongs in
 * that row beside "start from a start event" — asking them to find the
 * catalogue sidepanel first was the friction the decision names.
 *
 * The row itself is not at risk: BPMN's catalogue has outgrown the cap since
 * #157, so `selectSeniorMenuCommands` already ranks the nomination list down to
 * thirteen buttons plus "More artefacts…", and this entry takes a slot only
 * when the user actually reaches for it. It is the fifteenth nomination, and
 * nothing about the arbitration changes.
 *
 * No `'contextual-toolbar'`, and that is the difference from the export — a
 * contextual toolbar is a statement about a SELECTION, and the moment this
 * command is most wanted is on an empty board with nothing selected at all. It
 * keeps `'catalogue'` (the registry's total surface — a command missing from it
 * is unreachable), `'palette'` and `'agent'`.
 *
 * ## `'editable'`, which is the first use of it in the repo
 *
 * An import needs no selection — but it WRITES, so a read-only document is a
 * document it cannot run on, and that is a precondition a catalogue has to be
 * able to show. `'editable'` is exactly that value and it has been in the union
 * since `docs/adr/0008` (`Availability`, `command-registry.ts`); nothing had
 * reached for it before. `'always'` would light the entry on a read-only
 * document, do nothing when clicked, and put the same untruth into the
 * serializable manifest a host reads — which is the one thing `availability`
 * exists to prevent.
 *
 * The guard inside {@link importBpmnXmlFile} stays: a declaration is what a
 * surface renders from, and the action is what actually touches the store.
 *
 * The mirror image of the export, which READS and is therefore `'selection'` on
 * a pool and offered on a read-only document precisely because that is the
 * board somebody wants to take away.
 */
const importCommand: CommandDescriptor = {
  id: 'bpmn.importXml',
  owner: 'bpmn',
  kind: 'action',
  labelKey: 'com.labre.commands.bpmn.importXml',
  labelFallback: 'Import BPMN XML',
  descriptionKey: 'com.labre.commands.bpmn.importXml.description',
  descriptionFallback:
    'Open a BPMN 2.0 XML file as a board. What Labre cannot draw is kept in the document, and the import says what it was.',
  category: 'interchange',
  iconKey: 'bpmn.import-xml',
  surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
  order: SPECS.length + 3,
  scope: 'edgeless',
  // Keyless by intent, like every other BPMN entry: past fourteen a framework
  // binds by host override rather than by shipping a default chord. Still
  // bindable from Settings › Shortcuts, which is what `toShortcutDescriptor`
  // being total buys.
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  run: importBpmnXmlFile,
  // `board:` and not `pool:`: the export names the pool whose toolbar launched
  // it, and this one is launched with no pool anywhere.
  telemetry: { framework: 'bpmn', element: 'board:import-xml' },
};

/**
 * The SVG FALLBACK import — the visual tier, named as such before the picker
 * opens.
 *
 * ## Why it is not in the senior sub-menu, and that is an arbitration
 *
 * `bpmn.importXml` took the fifteenth nomination on the PO's ruling of
 * 2026-08-28, and that ruling was about where a BPMN board comes FROM: a file
 * somebody sent you, in the format the framework speaks. This is the other
 * kind of file — a picture of a process, from a tool that does not export
 * `.bpmn` at all — and it lands one click away, in the artefact catalogue
 * behind "More artefacts…", rather than taking a sixteenth slot in a row that
 * seats fourteen. The registry spec's budget assertion allows exactly ONE
 * over-nomination per owner and BPMN has spent it; this entry deliberately does
 * not contest it.
 *
 * **Flagged for the PO**: if the fallback turns out to be what people actually
 * reach for — a `.svg` is what most drawing tools export — this is a one-line
 * change (`surfaces` gains `'senior-menu'`), and it is a curation decision
 * rather than a merge.
 *
 * ## The label says the tier, because P2 requires it BEFORE the file is read
 *
 * "Import SVG sketch", and a description that spends its whole sentence on what
 * this is not: best effort, shapes and text, no round-trip. ADR 0012 is blunt
 * about the cost of getting this wrong — "a single 'Import…' entry that hides
 * the difference would earn a support ticket per user" — and the surface is the
 * only place the difference can be stated, because the report comes AFTER the
 * decision to open the file.
 */
const importSvgCommand: CommandDescriptor = {
  id: 'bpmn.importSvg',
  owner: 'bpmn',
  kind: 'action',
  labelKey: 'com.labre.commands.bpmn.importSvg',
  labelFallback: 'Import SVG sketch',
  descriptionKey: 'com.labre.commands.bpmn.importSvg.description',
  descriptionFallback:
    'Best effort: recognizes shapes and text, no round-trip. What arrives is a sketch you then promote into BPMN artefacts.',
  // Filed with the two `.bpmn` directions: the subject is the same one — this
  // board, and a file it came from or goes to.
  category: 'interchange',
  iconKey: 'bpmn.import-svg',
  surfaces: ['catalogue', 'palette', 'agent'],
  order: SPECS.length + 4,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  // It WRITES, so a read-only document is one it cannot run on — the same
  // reasoning as `bpmn.importXml`, and the value the catalogue renders from.
  availability: 'editable',
  run: importBpmnSvgFile,
  telemetry: { framework: 'bpmn', element: 'board:import-svg' },
};

export const bpmnCommands: CommandDescriptor[] = [
  ...toolboxCommands,
  ...laneCommands,
  exportCommand,
  importCommand,
  importSvgCommand,
];

export const bpmnCommandIcons: Record<string, TemplateResult> = {
  'bpmn.start': bpmnStartIcon,
  'bpmn.start.message': bpmnStartMessageIcon,
  'bpmn.start.timer': bpmnStartTimerIcon,
  'bpmn.end': bpmnEndIcon,
  'bpmn.end.message': bpmnEndMessageIcon,
  'bpmn.end.terminate': bpmnEndTerminateIcon,
  'bpmn.task': bpmnTaskIcon,
  'bpmn.task.user': bpmnTaskUserIcon,
  'bpmn.task.service': bpmnTaskServiceIcon,
  'bpmn.sub-process': bpmnSubProcessIcon,
  'bpmn.call-activity': bpmnCallActivityIcon,
  'bpmn.gateway': bpmnGatewayIcon,
  'bpmn.gateway.parallel': bpmnGatewayParallelIcon,
  'bpmn.sequence': bpmnSequenceIcon,
  'bpmn.message': bpmnMessageIcon,
  'bpmn.association': bpmnAssociationIcon,
  'bpmn.data-object': bpmnDataObjectIcon,
  'bpmn.data-store': bpmnDataStoreIcon,
  'bpmn.text-annotation': bpmnTextAnnotationIcon,
  'bpmn.group': bpmnGroupIcon,
  'bpmn.pool': bpmnPoolIcon,
  'bpmn.lane-add': bpmnLaneAddIcon,
  'bpmn.lane-remove': bpmnLaneRemoveIcon,
  'bpmn.export-xml': bpmnExportXmlIcon,
  'bpmn.import-xml': bpmnImportXmlIcon,
  'bpmn.import-svg': bpmnImportSvgIcon,
};
