import {
  DefaultTool,
  EdgelessCRUDIdentifier,
  generateElementId,
  type InterchangeImportResult,
  type InterchangeNote,
  type InterchangeReport,
  type SerializedElementProps,
} from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import {
  type BpmnLane,
  type BpmnNodeKind,
  BpmnPoolElementModel,
  ConnectorElementModel,
  ConnectorMode,
  PointStyle,
  StrokeStyle,
} from '@labre/affine-model';
import {
  EditPropsStore,
  NotificationProvider,
  translateKey,
} from '@labre/affine-shared/services';
import { downloadBlob, openSingleFileWith } from '@labre/affine-shared/utils';
import { Bound, getCommonBound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { type GfxController, GfxControllerIdentifier } from '@labre/std/gfx';

import {
  ASSOCIATION_STROKE,
  ASSOCIATION_WIDTH,
  MESSAGE_STROKE,
  MESSAGE_WIDTH,
  NODE_LABEL,
  NODE_SIZE,
  SEQUENCE_STROKE,
  SEQUENCE_WIDTH,
} from './consts';
import { BPMN_FORMAT_ID, type BpmnExportBoard } from './export.js';
import {
  BPMN_XML_EXPORT,
  BPMN_XML_IMPORT,
  bpmnBoardFrom,
  bpmnSafeFilename,
} from './interchange.js';
import { bpmnNodeProps } from './presets.js';
import { BPMN_ROLE } from './roles';

/**
 * Standalone creation/activation actions for the BPMN toolbox — lifted out of
 * `toolbar/bpmn-menu.ts` by PF3 so the menu becomes a pure renderer over the
 * command registry. Telemetry is emitted once, by `runCommand`.
 */

const gfxOf = (std: BlockStdScope) => std.get(GfxControllerIdentifier);

function finish(gfx: GfxController, id: string) {
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
  // Keep the palette open (native sub-menu behaviour).
}

/** Create a flow-object node (native shape) centred on the viewport. */
export function createBpmnNode(std: BlockStdScope, kind: BpmnNodeKind) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { w, h } = NODE_SIZE[kind];
  const { centerX: cx, centerY: cy } = gfx.viewport;

  // What a node IS lives in one place (`./presets.ts`), because the importer
  // creates the same artefacts out of a `.bpmn` file and the two must not
  // drift: a task read from a file and a task drawn here are one element type
  // in the document, down to the stroke width. The gesture owns the BOX and
  // nothing else.
  const id = surface.addElement(
    bpmnNodeProps(kind, {
      xywh: new Bound(cx - w / 2, cy - h / 2, w, h).serialize(),
      text: NODE_LABEL[kind] || undefined,
    })
  );
  finish(gfx, id);
}

/** Create a pool (background container) centred on the viewport. */
export function createBpmnPool(std: BlockStdScope) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const w = 560;
  const h = 200;
  const { centerX: cx, centerY: cy } = gfx.viewport;
  const id = surface.addElement({
    type: 'bpmnPool',
    // The FRAME the flow objects are drawn in, and a role of its own: a rule
    // written on the artefacts must never fall on the lane that holds them.
    role: BPMN_ROLE.pool,
    xywh: new Bound(cx - w / 2, cy - h / 2, w, h).serialize(),
  });
  finish(gfx, id);
}

/**
 * Arm the native connector tool, pre-styled for a BPMN sequence flow:
 * orthogonal, solid, with a filled triangle head. The user then draws from
 * one node to another (endpoints attach to centers).
 */
export function activateBpmnSequenceFlow(std: BlockStdScope) {
  std.get(EditPropsStore).recordLastProps('connector', {
    mode: ConnectorMode.Orthogonal,
    stroke: SEQUENCE_STROKE,
    strokeStyle: StrokeStyle.Solid,
    strokeWidth: SEQUENCE_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Triangle,
  });
  gfxOf(std).tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Orthogonal,
    // A TYPED edge (`docs/adr/0010`): the arrow the user is about to draw says
    // "is followed by", so its source is what happens first. The tool carries
    // the role so the connector is born with it rather than acquiring one
    // afterwards.
    role: BPMN_ROLE.sequenceFlow,
  });
  // Keep the palette open (native sub-menu behaviour).
}

