/**
 * `@labre/affine-model/headless` — the model's data with no element class
 * behind it: the enums and constants every surface element is written with,
 * and the pure geometry an interchange reader computes with (ADR 0012, P3 as
 * amended 2026-10-14).
 *
 * The package index re-exports every one of these unchanged; this entry
 * exists for a caller that must not load `@labre/std/gfx` (and with it Lit and
 * the drag-and-drop adapter): the headless `./interchange` entries of the
 * framework bundles. Held by `interchange-headless.unit.spec.ts` in
 * `packages/affine/all`. Add only from files that import nothing but
 * `@labre/global` and types.
 */
export * from './consts/index.js';
export * from './elements/bpmn/consts.js';
export * from './elements/c4/consts.js';
export * from './elements/connector/end-label.js';
export { DEFAULT_POLYGON_VERTICES } from './elements/shape/api/polygon.js';
export * from './elements/uml/consts.js';
export * from './elements/uml/lifeline.js';
