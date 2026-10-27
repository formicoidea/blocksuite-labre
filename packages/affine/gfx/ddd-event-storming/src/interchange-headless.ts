/**
 * `./interchange` — Event Storming with no editor behind it (ADR 0012, P3 as
 * amended 2026-10-14): its toolbar as pure builders (`docs/adr/0045`), so a
 * host with no editor (the Labre workspace connector, labre-mcp) places the
 * very board, stickies, hotspots and flows a user places from the toolbar.
 * Held by `interchange-headless.unit.spec.ts` in `packages/affine/all`, which
 * bundles this entry and fails on any editor module in its graph.
 */
export { AGGREGATE_SIZE } from './sticky-size.js';
export {
  EVENT_STORMING_TOOLBOX,
  eventStormingBoardElement,
  eventStormingFlowElement,
  eventStormingFlowStyle,
  eventStormingStickyElements,
  eventStormingStickyOpts,
} from './toolbox.js';