/**
 * Arm the native connector tool, pre-styled for a BPMN message flow:
 * orthogonal, DASHED, an open circle where the message leaves and an open
 * arrowhead where it lands.
 *
 * ## The two endpoint styles, and why these two
 *
 * The spec's message flow starts on a small hollow circle and ends on a hollow
 * (line-drawn) arrowhead — never the solid triangle the sequence flow uses,
 * which is the whole visual difference between "then this happens" and "and
 * this is what I told them". `PointStyle` offers `Circle` and `Arrow`, and they
 * are exactly those two shapes: `Arrow` is drawn as an unfilled V
 * (`renderRoundedPolygon(…, false)`), against `Triangle`'s filled one. The only
 * deviation is that `Circle` is painted with the connector's `fillColor` rather
 * than left transparent — the shape, the size and the position are the spec's.
 */
export function activateBpmnMessageFlow(std: BlockStdScope) {
  std.get(EditPropsStore).recordLastProps('connector', {
    mode: ConnectorMode.Orthogonal,
    stroke: MESSAGE_STROKE,
    strokeStyle: StrokeStyle.Dash,
    strokeWidth: MESSAGE_WIDTH,
    frontEndpointStyle: PointStyle.Circle,
    rearEndpointStyle: PointStyle.Arrow,
  });
  gfxOf(std).tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Orthogonal,
    // A TYPED edge (`docs/adr/0010`), and the role its vocabulary already
    // declared with the verb "sends a message to": the source is the
    // participant that sends, the target the one that receives.
    role: BPMN_ROLE.messageFlow,
  });
  // Keep the palette open (native sub-menu behaviour).
}

/**
 * Arm the native connector tool, pre-styled for a BPMN association: dashed, and
 * with NO endpoint marker at either end.
 *
 * The missing arrowheads are the point, not an omission. An association names
 * no relation — `bpmn:association` is the one edge role in this vocabulary
 * declared without a `direction` block — so "this note is about that task"
 * reads identically from either end, and an arrowhead would be the picture
 * claiming a direction the role explicitly refuses to have. See the role's own
 * doc comment in `./roles.ts`.
 *
 * On the dash (there is no dotted stroke to ask for) see
 * {@link ASSOCIATION_STROKE}'s neighbours in `./consts.ts`.
 */
export function activateBpmnAssociation(std: BlockStdScope) {
  std.get(EditPropsStore).recordLastProps('connector', {
    mode: ConnectorMode.Orthogonal,
    stroke: ASSOCIATION_STROKE,
    strokeStyle: StrokeStyle.Dash,
    strokeWidth: ASSOCIATION_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.None,
  });
  gfxOf(std).tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Orthogonal,
    role: BPMN_ROLE.association,
  });
  // Keep the palette open (native sub-menu behaviour).
}

/* ── Lanes (couloirs) ─────────────────────────────────────────────────── */

/**
 * The lanes a pool carries, as an array that is safe to read.
 *
 * The value comes out of a Y.Map, so it is whatever a peer wrote: a client that
 * got it wrong must not break the gesture on this one. Same defensive read the
 * validation engine does on `validationExceptions`, for the same reason.
 */
export function bpmnLanesOf(model: BpmnPoolElementModel): readonly BpmnLane[] {
  const stored = model.lanes;
  return Array.isArray(stored) ? stored : [];
}

/**
 * The pools a lane gesture acts on: every pool of the current selection that is
 * not locked.
 *
 * EVERY one, not the single one — `some`, not `every`, in the same spirit as
 * the typed-edge inversion (`docs/adr/0010` M3): lassoing two pools used to be
 * a way to lose an affordance, and a gesture that says what it did on each of
 * them beats an entry that vanishes. With one pool selected — the ordinary
 * case, and the only one the toolbar offers — it is exactly "the selected pool".
 */
export function bpmnPoolsForLaneEdit(
  std: BlockStdScope
): BpmnPoolElementModel[] {
  if (std.store.readonly) return [];
  return gfxOf(std)
    .selection.selectedElements.filter(
      (model): model is BpmnPoolElementModel =>
        model instanceof BpmnPoolElementModel
    )
    .filter(model => !model.isLocked());
}

/**
 * Write a pool's lane list back, or REMOVE the prop when there is none left.
 *
 * The second half is what keeps the "nothing is written until the first lane"
 * promise reversible: assigning `undefined` through the accessor would leave
 * the key in the Y.Map holding an undefined value — invisible through the
 * getter, but synced to every peer and shipped in every snapshot. A pool whose
 * last lane is removed goes back to its pre-lane bytes.
 */
