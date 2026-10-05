import type {
  InterchangeCapability,
  InterchangeExportCapability,
  InterchangeExporter,
  InterchangeFormat,
  InterchangeImportCapability,
} from '@labre/affine-block-surface';
import {
  interchangeCapabilityId,
  SVG_SKETCH_EXTENSION,
  SVG_SKETCH_FORMAT_ID,
  SVG_SKETCH_MIME,
} from '@labre/affine-block-surface';

import {
  exportWardleyOwmWithWarnings,
  WARDLEY_OWM_FORMAT_ID,
  wardleyBoardFrom,
  wardleySafeFilename,
} from './export.js';
import { importWardleyOwm } from './import.js';
import { importWardleySvg } from './svg-import.js';

/**
 * Wardley's entries in the interchange registry (`docs/adr/0012`, P1).
 *
 * Two formats and three rows. Both directions of the OWM DSL — the export is
 * the row the ADR records as **owed** (a Wardley serializer exists today in
 * labre-mcp, outside this repo, and is the one violation of P3 the ADR names;
 * it exists here now, so that repo becomes a caller and its copy is deleted),
 * and the import is the row the ADR calls **the reference Wardley import**,
 * because the OWM DSL is the settled Wardley vocabulary while mermaid's Wardley
 * diagram type is still experimental upstream. Then SVG IN, the visual-tier
 * route for a picture, which recognises the map when it knows who drew it and
 * sketches the rest (ADR 0032).
 *
 * The file is laid out as one section per FORMAT, each holding its format
 * object then its capabilities, with {@link WARDLEY_INTERCHANGE} at the bottom
 * collecting them. A format is added by adding a section, not by editing one.
 *
 * Everything here is pure. No half has ever had a `std` in sight, and this file
 * adds no editor to any of them: it picks the artefacts the writer speaks about
 * out of a surface's elements, and hands a reader's output straight back.
 */

/* ── OWM (semantic) ───────────────────────────────────────────────────── */

/**
 * The OnlineWardleyMaps DSL. **Semantic** — the file carries a model, not a
 * picture: a `[visibility, evolution]` pair IS a position on the value chain
 * and on the evolution axis, so the whole preservation contract applies and the
 * import needs no invented axis (P2, and D4's "a format that carries
 * coordinates but no pixels").
 *
 * `text/plain`, because that is what a DSL is, and `.owm` first — it is the
 * extension a download is given. `.wm` rides behind it: the same bytes are
 * written under both in the wild, and a picker that refused one would refuse a
 * valid map for the sake of a filename. What the file actually IS is decided by
 * the reader.
 *
 * The two directions share the FORMAT object, deliberately. `owm` is the id
 * under which foreign matter rides on an element (D2), so a reader and a writer
 * that disagreed about it would write payloads the other could not find.
 */
export const WARDLEY_OWM_EXTENSION = '.owm';
export const WARDLEY_OWM_MIME = 'text/plain';

export const WARDLEY_OWM_FORMAT: InterchangeFormat = {
  id: WARDLEY_OWM_FORMAT_ID,
  tier: 'semantic',
  extensions: [WARDLEY_OWM_EXTENSION, '.wm'],
  mime: WARDLEY_OWM_MIME,
};

/**
 * The board as an OWM document.
 *
 * A thin adapter and nothing else: it picks the Wardley artefacts out of the
 * surface, names the file, and passes the writer's losses straight through.
 * There is no second door — `wardley.exportOwm` calls THIS, so the command and
 * the registry cannot produce different bytes, filenames or warnings.
 *
 * `warnings` is omitted rather than empty when the map came out whole, so a
 * caller can ask `if (result.warnings)` and mean it.
 */
const runWardleyOwmExport: InterchangeExporter = (elements, context) => {
  const name = wardleySafeFilename(context.name);
  const { text, warnings } = exportWardleyOwmWithWarnings(
    wardleyBoardFrom(elements),
    { name }
  );
  return {
    text,
    filename: `${name}${WARDLEY_OWM_EXTENSION}`,
    mime: WARDLEY_OWM_MIME,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};

/** `wardley:owm:export` — the row that replaces labre-mcp's own serializer. */
export const WARDLEY_OWM_EXPORT: InterchangeExportCapability = {
  id: interchangeCapabilityId('wardley', WARDLEY_OWM_FORMAT.id, 'export'),
  framework: 'wardley',
  format: WARDLEY_OWM_FORMAT,
  direction: 'export',
  run: runWardleyOwmExport,
};

/** `wardley:owm:import` — an `.owm` file as a map. */
export const WARDLEY_OWM_IMPORT: InterchangeImportCapability = {
  id: interchangeCapabilityId('wardley', WARDLEY_OWM_FORMAT.id, 'import'),
  framework: 'wardley',
  format: WARDLEY_OWM_FORMAT,
  direction: 'import',
  run: importWardleyOwm,
};

/* ── SVG (visual) ─────────────────────────────────────────────────────── */

/**
 * SVG. **Visual** — the file carries a rendering, not a model, so it makes
 * exactly one promise: the picture arrives as editable elements.
 *
 * Wardley's own format object, and NOT one shared with BPMN's, because ADR 0012
 * rejects "one capability per format, with the framework inferred from the
 * file": a `.svg` is read by several frameworks, and deciding which one a
 * picture is a picture OF is the guess this platform refuses everywhere else.
 * The three constants are the parser package's, so the declarations cannot
 * drift into filtering a picker on different extensions.
 */
export const WARDLEY_SVG_FORMAT: InterchangeFormat = {
  id: SVG_SKETCH_FORMAT_ID,
  tier: 'visual',
  extensions: [SVG_SKETCH_EXTENSION],
  mime: SVG_SKETCH_MIME,
};

/**
 * `wardley:svg:import` — an SVG as the Wardley map it is a picture of, and
 * whatever else it holds as a sketch (ADR 0032).
 *
 * **The heuristics statement this capability owes (ADR 0012, open question 2)
 * is the module documentation of `./svg-import.ts`**, beside the parser that
 * makes the guesses: ADR 0032 superseded, for Wardley only, the rule that a
 * visual capability guesses geometry and nothing else. A picture from a
 * producer the reader recognises arrives as native Wardley elements; the rest
 * of it — and the whole of a picture nobody recognises — arrives as the same
 * level-1 sketch BPMN's reader draws (`parseSvgSketch`, which BPMN still
 * declares). Still the visual tier: no payload, no round-trip, and
 * {@link WARDLEY_OWM_IMPORT} beside it stays the reference Wardley import.
 */
export const WARDLEY_SVG_IMPORT: InterchangeImportCapability = {
  id: interchangeCapabilityId('wardley', WARDLEY_SVG_FORMAT.id, 'import'),
  framework: 'wardley',
  format: WARDLEY_SVG_FORMAT,
  direction: 'import',
  run: importWardleySvg,
};

/* ── The list the view extension registers ────────────────────────────── */

/** Everything Wardley registers, in one list the view extension hands over. */
export const WARDLEY_INTERCHANGE: readonly InterchangeCapability[] = [
  WARDLEY_OWM_EXPORT,
  WARDLEY_OWM_IMPORT,
  WARDLEY_SVG_IMPORT,
];
