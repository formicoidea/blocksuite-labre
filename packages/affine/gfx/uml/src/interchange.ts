import type {
  InterchangeCapability,
  InterchangeExportCapability,
  InterchangeExporter,
  InterchangeFormat,
  InterchangeImportCapability,
  InterchangeImporter,
  InterchangeNote,
  InterchangeReport,
} from '@labre/affine-block-surface';
import { interchangeCapabilityId } from '@labre/affine-block-surface';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';

import { importDrawio, UML_DRAWIO_FORMAT_ID } from './drawio-import.js';
import { exportUmlPlantuml, exportUmlXmi } from './export.js';
import { umlSafeFilename } from './filename.js';
import { umlElementsFromModel } from './import.js';
import { type UmlModel, type UmlSourceElement, umlModelFrom } from './model.js';
import { importPlantuml } from './plantuml-import.js';
import { importXmi, umlElementsWithForeign } from './xmi-import.js';

/**
 * UML's entries in the interchange registry (`docs/adr/0012`, P1).
 *
 * Three formats and five capabilities (`docs/adr/0019`): PlantUML and XMI in
 * both directions, draw.io in only. A row per TRIPLE and never one thing with
 * several spellings — the three make different promises to whoever opens the
 * file, and the registry says so in the only way it can. The asymmetry that is
 * left is deliberate and stated rather than left to be assumed: there is no
 * `uml:drawio:export`, because writing a picture back is a re-render (P2), and
 * a board that came in from draw.io leaves through PlantUML or XMI with its
 * model intact.
 *
 * Everything here is pure. The model builder, both writers and all three
 * readers have never had a `std` in sight, and this file adds no editor to
 * them — the one thing a reader genuinely cannot do, inflating a compressed
 * `.drawio` container, is the COMMAND's and is documented at
 * `runUmlDrawioImport` and in `drawio-decode.ts`. It picks the diagrams
 * out of the elements it is handed, reads each one, and names the file.
 *
 * ## The selection, and what a whole surface means
 *
 * Expressed by the caller through WHICH DIAGRAMS it puts in the element list,
 * exactly as C4 expresses it with boards. A UML diagram frame is one sheet — a
 * class diagram, a use case diagram — and the whole point of drawing four of
 * them side by side is that they are four diagrams (ADR 0017). So every
 * `umlDiagram` in the list becomes a document (PlantUML) or a package (XMI), and
 * a caller that wants one leaves the others out. A headless host that hands over
 * the whole surface gets every diagram, which is the honest whole-surface
 * answer.
 */

/* ── The formats ──────────────────────────────────────────────────────── */

/**
 * PlantUML source. **Semantic** — the file carries a model, not a picture, so it
 * takes the whole preservation contract the day an importer is written.
 *
 * `.puml` first because it is the extension a download is given and the one the
 * PlantUML tooling watches for; `.plantuml` rides behind it, because half the
 * editor plugins in the wild write that instead and a picker that refused them
 * would refuse a valid diagram over a filename.
 *
 * No `mime` on the FORMAT, for the reason `C4_MERMAID_FORMAT` has none: PlantUML
 * has no registered media type, so there is none to declare. What a DOWNLOAD is
 * served as is a different question with an answer — `text/plain`, because an
 * invented type is a file some browsers refuse to save — and it is stated on the
 * export result, where it belongs. The charset rides with it: unlike XML, a
 * PlantUML file has no prolog to declare its own encoding in, and `«interface»`
 * is a keyword that stops meaning anything as mojibake.
 */
export const UML_PLANTUML_EXTENSION = '.puml';
export const UML_PLANTUML_MIME = 'text/plain;charset=utf-8';

export const UML_PLANTUML_FORMAT: InterchangeFormat = {
  id: 'plantuml',
  tier: 'semantic',
  extensions: [UML_PLANTUML_EXTENSION, '.plantuml'],
};

/**
 * XMI 2.5.1. **Semantic**, and the one a modelling tool reads.
 *
 * `.xmi` is what the OMG's own specification calls the file and what Papyrus,
 * MagicDraw and StarUML offer first; `.uml` rides behind it because Eclipse's
 * UML2 writes model files under that name and an author who exported one from
 * there will look for it. `application/xml` rather than `text/xml`: the file is
 * not meant to be read as text by whatever opens it.
 */
