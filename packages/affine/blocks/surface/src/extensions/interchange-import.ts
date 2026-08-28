import { ConnectorElementModel } from '@labre/affine-model';
import {
  NotificationProvider,
  translateKey,
} from '@labre/affine-shared/services';
import { openSingleFileWithSpec } from '@labre/affine-shared/utils';
import type { ServiceProvider } from '@labre/global/di';
import { type Bound, getCommonBound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';

import { DefaultTool } from '../tool/default-tool.js';
import {
  type InterchangeFormat,
  type InterchangeImportCapability,
  type InterchangeImportResult,
  type InterchangeNote,
  type InterchangeReport,
  interchangeCapabilities,
  type SerializedElementProps,
} from './interchange.js';

/**
 * **The public import API** — what an editor, a host application or a plugin
 * calls to turn a foreign file into a board (`docs/adr/0012`).
 *
 * The registry next door declares WHAT Labre can read; a reader is a pure
 * function of text (P3), and it deliberately stops short of the four things
 * only a caller with an editor in its hands can do: pick the file, mint surface
 * ids and repair the references that named the file's, bring the drawing into
 * view, and say what the import cost. Those four were written once, for BPMN,
 * inside `gfx/bpmn/src/actions.ts`. They are here now because not one line of
 * them was about BPMN: an OWM sketch, a mermaid diagram and an SVG all need the
 * same four, and a second copy of them would be a second set of bugs and a
 * second wording of the same report.
 *
 * Three audiences, and they take different doors:
 *
 * - a **framework command** calls {@link runInterchangeImportFile} with its own
 *   capability, and that is the whole of its import glue;
 * - a **host** (labreapp) builds its own import surface — a drop zone, a
 *   sidepanel, a menu of everything readable — on
 *   {@link interchangeImportersByExtension} plus the same three functions;
 * - **labre-mcp** calls no function here at all. It has no editor, so it calls
 *   `capability.run` directly and writes the props itself, which is exactly the
 *   purity P3 buys.
 */

/* ── Writing what a reader returned ───────────────────────────────────── */

/**
 * Write an imported board onto the surface, and give back the ids it minted.
 *
 * ## The one thing the caller of an importer owes (`docs/adr/0012`, D3)
 *
 * `surface.addElement` mints its own nanoid and ignores any id it is handed —
 * surface identity is Labre's and never the file's — so a connector arrives
 * with `source` / `target` naming the SOURCE FILE's ids. Every element carries
 * its own source id under `interchange[formatId].id`, so the map from file id to
 * surface id is a fold over the very array the reader returned; the second pass
 * rewrites the two endpoints from it. Nothing else is needed, and nothing else
 * is done: an end the map cannot resolve is left exactly as the file wrote it.
 * That keeps the DOCUMENT honest, not the drawing — a connector naming an id no
 * element has routes to an empty path and is invisible on the canvas (it does
 * not crash; `connector-manager.ts` handles the missing connectable) — and an
 * unresolvable name a reader can go and look up in the source file beats one
 * this function quietly invented.
 *
 * The `interchange` payload needs no second pass: it rides in the props as one
 * whole blob and `addElement` writes it with everything else, which is the
 * whole-record LWW the field's own contract asks for (D2).
 *
 * @param formatId the format whose payload key carries the source ids — the
 *   `id` of the capability's {@link InterchangeFormat}, and the ONLY thing this
 *   function ever knew about BPMN.
 */
export function materializeInterchangeImport(
  std: BlockStdScope,
  formatId: string,
  elements: readonly SerializedElementProps[]
): string[] {
  const surface = std.get(GfxControllerIdentifier).surface;
  if (!surface) return [];

  const bySource = new Map<string, string>();
  const created = elements.map(props => {
    const id = surface.addElement({ ...props });
    const carried = props.interchange as
      | Record<string, { id?: string }>
      | undefined;
    const source = carried?.[formatId]?.id;
    // FIRST wins, matching a reader's own answer to a file that used one id
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

/* ── Saying what it cost ──────────────────────────────────────────────── */

const IMPORT_DONE_KEY = 'com.labre.interchange.import.done';
const IMPORT_DONE_FALLBACK = 'file imported';
const IMPORT_FAILED_KEY = 'com.labre.interchange.import.failed';
const IMPORT_FAILED_FALLBACK = 'This file could not be imported';
const IMPORT_REMARKS_KEY = 'com.labre.interchange.import.remarks';
const IMPORT_REMARKS_FALLBACK = 'What the import could not keep as it was';
const IMPORT_CONSOLE_KEY = 'com.labre.interchange.import.console';
const IMPORT_CONSOLE_FALLBACK =
  'remarks — the full report is in the browser console.';
const IMPORT_DRAWN_KEY = 'com.labre.interchange.import.drawn';
const IMPORT_DRAWN_FALLBACK = 'drawn';
const IMPORT_CARRIED_KEY = 'com.labre.interchange.import.carried';
const IMPORT_CARRIED_FALLBACK = 'carried';
const IMPORT_QUARANTINED_KEY = 'com.labre.interchange.import.quarantined';
const IMPORT_QUARANTINED_FALLBACK = 'quarantined';

/**
 * How many remarks the second notification spells out before it hands the
 * reader to the console.
 *
 * A toast is a headline surface: past five lines it stops being read and starts
 * being dismissed, and a report nobody reads is a report that was not written.
 * See {@link reportInterchangeImport} for what the number is a compromise
 * about.
 */
const REMARKS_IN_A_NOTIFICATION = 5;

/**
 * How the format names itself in a sentence: `bpmn` → `BPMN`.
 *
 * A format id is a lower-case key in the document (D2) and a proper noun in the
 * chrome, and the chrome is where a user reads it — "BPMN 2.0", "SVG", "OWM".
 * Upper-casing the declared id rather than adding a `label` field keeps the
 * registry a table of facts about files: there is no second name to keep in
 * step, and no format can be called one thing in its payload and another in the
 * toast. The names this library actually ships are acronyms, which is why the
 * rule is this simple one and not a title-casing.
 */
const formatLabel = (format: InterchangeFormat) => format.id.toUpperCase();

/** One remark, as the line a reader sees. */
function remarkLine(note: InterchangeNote): string {
  const subject = note.sourceId ?? note.element;
  return subject ? `${subject}: ${note.message}` : note.message;
}

/**
 * The notification seam, or silence.
 *
 * `getOptional`, like every other call site in the library: the host injects a
 * `NotificationService` (labreapp does, the standalone playground does not), and
 * an import that assumed one would be an import the playground cannot run.
 * Nothing here decides that an import failed to happen because nobody was
 * listening — the elements are on the surface either way.
 */
function notifyImport(
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
 *
 * ## The format is a word in the sentence, not a sentence per format
 *
 * The wordings are one set of keys for every format, and the format's own name
 * is composed into them ({@link formatLabel}). The translation seam has no
 * interpolation and no pluralisation — both are the host's — so a countable
 * noun and a proper noun are the largest units this library can hand over
 * without inventing grammar, which is the same argument the three count labels
 * already ran on. The alternative, a key per format, would ask a host to
 * translate "BPMN file imported" and "SVG file imported" as unrelated
 * sentences and would leave every new format silently untranslated.
 */
export function reportInterchangeImport(
  std: BlockStdScope,
  format: InterchangeFormat,
  report: InterchangeReport
): void {
  const label = formatLabel(format);
  const counts = [
    `${report.mapped} ${translateKey(std, IMPORT_DRAWN_KEY, IMPORT_DRAWN_FALLBACK)}`,
    `${report.carried} ${translateKey(std, IMPORT_CARRIED_KEY, IMPORT_CARRIED_FALLBACK)}`,
    `${report.quarantined} ${translateKey(std, IMPORT_QUARANTINED_KEY, IMPORT_QUARANTINED_FALLBACK)}`,
  ].join(' · ');
  // The version the reader actually READ, which is a fact about the file and
  // not about this library — an `exporter` attribute is how a support thread
  // about "bpmn.io drew it differently" gets answered in one line.
  const version = report.sourceVersion;

  notifyImport(std, {
    title: `${label} ${translateKey(std, IMPORT_DONE_KEY, IMPORT_DONE_FALLBACK)}`,
    message: version ? `${counts} — ${label} ${version}` : counts,
    accent: 'info',
  });

  const notes = report.notes;
  if (notes.length === 0) return;

  // Always, and before the second toast: the console line is the one that is
  // still there in ten minutes, and the only place the WHOLE list lands when
  // there are forty of them.
  console.info(
    `[${format.id}] import report — ${counts}${version ? ` — ${label} ${version}` : ''}`
  );
  console.table(
    notes.map(note => ({
      kind: note.kind,
      source: note.sourceId ?? '',
      element: note.element ?? '',
      message: note.message,
    }))
  );

  notifyImport(std, {
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

/* ── The whole gesture ────────────────────────────────────────────────── */

/**
 * Read a file the user picks with one declared capability, draw it, and say
 * what it cost.
 *
 * Four steps, and the middle one is never re-implemented: pick the file, run
 * the DECLARED capability (`docs/adr/0012`), write what it returned, report.
 * `capability.run` is the same function labre-mcp calls, so a command and the
 * registry cannot read the same file differently — one door, and the registry
 * is the label on it.
 *
 * ## The picker filter is the FORMAT's, not a table's
 *
 * `{ [mime]: extensions }` straight off the declaration, so a framework that
 * adds a format adds its dialog filter with it and no second file has to agree.
 * A format that declares no mime is offered as `text/plain`, which is what a
 * DSL is — the extensions are the half that matters anyway, and the fallback
 * branch of the picker (`showOpenFilePicker` is absent in Firefox and Safari)
 * puts both halves into `input.accept` precisely because extensions like
 * `.bpmn` are registered with no operating system on earth.
 *
 * ## What arrives is a NEW board, never a merge
 *
 * The elements are added beside whatever is already on the surface. That is the
 * bottom row of a reader's own loss table — surface identity across a
 * re-import is lost — and it is the honest behaviour: two boards the user can
 * see and delete beats a merge that silently rewrote artefacts they had edited.
 *
 * ## Failure is an exception, and it says which one
 *
 * A reader THROWS on a file it cannot read, because the five note kinds cannot
 * say "this is not a file I can read" and a report of three zeroes would claim
 * an empty document where there was none. The sentence it throws names which of
 * its refusals it was, so it is shown as it is rather than replaced with a
 * wording of our own that knows less.
 */
export async function runInterchangeImportFile(
  std: BlockStdScope,
  capability: InterchangeImportCapability
): Promise<void> {
  const gfx = std.get(GfxControllerIdentifier);
  if (!gfx.surface || std.store.readonly) return;

  const { format } = capability;
  const file = await openSingleFileWithSpec({
    description: formatLabel(format),
    accept: { [format.mime ?? 'text/plain']: [...format.extensions] },
  });
  // The user closed the picker. Not a failure, and not a notification: they
  // know what they just did.
  if (!file) return;

  let result: InterchangeImportResult;
  try {
    result = capability.run(await file.text(), { name: file.name });
  } catch (error) {
    notifyImport(std, {
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
  const created = materializeInterchangeImport(std, format.id, result.elements);
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
  // theirs, and every artefact a framework pack draws has a positive size by
  // construction. What is left is exactly the shaped elements, which is what
  // "fit the imported board" means.
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

  reportInterchangeImport(std, format, result.report);
}

/* ── What can read a file called this ─────────────────────────────────── */

/**
 * Every registered importer, indexed by the extensions it declares.
 *
 * A LIST per extension, and that is the whole design: `.svg` will be claimed by
 * several frameworks at once, because an SVG is a picture and which framework's
 * vocabulary it is a picture OF is not a fact about the filename. ADR 0012 is
 * explicit that a visual import is heuristic recognition and that the surface
 * must name what it is about to do before the file is read — so this answers
 * "what could read this file", and a UI (or a user) chooses. Anything that
 * silently picked one would be guessing on the user's behalf about the one
 * question they are the only one able to answer.
 *
 * Keys keep their leading dot and are lower-cased, because a file called
 * `Order.BPMN` is the same kind of file as `order.bpmn` and nobody should have
 * to know which. Capabilities keep the registry's own order — sorted by
 * capability id — so a menu built from this map reads the same on every boot.
 *
 * Registration is flag-gated tooling (`docs/adr/0009`), so a framework whose
 * flag is off contributes no row here, and a document a past import wrote keeps
 * every byte it was given.
 */
export function interchangeImportersByExtension(
  provider: ServiceProvider
): Map<string, InterchangeImportCapability[]> {
  const byExtension = new Map<string, InterchangeImportCapability[]>();
  for (const capability of interchangeCapabilities(provider, {
    direction: 'import',
  })) {
    for (const extension of capability.format.extensions) {
      const key = extension.toLowerCase();
      const capabilities = byExtension.get(key);
      if (capabilities) capabilities.push(capability);
      else byExtension.set(key, [capability]);
    }
  }
  return byExtension;
}
