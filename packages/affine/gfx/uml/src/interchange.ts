import type {
  InterchangeCapability,
  InterchangeExportCapability,
  InterchangeExporter,
  InterchangeFormat,
} from '@labre/affine-block-surface';
import { interchangeCapabilityId } from '@labre/affine-block-surface';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';

import { exportUmlPlantuml, exportUmlXmi } from './export.js';
import { umlSafeFilename } from './filename.js';
import { type UmlModel, type UmlSourceElement, umlModelFrom } from './model.js';

/**
 * UML's entries in the interchange registry (`docs/adr/0012`, P1).
 *
 * Two formats OUT and neither one IN, declared as two capabilities rather than
 * as one thing with two spellings: PlantUML and XMI make different promises to
 * whoever opens the file, and the registry says so in the only way it can — a
 * row per triple. Nobody has written a reader for either, and the registry
 * states that too, rather than letting a caller assume the symmetry.
 *
 * Everything here is pure. The model builder and both writers have never had a
 * `std` in sight, and this file adds no editor to them: it picks the diagrams
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

/** Everything UML registers, in one list the view extension can hand over. */
export const UML_INTERCHANGE: readonly InterchangeCapability[] = [
  UML_PLANTUML_EXPORT,
  UML_XMI_EXPORT,
];
