import type {
  InterchangeCapability,
  InterchangeExportCapability,
  InterchangeExporter,
} from '@labre/affine-block-surface';
import { interchangeCapabilityId } from '@labre/affine-block-surface';

import { exportWardleyOwmWithWarnings, wardleySafeFilename } from './export.js';
import { wardleyBoardFrom } from './export-board.js';
import {
  WARDLEY_OWM_EXTENSION,
  WARDLEY_OWM_FORMAT,
  WARDLEY_OWM_IMPORT,
  WARDLEY_OWM_MIME,
  WARDLEY_SVG_IMPORT,
} from './interchange-headless.js';

export {
  WARDLEY_OWM_EXTENSION,
  WARDLEY_OWM_FORMAT,
  WARDLEY_OWM_IMPORT,
  WARDLEY_OWM_MIME,
  WARDLEY_SVG_FORMAT,
  WARDLEY_SVG_IMPORT,
} from './interchange-headless.js';

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
 * The formats and the two import capabilities live in
 * `interchange-headless.ts` (the package's editor-free `./interchange` entry)
 * and are re-exported above; this file adds the export capability, which
 * reads live element models, and {@link WARDLEY_INTERCHANGE} collecting them.
 *
 * Everything here is pure. No half has ever had a `std` in sight, and this file
 * adds no editor to any of them: it picks the artefacts the writer speaks about
 * out of a surface's elements, and hands a reader's output straight back.
 */

/* ── OWM (semantic) ───────────────────────────────────────────────────── */

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

/* ── The list the view extension registers ────────────────────────────── */

/** Everything Wardley registers, in one list the view extension hands over. */
export const WARDLEY_INTERCHANGE: readonly InterchangeCapability[] = [
  WARDLEY_OWM_EXPORT,
  WARDLEY_OWM_IMPORT,
  WARDLEY_SVG_IMPORT,
];
