import {
  DefaultTool,
  EdgelessCRUDIdentifier,
  generateElementId,
  type InterchangeReport,
  materializeInterchangeImport,
  reportInterchangeImport,
  runInterchangeImportFile,
  type SerializedElementProps,
} from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import {
  type BpmnLane,
  type BpmnNodeKind,
  BpmnPoolElementModel,
  ConnectorMode,
  PointStyle,
  StrokeStyle,
} from '@labre/affine-model';
import {
  EditPropsStore,
  NotificationProvider,
  translateKey,
} from '@labre/affine-shared/services';
import { downloadBlob } from '@labre/affine-shared/utils';
import { Bound } from '@labre/global/gfx';
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
  BPMN_SVG_IMPORT,
  BPMN_XML_EXPORT,
  BPMN_XML_FORMAT,
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
  gfxOf(std).tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Orthogonal,
    // A TYPED edge (`docs/adr/0010`): the arrow the user is about to draw says
    // "is followed by", so its source is what happens first. The tool carries
    // the role so the connector is born with it rather than acquiring one
    // afterwards.
    role: BPMN_ROLE.sequenceFlow,
    // The flow's look rides on the activation, never through the last-props
    // store: the plain connector tool must keep the user's own style (#144 M1).
    style: {
      stroke: SEQUENCE_STROKE,
      strokeStyle: StrokeStyle.Solid,
      strokeWidth: SEQUENCE_WIDTH,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.Triangle,
    },
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

/**
 * The one wording this file still owns: what a WRITER could not say.
 *
 * The import's wordings moved to the pipeline that writes them
 * (`affine-block-surface`, `extensions/interchange-import.ts`) — one set of
 * keys for every format, with the format's own name composed into them, so a
 * host translates "file imported" once instead of once per format. This one
 * stays because no other format's writer speaks through it.
 */
const EXPORT_WARNINGS_KEY = 'com.labre.commands.bpmn.exportXml.warnings';
const EXPORT_WARNINGS_FALLBACK = 'What this export could not write down';

/**
 * The notification seam, or silence.
 *
 * `getOptional`, like every other call site in the library: the host injects a
 * `NotificationService` (labreapp does, the standalone playground does not), and
 * a framework that assumed one would be a framework the playground cannot run.
 * Nothing here decides that an export said nothing because nobody was
 * listening — the file downloaded either way.
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

/* ── Import (BPMN 2.0 XML) ────────────────────────────────────────────── */

/**
 * Write an imported board onto the surface, and give back the ids it minted.
 *
 * BPMN's name for {@link materializeInterchangeImport}, which is where the two
 * passes live and are documented (`docs/adr/0012`, D3). Nothing in them was
 * ever about BPMN except the payload key the source ids ride under, so the
 * function moved to the surface package when the second format asked for it and
 * this name stayed: it is what the chromium round trip calls, and a test that
 * proves the shipped command has to keep calling the shipped function.
 */
export function materializeBpmnImport(
  std: BlockStdScope,
  elements: readonly SerializedElementProps[]
): string[] {
  return materializeInterchangeImport(std, BPMN_FORMAT_ID, elements);
}

/**
 * Say what the import did — the summary, and the remarks.
 *
 * BPMN's name for {@link reportInterchangeImport}, which is where the argument
 * for a toast plus a console table lives (ADR 0012's open question 4, v1). The
 * format is a word in the sentence now rather than a wording per format, so
 * what a user reads is unchanged: the counts, and `BPMN` before the version the
 * reader actually read.
 */
export function reportBpmnImport(
  std: BlockStdScope,
  report: InterchangeReport
): void {
  reportInterchangeImport(std, BPMN_XML_FORMAT, report);
}

/**
 * Read a `.bpmn` file the user picks, draw it, and say what it cost.
 *
 * The whole gesture is {@link runInterchangeImportFile}, over the capability
 * BPMN declares: pick the file, run the DECLARED reader, write what it
 * returned, fit the drawing, report. `BPMN_XML_IMPORT.run` is the same function
 * labre-mcp calls, so the command and the registry cannot read the same file
 * differently — one door, and the registry is the label on it. The picker's
 * filter comes off `BPMN_XML_FORMAT` rather than off the shared `FileTypes`
 * table, which is why `.xml` is declared there: half the tools in the wild
 * write a process under the generic extension, and what the file actually IS is
 * decided by the reader, which throws on anything that is not a BPMN
 * `<definitions>`.
 */
export async function importBpmnXmlFile(std: BlockStdScope): Promise<void> {
  await runInterchangeImportFile(std, BPMN_XML_IMPORT);
}

/**
 * Read an SVG the user picks as a SKETCH, and say what it cost.
 *
 * The same four steps as the `.bpmn` import, over a different declared
 * capability — which is the whole point of the seam: a second format costs a
 * declaration and a command, not a pipeline. What differs is the PROMISE, and
 * the promise is made by the command's own label and description before the
 * picker ever opens (`docs/adr/0012`, P2): recognition, best effort, no
 * round-trip, and a level-1 sketch the author then promotes.
 */
export async function importBpmnSvgFile(std: BlockStdScope): Promise<void> {
  await runInterchangeImportFile(std, BPMN_SVG_IMPORT);
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
