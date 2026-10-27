import type {
  InterchangeFormat,
  InterchangeImportCapability,
} from '@labre/affine-block-surface/interchange';
import {
  interchangeCapabilityId,
  SVG_SKETCH_EXTENSION,
  SVG_SKETCH_FORMAT_ID,
  SVG_SKETCH_MIME,
} from '@labre/affine-block-surface/interchange';

import { WARDLEY_OWM_FORMAT_ID } from './export.js';
import { importWardleyOwm } from './import.js';
import { importWardleySvg } from './svg-import.js';

/**
 * `@labre/affine-gfx-wardley/interchange` — Wardley's formats and its two
 * READERS, with no editor behind them (ADR 0012, P3 as amended 2026-10-14).
 *
 * What a server needs to read an `.owm` or an `.svg` as a map: the format
 * declarations and the import capabilities, whose `run` is a pure function of
 * text. The OWM EXPORT capability is not here: it picks the artefacts out of
 * live element models (`wardleyBoardFrom`, by `instanceof`), which is the
 * editor graph this entry exists to leave out. It stays in `interchange.ts`,
 * which re-exports everything below. The serializer itself
 * (`exportWardleyOwm`) is editor-free and stays on the package index.
 *
 * Held by `interchange-headless.unit.spec.ts` in `packages/affine/all`.
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

// The toolbar as pure builders (`docs/adr/0045`): what a host with no editor
// places to draw the very elements a user places from the toolbar.
export {
  WARDLEY_AXIS_SEED,
  WARDLEY_TOOLBOX,
  wardleyAreaElement,
  wardleyChangeArrowElement,
  wardleyDependencyElement,
  wardleyInertiaElement,
  wardleyMapElement,
  type WardleyMapTexts,
  wardleyMarketElements,
  type WardleyNodeItemKind,
  wardleyNodeElements,
  wardleyPipelineElements,
  wardleyPorterElements,
} from './toolbox.js';
