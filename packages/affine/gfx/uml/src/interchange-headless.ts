/**
 * `@labre/affine-gfx-uml/interchange` — UML's whole interchange, with no editor
 * behind it (ADR 0012, P3 as amended 2026-10-14).
 *
 * Every UML capability is pure on plain data — the exporters read structural
 * records (`umlModelsFrom` picks by `type`, never by `instanceof`) — so this
 * entry is the registry list itself, plus `decodeDrawio`, the container step a
 * server runs before `uml:drawio:import` (capped, `DRAWIO_MAX_INFLATED_BYTES`).
 *
 * Held by `interchange-headless.unit.spec.ts` in `packages/affine/all`.
 */
export * from './drawio-decode.js';
export * from './interchange.js';

// The toolbar as pure builders (`docs/adr/0045`): what a host with no editor
// places to draw the very elements a user places from the toolbar.
export {
  UML_TOOLBOX,
  umlFrameElement,
  type UmlFrameOptions,
  umlNodeElements,
  type UmlNodeTexts,
  umlRelationElement,
} from './toolbox.js';