export const UML_XMI_EXTENSION = '.xmi';
export const UML_XMI_MIME = 'application/xml';

export const UML_XMI_FORMAT: InterchangeFormat = {
  id: 'xmi',
  tier: 'semantic',
  extensions: [UML_XMI_EXTENSION, '.uml'],
  mime: UML_XMI_MIME,
};

/* ── Picking the diagrams ─────────────────────────────────────────────── */

/**
 * The diagrams in a list of elements, read into models, in document order.
 *
 * The frames are picked on `type` rather than with `instanceof
 * UmlDiagramElementModel`, which is where this differs from `c4BoardFrom`. The
 * reason is the model builder's own contract: `umlModelFrom` reads STRUCTURAL
 * records so that it is callable with plain objects and no store
 * (`docs/adr/0012` P3), and an `instanceof` in front of it would put back the
 * dependency the purity was for — a capability that only works when a Yjs
 * document minted the elements. `type` is a getter every element model
 * implements and a field every fixture carries, so the same predicate answers
 * for both.
 *
 * Document order matters for the reason it does everywhere in this framework: it
 * is the tie-break attribution breaks on — a centre inside two overlapping
 * frames goes to the first — and the audit's `attribute()` breaks it the same
 * way. Sorting here would make the export disagree with the badge the user can
 * see.
 */
export function umlModelsFrom(
  elements: readonly GfxPrimitiveElementModel[]
): UmlModel[] {
  const source = elements as unknown as readonly UmlSourceElement[];
  return source
    .filter(element => element.type === 'umlDiagram')
    .map(diagram => umlModelFrom(diagram, source));
}

/* ── The capabilities ─────────────────────────────────────────────────── */

/**
 * The diagrams as PlantUML source.
 *
 * A thin adapter and nothing else: it reads the models, runs the writer, and
 * names the file. There is no second door — `uml.exportPlantuml` calls THIS, so
 * the command and the registry cannot produce different bytes, different
 * filenames or different warnings: there is nowhere for them to differ.
 *
 * `warnings` is omitted rather than empty when the diagram came out whole, so a
 * caller can ask `if (result.warnings)` and mean it.
 */