function writeLanes(
  std: BlockStdScope,
  model: BpmnPoolElementModel,
  lanes: readonly BpmnLane[]
): void {
  if (lanes.length === 0) {
    model.clearField('lanes');
    return;
  }
  std.get(EdgelessCRUDIdentifier).updateElement(model.id, {
    lanes: [...lanes],
  });
}

/**
 * Append a lane to every selected pool.
 *
 * ## One lane, not two
 *
 * Adding the FIRST lane creates ONE lane, covering the whole pool. Seeding two
 * would invent a subdivision the user did not ask for and then make them delete
 * half of it. One lane is the honest reading of "add a lane": the pool now has
 * a lane, it happens to be all of it, and the second click gives them the
 * second one.
 *
 * Since the lane title band (PO recette, 2026-08-26) that first click is also
 * VISIBLE: a named strip appears down the leading edge of a pool that had none.
 * Before it, a single lane was indistinguishable from no lane at all, and the
 * gesture looked broken until the second click.
 *
 * ## `Lane N` is DOCUMENT DATA, not vocabulary
 *
 * The default name is a plain persisted string, exactly like the pool's own
 * `'Pool'` default: it is written into the document by this action and is the
 * user's to rewrite from that moment on. It is deliberately NOT a `labelKey`
 * through the translation seam — a host that ships a French catalogue must not
 * silently retitle a lane an author named, and a name that changed language
 * when the reader's locale did would be a document that says different things
 * to different people. `N` is the count AFTER this lane, so the first is
 * `Lane 1`.
 */
export function addBpmnLane(std: BlockStdScope): void {
  const pools = bpmnPoolsForLaneEdit(std);
  if (pools.length === 0) return;

  // Before the writes: `Store.transact` is not an undo boundary, and one
  // capture for the whole gesture is what makes several pools take their lane
  // in a single undo step.
  std.store.captureSync();

  for (const model of pools) {
    const lanes = bpmnLanesOf(model);
    // The new lane takes an equal share: the average of what is already there
    // is the weight that leaves every existing lane the same size relative to
    // its neighbours, and gives the newcomer the room a typical one has. `1`
    // for the first, where there is no average and the unit is arbitrary.
    const size = lanes.length
      ? lanes.reduce((sum, lane) => sum + lane.size, 0) / lanes.length
      : 1;
    writeLanes(std, model, [
      ...lanes,
      { id: generateElementId(), name: `Lane ${lanes.length + 1}`, size },
    ]);
  }
}

/**
 * Remove the LAST lane of every selected pool.
 *
 * The last one and not the selected one, because a lane is not selectable: it
 * is a slice of the pool's plot, painted by the background primitive, with no
 * element of its own. Removing from the end is the gesture that undoes the one
 * that added it.
 *
 * ## Nothing moves
 *
 * Elements sitting in the removed lane do NOT move. Containment here is
 * geometric — a task is "in" a lane because its centre falls in that rectangle,
 * which is how the audit reports it — so the lane below simply grows over them
 * and they are in that one now. Nothing on the canvas jumps under the user's
 * hand, and the sequence flow they drew still lands where they drew it.
 */
export function removeBpmnLane(std: BlockStdScope): void {
  const pools = bpmnPoolsForLaneEdit(std);
  if (pools.length === 0) return;

  const withLanes = pools.filter(model => bpmnLanesOf(model).length > 0);
  if (withLanes.length === 0) return;

  std.store.captureSync();
  for (const model of withLanes) {
    writeLanes(std, model, bpmnLanesOf(model).slice(0, -1));
  }
}

/* ── Export (BPMN 2.0 XML) ────────────────────────────────────────────── */

/**
 * The pools of the current selection, WITHOUT the two filters a lane gesture
 * applies.
 *
 * `bpmnPoolsForLaneEdit` refuses a read-only document and a locked pool because
 * it is about to write to them. An export writes nothing: it reads the board
 * and hands the reader a file. A process published read-only, or a pool an
 * author locked precisely because it is finished, is exactly the board somebody
 * wants to take to bpmn.io — refusing it there would be a filter copied for the
 * shape of it rather than for the reason.
 */
