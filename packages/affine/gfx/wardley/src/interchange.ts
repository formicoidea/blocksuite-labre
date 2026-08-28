import type {
  InterchangeCapability,
  InterchangeExportCapability,
  InterchangeExporter,
  InterchangeFormat,
  InterchangeImportCapability,
} from '@labre/affine-block-surface';
import { interchangeCapabilityId } from '@labre/affine-block-surface';

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
 * Both directions of one format, declared as two capabilities. The export is
 * the row the ADR records as **owed**: a Wardley serializer exists today in
 * labre-mcp, outside this repo, and is the one violation of P3 the ADR names.
 * It exists here now, so that repo becomes a caller and its copy is deleted.
 * The import is the row the ADR calls **the reference Wardley import** — the
 * OWM DSL is the settled Wardley vocabulary, and mermaid's Wardley diagram type
 * is still experimental upstream.
 *
 * They share the FORMAT object, deliberately. `owm` is the id under which
 * foreign matter rides on an element (D2), so a reader and a writer that
 * disagreed about it would write payloads the other could not find.
 *
 * Everything here is pure. Neither half has ever had a `std` in sight, and this
 * file adds no editor to either: it picks the artefacts the writer speaks about
 * out of a surface's elements, and hands the reader's output straight back.
 */

/* ── The format ───────────────────────────────────────────────────────── */

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
 */
export const WARDLEY_OWM_EXTENSION = '.owm';
export const WARDLEY_OWM_MIME = 'text/plain';

export const WARDLEY_OWM_FORMAT: InterchangeFormat = {
  id: WARDLEY_OWM_FORMAT_ID,
  tier: 'semantic',
  extensions: [WARDLEY_OWM_EXTENSION, '.wm'],
  mime: WARDLEY_OWM_MIME,
};

/* ── The capabilities ─────────────────────────────────────────────────── */

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

/** Everything Wardley registers, in one list the view extension hands over. */
export const WARDLEY_INTERCHANGE: readonly InterchangeCapability[] = [
  WARDLEY_OWM_EXPORT,
  WARDLEY_OWM_IMPORT,
];
