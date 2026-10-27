/**
 * `./interchange` — the Context Map with no editor behind it (ADR 0012, P3 as
 * amended 2026-10-14): its toolbar as pure builders (`docs/adr/0045`), so a
 * host with no editor (the Labre workspace connector, labre-mcp) places the
 * very board, bounded contexts, clouds and relationships a user places from
 * the toolbar. Held by `interchange-headless.unit.spec.ts` in
 * `packages/affine/all`, which bundles this entry and fails on any editor
 * module in its graph.
 */
export {
  CONTEXT_MAP_TOOLBOX,
  contextMapBoardElement,
  contextMapContextElement,
  contextMapRelationshipElement,
  contextMapRelationshipStyle,
  contextMapSystemElements,
} from './toolbox.js';