export function bpmnPoolsSelected(std: BlockStdScope): BpmnPoolElementModel[] {
  return gfxOf(std).selection.selectedElements.filter(
    (model): model is BpmnPoolElementModel =>
      model instanceof BpmnPoolElementModel
  );
}

/**
 * Everything on the surface the exporter speaks about, in document order.
 *
 * The half that needs an editor, and only that half: reading the surface. The
 * picking is {@link bpmnBoardFrom}, which the interchange capability calls with
 * the same elements and no `std` at all (`docs/adr/0012`, P3).
 */
export function bpmnBoardOf(std: BlockStdScope): BpmnExportBoard {
  return bpmnBoardFrom(gfxOf(std).surface?.elementModels ?? []);
}

/**
 * What the downloaded file is called, minus the extension.
 *
 * The document's own title first — a board is what the file is OF — then the
 * name of the pool whose toolbar launched the export, then a last resort. Which
 * of the three it is, is the only thing this function decides; making the
 * answer safe to write to disk is {@link bpmnSafeFilename}, so the command and
 * the interchange capability cannot name the same board differently.
 */
export function bpmnExportFilename(std: BlockStdScope): string {
  const title = std.store.workspace.meta.getDocMeta(std.store.id)?.title;
  const pool = bpmnPoolsSelected(std)[0]?.name;
  return bpmnSafeFilename(title || pool);
}

/**
 * Serialize the whole board as BPMN 2.0 XML and hand it to the browser.
 *
 * Three steps, and only the first and the last know what an editor is: read the
 * surface, run the DECLARED capability (`docs/adr/0012`), download what it
 * produced. The middle step is not re-implemented here — the document, the
 * filename and the content type all come out of `BPMN_XML_EXPORT.run`, so the
 * command and the registry cannot describe the same board differently. There is
 * one door; the registry is the label on it.
 *
 * A plain import rather than a DI lookup: the capability is a pure function and
 * a value, resolving it through the container would buy nothing here, and P3 is
 * explicit that the registry is the editor's view of these functions, not a
 * gate in front of them.
 */
export function exportBpmnXmlFile(std: BlockStdScope): void {
  const elements = gfxOf(std).surface?.elementModels ?? [];
  const { text, filename, mime, warnings } = BPMN_XML_EXPORT.run(elements, {
    name: bpmnExportFilename(std),
  });
  // The charset is the browser's business, not the format's: `mime` is what
  // `.bpmn` IS, and this is how a blob is told to carry it.
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);

  // The `warnings` channel, spent. The writer has been populating it since
  // #149 and the command dropped it on the floor — a #159 review nit, and the
  // one thing that made "an export loses things too, and the user who clicked
  // Export is the one person entitled to be told" false in the only place a
  // user stands. A warning is never an error: the file downloaded, and it is
  // valid; what it could not say is what this names.
  if (!warnings || warnings.length === 0) return;
  notifyBpmn(std, {
    title: translateKey(std, EXPORT_WARNINGS_KEY, EXPORT_WARNINGS_FALLBACK),
    message: warnings.join('\n'),
    accent: 'warning',
  });
}

/* ── Import (BPMN 2.0 XML) ────────────────────────────────────────────── */

const EXPORT_WARNINGS_KEY = 'com.labre.commands.bpmn.exportXml.warnings';
const EXPORT_WARNINGS_FALLBACK = 'What this export could not write down';
const IMPORT_DONE_KEY = 'com.labre.commands.bpmn.importXml.done';
const IMPORT_DONE_FALLBACK = 'BPMN file imported';
const IMPORT_FAILED_KEY = 'com.labre.commands.bpmn.importXml.failed';
const IMPORT_FAILED_FALLBACK = 'This file could not be imported';
const IMPORT_REMARKS_KEY = 'com.labre.commands.bpmn.importXml.remarks';
const IMPORT_REMARKS_FALLBACK = 'What the import could not keep as it was';
const IMPORT_CONSOLE_KEY = 'com.labre.commands.bpmn.importXml.console';
const IMPORT_CONSOLE_FALLBACK =
  'remarks — the full report is in the browser console.';
