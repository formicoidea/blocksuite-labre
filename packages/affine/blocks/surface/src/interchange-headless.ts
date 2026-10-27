/**
 * `@labre/affine-block-surface/interchange` — the interchange platform with no
 * editor behind it (ADR 0012, P3 as amended 2026-10-14).
 *
 * The registry's types and helpers, `InterchangeImportError`, the generic SVG
 * reader, the framework-background geometry and the constants a framework's
 * reader shares with the editor. What
 * is NOT here is the point: the graph of this entry imports no Lit, no
 * `@atlaskit/pragmatic-drag-and-drop`, no `@labre/std` runtime and no block —
 * so a server (the labre import function, labre-mcp) loads the readers in a
 * few hundred kilobytes instead of the whole editor.
 *
 * Held by `interchange-headless.unit.spec.ts` in `packages/affine/all`, which
 * bundles this entry and every framework's `./interchange` and fails on any
 * forbidden module in the graph. A new export here is a new edge in that
 * graph: import it from a file that is itself editor-free, never from the
 * package index.
 */
export * from './extensions/export-svg/marker-version.js';
export * from './extensions/interchange.js';
export * from './extensions/toolbox.js';
export * from './extensions/legend-label.js';
export * from './extensions/legend-role.js';
export * from './extensions/svg-sanitize.js';
export * from './extensions/svg-sketch.js';
export * from './extensions/svg-sketch-translations.js';
export * from './extensions/xml-element.js';
export * from './extensions/xml-reader.js';
// The board geometry an exporter and a reader both compute with: a
// background's declaration, its plot and its instance zones. Pure data and
// arithmetic, editor-free like the rest.
export * from './framework-background/def.js';
export * from './framework-background/facts.js';
export * from './framework-background/labels.js';
