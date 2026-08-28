import type {
  InterchangeCapability,
  InterchangeExportCapability,
  InterchangeExporter,
  InterchangeFormat,
  InterchangeImportCapability,
} from '@labre/affine-block-surface';
import {
  interchangeCapabilityId,
  parseSvgSketch,
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
 * FALLBACK, which promises recognition and nothing else.
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
 * `wardley:svg:import` — an SVG as a sketch, best effort.
 *
 * **The heuristics statement and the known failure modes this capability owes
 * (ADR 0012, open question 2) are the module documentation of
 * `packages/affine/blocks/surface/src/extensions/svg-sketch.ts`.** Written once
 * there because Wardley and BPMN wrap the SAME parser and therefore make the
 * same guesses — and because the ADR's question is about what a visual
 * capability is ALLOWED to guess, which for both of them is: geometry, and
 * nothing else. A circle is a circle; whether it is a component is the
 * author's sentence, not this reader's.
 *
 * What lands is an ADR 0007 level-1 sketch — plain shapes, brush strokes and
 * editable free text — which the author then PROMOTES onto a map. In
 * particular the two axes and the evolution bands are NOT recovered: a map's
 * coordinates are its meaning, and reading them off a picture would be
 * inventing a position and presenting it as read. {@link WARDLEY_OWM_IMPORT}
 * beside it is the route a user should be pointed at, exactly as P2 says —
 * this one is for the picture somebody sent you from a tool that writes no OWM.
 */
export const WARDLEY_SVG_IMPORT: InterchangeImportCapability = {
  id: interchangeCapabilityId('wardley', WARDLEY_SVG_FORMAT.id, 'import'),
  framework: 'wardley',
  format: WARDLEY_SVG_FORMAT,
  direction: 'import',
  run: parseSvgSketch,
};

/* ── The list the view extension registers ────────────────────────────── */

/** Everything Wardley registers, in one list the view extension hands over. */
export const WARDLEY_INTERCHANGE: readonly InterchangeCapability[] = [
  WARDLEY_OWM_EXPORT,
  WARDLEY_OWM_IMPORT,
  WARDLEY_SVG_IMPORT,
];
