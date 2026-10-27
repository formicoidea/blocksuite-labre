import type {
  InterchangeFormat,
  InterchangeImportCapability,
} from '@labre/affine-block-surface/interchange';
import {
  interchangeCapabilityId,
  parseSvgSketch,
  SVG_SKETCH_EXTENSION,
  SVG_SKETCH_FORMAT_ID,
  SVG_SKETCH_MIME,
} from '@labre/affine-block-surface/interchange';

import { BPMN_FORMAT_ID } from './export.js';
import { importBpmnXml } from './import.js';

/**
 * `@labre/affine-gfx-bpmn/interchange` — BPMN's formats and its two READERS,
 * with no editor behind them (ADR 0012, P3 as amended 2026-10-14).
 *
 * What a server needs to read a `.bpmn` or an `.svg` as a BPMN board: the
 * format declarations and the import capabilities, whose `run` is a pure
 * function of text. The EXPORT capability is not here and cannot be: it picks
 * the artefacts out of live element models (`bpmnBoardFrom`, by `instanceof`),
 * which is the editor graph this entry exists to leave out. It stays in
 * `interchange.ts`, which re-exports everything below.
 *
 * Held by `interchange-headless.unit.spec.ts` in `packages/affine/all`.
 */

/* ── The format ───────────────────────────────────────────────────────── */

/**
 * BPMN 2.0 XML. **Semantic** — the file carries a model, not a picture, so it
 * takes the whole preservation contract the day an importer is written.
 *
 * `application/xml` and not `text/xml`: the file is not meant to be read as
 * text by whatever opens it, and `.bpmn` is the extension every BPMN tool
 * watches for.
 *
 * `.xml` rides along BEHIND it, and the order is the whole of the difference:
 * the first extension is the one a download is given, so Labre still writes
 * `.bpmn`, and the rest are what a picker offers and what an auto-detecting
 * host indexes on. Half the tools in the wild write the same bytes under the
 * generic extension, and a filter that refused them would refuse a valid
 * process for the sake of a filename — the same argument the shared `FileTypes`
 * table made when this filter lived there, kept now that the filter is built
 * from the format itself. What the file actually IS is decided by the reader,
 * which throws on anything that is not a BPMN `<definitions>`.
 */
export const BPMN_XML_EXTENSION = '.bpmn';
export const BPMN_XML_MIME = 'application/xml';

export const BPMN_XML_FORMAT: InterchangeFormat = {
  id: BPMN_FORMAT_ID,
  tier: 'semantic',
  extensions: [BPMN_XML_EXTENSION, '.xml'],
  mime: BPMN_XML_MIME,
};

/**
 * `bpmn:bpmn:import` — a `.bpmn` file as a board.
 *
 * A thin adapter over {@link importBpmnXml} and nothing else, which is the
 * whole of what a capability is: the parser is a pure function of a string, so
 * the registry entry has nothing to add to it and deliberately adds nothing.
 * A reader that threw its arms around a surface here would be a reader
 * labre-mcp could not call.
 */
export const BPMN_XML_IMPORT: InterchangeImportCapability = {
  id: interchangeCapabilityId('bpmn', BPMN_XML_FORMAT.id, 'import'),
  framework: 'bpmn',
  format: BPMN_XML_FORMAT,
  direction: 'import',
  run: importBpmnXml,
};

/* ── The visual tier ──────────────────────────────────────────────────── */

/**
 * SVG. **Visual** — the file carries a rendering, not a model.
 *
 * A separate format object from `BPMN_XML_FORMAT` and deliberately not a shared
 * singleton with Wardley's: ADR 0012's unit is the TRIPLE, and the ADR
 * explicitly rejects "one capability per format, with the framework inferred
 * from the file" — a `.svg` is read by several frameworks and the inference is
 * exactly the guess the ADR forbids everywhere else. The three constants come
 * from the parser's own package so the two declarations cannot drift into
 * disagreeing about the extension or the mime a picker filters on.
 */
export const BPMN_SVG_FORMAT: InterchangeFormat = {
  id: SVG_SKETCH_FORMAT_ID,
  tier: 'visual',
  extensions: [SVG_SKETCH_EXTENSION],
  mime: SVG_SKETCH_MIME,
};

/**
 * `bpmn:svg:import` — an SVG as a sketch, best effort.
 *
 * **The heuristics statement and the known failure modes this capability owes
 * (ADR 0012, open question 2) are the module documentation of
 * `packages/affine/blocks/surface/src/extensions/svg-sketch.ts`.** They are
 * written once, there, because BPMN and Wardley wrap the SAME parser and
 * therefore make the same guesses; a framework that ever wants narrower or
 * wider recognition writes its own parser and its own paragraph beside it.
 *
 * What lands is a level-1 sketch (ADR 0007) — plain shapes, brush strokes and
 * editable free text — that the author then PROMOTES into BPMN artefacts.
 * Nothing here decides that a rounded rectangle in somebody's picture was a
 * task, and no `interchange` payload is written, because a visual round-trip
 * would be a re-render (P2).
 */
export const BPMN_SVG_IMPORT: InterchangeImportCapability = {
  id: interchangeCapabilityId('bpmn', BPMN_SVG_FORMAT.id, 'import'),
  framework: 'bpmn',
  format: BPMN_SVG_FORMAT,
  direction: 'import',
  run: parseSvgSketch,
};

// The toolbar as pure builders (`docs/adr/0045`): what a host with no editor
// places to draw the very elements a user places from the toolbar.
export {
  BPMN_TOOLBOX,
  bpmnFlowElement,
  bpmnNodeElements,
  type BpmnNodeTexts,
  bpmnPoolElement,
  type BpmnPoolTexts,
} from './toolbox.js';