const runUmlPlantumlExport: InterchangeExporter = (elements, context) => {
  const name = umlSafeFilename(context.name);
  const { text, warnings } = exportUmlPlantuml(umlModelsFrom(elements));
  return {
    text,
    filename: `${name}${UML_PLANTUML_EXTENSION}`,
    mime: UML_PLANTUML_MIME,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};

/** `uml:plantuml:export` — UML's first capability. */
export const UML_PLANTUML_EXPORT: InterchangeExportCapability = {
  id: interchangeCapabilityId('uml', UML_PLANTUML_FORMAT.id, 'export'),
  framework: 'uml',
  format: UML_PLANTUML_FORMAT,
  direction: 'export',
  run: runUmlPlantumlExport,
};

/**
 * How many artefacts one model DREW — what `InterchangeReport.mapped` counts.
 *
 * The frame is deliberately not among them: no file this pack reads has a
 * `umlDiagram` in it, Labre mints one per model, and a count that included it
 * would claim the reader mapped one node more than the source had. Relations
 * are, because a relationship is something the file said and the board now
 * draws.
 */
function umlMappedCount(model: UmlModel): number {
  const machine = model.stateMachines[0];
  const activity = model.activities[0];
  return (
    model.classifiers.length +
    model.packages.length +
    model.actors.length +
    model.useCases.length +
    model.subjects.length +
    model.notes.length +
    model.components.length +
    model.ports.length +
    model.artifacts.length +
    model.nodes.length +
    (activity ? activity.nodes.length + activity.partitions.length : 0) +
    (machine
      ? machine.regions.length +
        machine.states.length +
        machine.finalStates.length +
        machine.pseudostates.length
      : 0) +
    model.relations.length
  );
}

/**
 * PlantUML source as diagrams — the format a `.puml` in a `docs/` folder is in.
 *
 * Two steps: PARSE ({@link importPlantuml}, one model per
 * `@startuml … @enduml`) and MATERIALIZE (the same
 * {@link umlElementsFromModel} the other two readers end on). No third step,
 * because there is nothing foreign to put back: PlantUML is a LINE language, so
 * what this reader cannot map is a line rather than a fragment with an id, and
 * a line is reported rather than carried onto an element that did not produce
 * it.
 *
 * `quarantined` is therefore always zero, and it means what D5 says: nothing was
 * kept-and-deliberately-not-written-back. Everything the parser did not
 * understand is in the notes, and the writer next door emits none of it because
 * it never understood it in the first place.
 */
const runUmlPlantumlImport: InterchangeImporter = source => {
  const { models, notes } = importPlantuml(source);
  const materialized = umlElementsFromModel(models, {
    formatId: UML_PLANTUML_FORMAT.id,
  });
  const all: InterchangeNote[] = [...notes, ...materialized.notes];
  const report: InterchangeReport = {
    mapped: models.reduce((total, model) => total + umlMappedCount(model), 0),
    carried: all.filter(note => note.kind === 'carried').length,
    quarantined: 0,
    notes: all,
  };
  return { elements: materialized.elements, report };
};

/** `uml:plantuml:import` — a `.puml` from a repository, read as sheets. */
export const UML_PLANTUML_IMPORT: InterchangeImportCapability = {
  id: interchangeCapabilityId('uml', UML_PLANTUML_FORMAT.id, 'import'),
  framework: 'uml',
  format: UML_PLANTUML_FORMAT,
  direction: 'import',
  run: runUmlPlantumlImport,
};

/**
 * The diagrams as one XMI 2.5.1 document.
 *
 * The sanitized name is handed to the writer as well as to the download, so the
 * `uml:Model` inside the file is called what the file is called. That is
 * inherited behaviour rather than a choice made here — `InterchangeExportContext`
 * documents the same consequence for BPMN — and it is the honest one: a board
 * titled `Order/to cash` is named `Order-to cash` in both places rather than
 * differently in each.
 */
const runUmlXmiExport: InterchangeExporter = (elements, context) => {
  const name = umlSafeFilename(context.name);
  const { text, warnings } = exportUmlXmi(umlModelsFrom(elements), { name });
  return {
    text,
    filename: `${name}${UML_XMI_EXTENSION}`,
    mime: UML_XMI_MIME,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};

/** `uml:xmi:export` — the interchange file a modelling tool reads. */
export const UML_XMI_EXPORT: InterchangeExportCapability = {
  id: interchangeCapabilityId('uml', UML_XMI_FORMAT.id, 'export'),
  framework: 'uml',
  format: UML_XMI_FORMAT,
  direction: 'export',
  run: runUmlXmiExport,
};

/**
 * An XMI 2.5.1 document as diagrams — the one direction a modelling tool
 * actually writes.
 *
 * Three steps and no fourth: PARSE the file into the phase-1 IR
 * ({@link importXmi}, pure, with its own tokenizer because `DOMParser` is a DOM
 * global and P3 forbids one), MATERIALIZE the IR onto a board (the same
 * {@link umlElementsFromModel} the other two importers use — one layout, one
 * set of seeded sizes, one place to change them), and put the FOREIGN MATTER
 * back on the elements it came off ({@link umlElementsWithForeign}, matching on
 * the source id the materializer already wrote under `interchange.xmi.id`).
 *
 * The counts come from the parser rather than from the notes, because they are
 * what the parser actually did: `mapped` is the artefacts it built, `carried`
 * the attributes it kept on them, `quarantined` the fragments it kept and
 * declared un-re-emittable (D5, and see {@link importXmi}'s header for why
 * everything unmapped in this format lands in that third column rather than the
 * second). The materializer's own notes — D4's `invented-layout`, which every
 * XMI file earns, because the format carries no coordinates — are appended.
 */
const runUmlXmiImport: InterchangeImporter = (source, context) => {
  const { models, layout, foreign, report } = importXmi(source, context);
  const materialized = umlElementsFromModel(models, {
    formatId: UML_XMI_FORMAT.id,
    layout: { boxes: layout },
  });
  return {
    elements: umlElementsWithForeign(
      materialized.elements,
      foreign,
      UML_XMI_FORMAT.id
    ),
    report: {
      ...report,
      notes: [...report.notes, ...materialized.notes],
    },
  };
};

/** `uml:xmi:import` — the file a modelling tool wrote, read back as sheets. */
export const UML_XMI_IMPORT: InterchangeImportCapability = {
  id: interchangeCapabilityId('uml', UML_XMI_FORMAT.id, 'import'),
  framework: 'uml',
  format: UML_XMI_FORMAT,
  direction: 'import',
  run: runUmlXmiImport,
};

/* ── The visual tier ──────────────────────────────────────────────────── */

/**
 * draw.io (`mxfile`). **Visual** — the file carries a drawing, not a model.
 *
 * The one tier difference in this pack, and it is the honest one (ADR 0012 P2,
 * `docs/adr/0019`): a `.drawio` cell says `endArrow=block`, not
 * `uml:Generalization`, so every UML fact this reader produces is a guess made
 * from a style string. Good guesses — draw.io's own UML stencils write a small
 * fixed vocabulary — but guesses, and the tier is what tells a user so before
 * the picker closes.
 *
 * `.drawio` first because it is the extension the application writes and the
 * one a picker should offer; `.drawio.xml` behind it for the uncompressed save,
 * and the generic `.xml` last, because plenty of exports land under it and what
 * the file actually IS is decided by the reader.
 *
 * There is no `uml:drawio:export` to pair this with, and there is not meant to
 * be: writing a picture back is a re-render (P2), and a board that came in from
 * draw.io leaves through PlantUML or XMI with its model intact.
 */
export const UML_DRAWIO_EXTENSION = '.drawio';
export const UML_DRAWIO_MIME = 'application/xml';

export const UML_DRAWIO_FORMAT: InterchangeFormat = {
  id: UML_DRAWIO_FORMAT_ID,
  tier: 'visual',
  extensions: [UML_DRAWIO_EXTENSION, '.drawio.xml', '.xml'],
  mime: UML_DRAWIO_MIME,
};

/**
 * A draw.io drawing as a board — decoded XML in, elements out.
 *
 * The compressed-payload split (`docs/adr/0019`) shows up here as a REFUSAL
 * rather than as a decoder: `run` is a pure synchronous function (P3) and
 * inflating a raw-deflate stream is neither, so a payload that still needs
 * `DecompressionStream` comes back as an empty board with one `warning` note
 * saying to decode first. The command does that decoding before it calls this
 * (`importUmlDrawioFile`), and a host calling the capability directly gets a
 * sentence it can act on instead of an empty drawing it cannot explain.
 */
const runUmlDrawioImport: InterchangeImporter = (source, context) => {
  const { model, notes, layout } = importDrawio(source, { name: context.name });
  const materialized = umlElementsFromModel([model], {
    formatId: UML_DRAWIO_FORMAT.id,
    layout,
  });
  const all = [...notes, ...materialized.notes];

  return {
    elements: materialized.elements,
    report: {
      // What became a drawn, editable artefact — the shapes and the connectors
      // the reader recognised. The frame is not counted: nothing in the file
      // was a frame, Labre mints it, and a count that included it would claim
      // the reader mapped one node more than the file had.
      mapped:
        model.classifiers.length +
        model.packages.length +
        model.actors.length +
        model.useCases.length +
        model.notes.length +
        model.relations.length,
      carried: all.filter(note => note.kind === 'carried').length,
      // Nothing, ever, and it is a fact about the TIER rather than an omission.
      // Quarantine means "kept in the document and deliberately not re-emitted"
      // (D5), and it only means something for a format Labre writes back. There
      // is no draw.io writer, so there is nothing a fragment could contradict.
      quarantined: 0,
      notes: all,
    },
  };
};

/** `uml:drawio:import` — a draw.io drawing, read as UML. */
export const UML_DRAWIO_IMPORT: InterchangeImportCapability = {
  id: interchangeCapabilityId('uml', UML_DRAWIO_FORMAT.id, 'import'),
  framework: 'uml',
  format: UML_DRAWIO_FORMAT,
  direction: 'import',
  run: runUmlDrawioImport,
};

/**
 * Everything UML registers, in one list the view extension can hand over.
 *
 * Sorted by capability id, which is the order `interchangeCapabilities` answers
 * in anyway — so a menu built from this list and a menu built from the registry
 * cannot come out in two different orders.
 */
export const UML_INTERCHANGE: readonly InterchangeCapability[] = [
  UML_DRAWIO_IMPORT,
  UML_PLANTUML_EXPORT,
  UML_PLANTUML_IMPORT,
  UML_XMI_EXPORT,
  UML_XMI_IMPORT,
];