const IMPORT_DRAWN_KEY = 'com.labre.commands.bpmn.importXml.drawn';
const IMPORT_DRAWN_FALLBACK = 'drawn';
const IMPORT_CARRIED_KEY = 'com.labre.commands.bpmn.importXml.carried';
const IMPORT_CARRIED_FALLBACK = 'carried';
const IMPORT_QUARANTINED_KEY = 'com.labre.commands.bpmn.importXml.quarantined';
const IMPORT_QUARANTINED_FALLBACK = 'quarantined';

/**
 * How many remarks the second notification spells out before it hands the
 * reader to the console.
 *
 * A toast is a headline surface: past five lines it stops being read and starts
 * being dismissed, and a report nobody reads is a report that was not written.
 * See {@link reportBpmnImport} for what the number is a compromise about.
 */
const REMARKS_IN_A_NOTIFICATION = 5;

/**
 * The notification seam, or silence.
 *
 * `getOptional`, like every other call site in the library: the host injects a
 * `NotificationService` (labreapp does, the standalone playground does not), and
 * a framework that assumed one would be a framework the playground cannot run.
 * Nothing here decides that an import failed to happen because nobody was
 * listening — the elements are on the surface either way.
 */
function notifyBpmn(
  std: BlockStdScope,
  options: {
    title: string;
    message: string;
    accent: 'info' | 'warning' | 'error';
  }
): void {
  std.getOptional(NotificationProvider)?.notify({
    title: options.title,
    message: options.message,
    accent: options.accent,
    // Long enough to read a paragraph of remarks, and still self-dismissing:
    // an import report is not a modal, and a toast the user has to close is a
    // toast that interrupts the next thing they were doing.
    duration: 8000,
  });
}

/**
 * Write an imported board onto the surface, and give back the ids it minted.
 *
 * ## The one thing the caller of an importer owes (`docs/adr/0012`, D3)
 *
 * `surface.addElement` mints its own nanoid and ignores any id it is handed —
 * surface identity is Labre's and never the file's — so a connector arrives
 * with `source` / `target` naming the SOURCE FILE's ids. Every element carries
 * its own source id in `interchange.bpmn.id`, so the map from file id to
 * surface id is a fold over the very array the reader returned; the second pass
 * rewrites the two endpoints from it. Nothing else is needed, and nothing else
 * is done: an end the map cannot resolve is left exactly as the file wrote it.
 * That keeps the DOCUMENT honest, not the drawing — a connector naming an id no
 * element has routes to an empty path and is invisible on the canvas (it does
 * not crash; `connector-manager.ts` handles the missing connectable) — and an
 * unresolvable name a reader can go and look up in the source file beats one
 * this function quietly invented. It is defence in depth rather than a live
 * case: the reader CARRIES a flow whose end it did not draw instead of emitting
 * it (D1), so nothing it returns reaches this fallback.
 *
 * ## Why this is a function and not the body of the command
 *
 * It is the body of the command. It is also, in substance, what
 * `integration-test`'s BPMN round trip has been proving since #160 — the spec
 * wrote it out longhand precisely because there was no command to call. There
 * is one now, and the spec calls THIS, so the thing that is proven in chromium
 * and the thing a user reaches from the catalogue cannot be two different
 * pieces of code.
 *
 * The `interchange` payload needs no second pass: it rides in the props as one
 * whole blob and `addElement` writes it with everything else, which is the
 * whole-record LWW the field's own contract asks for (D2).
 */
export function materializeBpmnImport(
  std: BlockStdScope,
  elements: readonly SerializedElementProps[]
): string[] {
  const surface = gfxOf(std).surface;
  if (!surface) return [];

  const bySource = new Map<string, string>();
  const created = elements.map(props => {
    const id = surface.addElement({ ...props });
    const carried = props.interchange as
      | Record<string, { id?: string }>
      | undefined;
    const source = carried?.[BPMN_FORMAT_ID]?.id;
    // FIRST wins, matching the reader's own answer to a file that used one id
    // twice: it imports both and says so in a `substituted-id` note, and a flow
    // naming that id means the first of them.
    if (source !== undefined && !bySource.has(source)) bySource.set(source, id);
    return id;
  });

  for (const id of created) {
    const model = surface.getElementById(id);
    if (!(model instanceof ConnectorElementModel)) continue;
    for (const side of ['source', 'target'] as const) {
      const end = model[side];
      if (end?.id === undefined) continue;
      model[side] = { ...end, id: bySource.get(end.id) ?? end.id };
    }
  }
  return created;
}

