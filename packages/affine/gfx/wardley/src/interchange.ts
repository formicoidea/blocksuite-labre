import type {
  InterchangeCapability,
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

/**
 * Wardley's entries in the interchange registry (`docs/adr/0012`, P1).
 *
 * One row today — SVG IN, the visual-tier fallback. The OWM DSL, which the
 * roadmap calls the **reference** Wardley import and which today lives outside
 * this repo in labre-mcp, is the semantic route and lands here beside this one:
 * this file is deliberately laid out as one section per FORMAT, each holding
 * its format object then its capabilities, with {@link WARDLEY_INTERCHANGE} at
 * the bottom collecting them. A format is added by adding a section, not by
 * editing one.
 *
 * Everything here is pure: a capability is a declaration plus a function of a
 * string, so labre-mcp calls the same reader the editor command calls and
 * neither needs the other (P3).
 */

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
 * inventing a position and presenting it as read. When the OWM route lands
 * beside this one it is the one a user should be pointed at, exactly as P2
 * says.
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
  WARDLEY_SVG_IMPORT,
];