/** One remark, as the line a reader sees. */
function remarkLine(note: InterchangeNote): string {
  const subject = note.sourceId ?? note.element;
  return subject ? `${subject}: ${note.message}` : note.message;
}

/**
 * Say what the import did — the summary, and the remarks.
 *
 * ## v1 of ADR 0012's open question 4 ("where does the report live?")
 *
 * The architect's v1: a NOTIFICATION for the summary, and the full notes on a
 * surface that is reachable and honest. Reachable rules out a toast that names
 * a count and drops the list; honest rules out the two things that look easier
 * — writing the notes into the document as a text annotation (which pollutes a
 * board the user did not ask us to draw on, and which the next export would
 * have to explain) and dropping them (the notes are not derivable by re-running
 * anything: the file is gone the moment the picker closes).
 *
 * So: one notification with the counts and the format version, a second with
 * the remarks when there are few enough to read, and `console.table` with all
 * of them, always, whenever there is one. The console is a poor product
 * surface and it is named as one — the deliberate TARGET is the conformity
 * panel, which is where a reader already goes to ask what is wrong with this
 * board, and where an import remark belongs beside a validation finding. This
 * is a stopgap that tells the truth, not the destination.
 */
export function reportBpmnImport(
  std: BlockStdScope,
  report: InterchangeReport
): void {
  const counts = [
    `${report.mapped} ${translateKey(std, IMPORT_DRAWN_KEY, IMPORT_DRAWN_FALLBACK)}`,
    `${report.carried} ${translateKey(std, IMPORT_CARRIED_KEY, IMPORT_CARRIED_FALLBACK)}`,
    `${report.quarantined} ${translateKey(std, IMPORT_QUARANTINED_KEY, IMPORT_QUARANTINED_FALLBACK)}`,
  ].join(' · ');
  // The version the reader actually READ, which is a fact about the file and
  // not about this library — an `exporter` attribute is how a support thread
  // about "bpmn.io drew it differently" gets answered in one line.
  const version = report.sourceVersion;

  notifyBpmn(std, {
    title: translateKey(std, IMPORT_DONE_KEY, IMPORT_DONE_FALLBACK),
    message: version ? `${counts} — BPMN ${version}` : counts,
    accent: 'info',
  });

  const notes = report.notes;
  if (notes.length === 0) return;

  // Always, and before the second toast: the console line is the one that is
  // still there in ten minutes, and the only place the WHOLE list lands when
  // there are forty of them.
  console.info(
    `[bpmn] import report — ${counts}${version ? ` — BPMN ${version}` : ''}`
  );
  console.table(
    notes.map(note => ({
      kind: note.kind,
      source: note.sourceId ?? '',
      element: note.element ?? '',
      message: note.message,
    }))
  );

  notifyBpmn(std, {
    title: translateKey(std, IMPORT_REMARKS_KEY, IMPORT_REMARKS_FALLBACK),
    message:
      notes.length <= REMARKS_IN_A_NOTIFICATION
        ? notes.map(remarkLine).join('\n')
        : `${notes.length} ${translateKey(std, IMPORT_CONSOLE_KEY, IMPORT_CONSOLE_FALLBACK)}`,
    // Not `error`, and not `info`: nothing failed — every one of these is
    // something the document KEPT — but each one is a difference between the
    // file the user handed over and the board they are looking at.
    accent: 'warning',
  });
}

/**
 * Read a `.bpmn` file the user picks, draw it, and say what it cost.
 *
 * Four steps, and the middle one is not re-implemented here: pick the file,
 * run the DECLARED capability (`docs/adr/0012`), write what it returned,
 * report. `BPMN_XML_IMPORT.run` is the same function labre-mcp calls, so the
 * command and the registry cannot read the same file differently — the same
 * "one door, and the registry is the label on it" the export follows, and a
 * plain import for the same reason (the capability is a pure function and a
 * value; a DI lookup would buy nothing and P3 is explicit that the registry is
 * the editor's view of these functions, not a gate in front of them).
 *
 * ## What arrives is a NEW board, never a merge
 *
 * The elements are added beside whatever is already on the surface. That is the
 * bottom row of the reader's own loss table — surface identity across a
 * re-import is lost — and it is the honest behaviour: two boards the user can
 * see and delete beats a merge that silently rewrote artefacts they had edited.
 *
 * ## Failure is an exception, and it says which one
 *
 * The reader THROWS on a file that is not a readable BPMN document, because its
 * five note kinds cannot say "this is not a file I can read" and a report of
 * three zeroes would claim an empty process where there was none. The sentence
 * it throws names which of the cases it was — malformed XML, a root that is not
 * `definitions`, a DMN model, a choreography — so it is shown as it is rather
 * than replaced with a wording of our own that knows less.
 */
export async function importBpmnXmlFile(std: BlockStdScope): Promise<void> {
  const gfx = gfxOf(std);
  if (!gfx.surface || std.store.readonly) return;

  const file = await openSingleFileWith('Bpmn');
  // The user closed the picker. Not a failure, and not a notification: they
  // know what they just did.
  if (!file) return;

  let result: InterchangeImportResult;
  try {
    result = BPMN_XML_IMPORT.run(await file.text(), { name: file.name });
  } catch (error) {
    notifyBpmn(std, {
      title: translateKey(std, IMPORT_FAILED_KEY, IMPORT_FAILED_FALLBACK),
      message: error instanceof Error ? error.message : String(error),
      accent: 'error',
    });
    return;
  }

  // One undo step for the whole file, the way one lane gesture is one step:
  // `captureSync` before opens a boundary, the writes land inside it, and the
  // second one closes it. An import a user has to undo forty times is an import
  // they cannot undo.
  std.store.captureSync();
  const created = materializeBpmnImport(std, result.elements);
  std.store.captureSync();

  // …and then bring it into view, which is what template insertion does for
  // the same reason: a board that landed off-screen looks like a command that
  // did nothing. The padding is in MODEL units, so it is divided by the zoom to
  // stay a constant margin on screen — the template panel's own arithmetic.
  //
  // ## Why the empty boxes are dropped, and it is not defensive
  //
  // A connector has no geometry of its own: its bound is derived from the path
  // the connector manager routes between its two ends, and that path is
  // computed on a LATER tick than the `addElement` that created it. Read
  // synchronously here — which is the only moment this function has — every
  // freshly imported connector answers `[0, 0, 0, 0]`, and a common bound that
  // includes the origin stretches from (0, 0) to the far corner of the drawing.
  // A file drawn at x ≈ 100000 (bpmn.io hands those out the moment somebody
  // drags a process across the canvas) then fits a 100000-wide box, and the
  // process the user just imported is a speck in the corner.
  //
  // Dropping zero-area boxes costs nothing and loses nothing: a connector runs
  // BETWEEN two nodes, so once its path settles its bound is already inside
  // theirs, and every artefact this pack draws has a positive size by
  // construction (`NODE_SIZE`, and a pool's plot). What is left is exactly the
  // shaped elements, which is what "fit the imported board" means.
  const boxes = created
    .map(id => gfx.surface?.getElementById(id)?.elementBound)
    .filter(
      (bound): bound is Bound =>
        bound !== undefined && bound.w > 0 && bound.h > 0
    );
  const bound = getCommonBound(boxes);
  if (bound) {
    const padding = 20 / gfx.viewport.zoom;
    gfx.viewport.setViewportByBound(
      bound,
      [padding, padding, padding, padding],
      true
    );
  }
  gfx.tool.setTool(DefaultTool);

  reportBpmnImport(std, result.report);
}

/**
 * Rename one lane of one pool. Called by the in-place editor
 * (`element-view.ts`); exported so a unit test can assert the write without an
 * editor around it.
 *
 * An empty name REMOVES the key rather than storing `''`: the renderer already
 * treats both as "no name", and one of the two would be a second way to say the
 * same thing that only the bytes can tell apart.
 */
export function renameBpmnLane(
  std: BlockStdScope,
  model: BpmnPoolElementModel,
  index: number,
  name: string
): void {
  const lanes = bpmnLanesOf(model);
  const lane = lanes[index];
  if (!lane) return;

  const trimmed = name.trim();
  if ((lane.name ?? '') === trimmed) return;

  const next = lanes.map((entry, i) =>
    i === index
      ? {
          id: entry.id,
          ...(trimmed ? { name: trimmed } : {}),
          size: entry.size,
        }
      : entry
  );
  std.store.captureSync();
  writeLanes(std, model, next);
}
