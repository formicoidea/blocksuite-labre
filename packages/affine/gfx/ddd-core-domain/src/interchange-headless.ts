/**
 * `./interchange` — the Core Domain Chart with no editor behind it (ADR 0012,
 * P3 as amended 2026-10-14): its toolbar as pure builders (`docs/adr/0045`),
 * so a host with no editor (the Labre workspace connector, labre-mcp) places
 * the very chart, sub-domain dots, Team Topologies markers and movements a
 * user places from the toolbar. Held by `interchange-headless.unit.spec.ts` in
 * `packages/affine/all`, which bundles this entry and fails on any editor
 * module in its graph.
 */
export {
  CORE_DOMAIN_TOOLBOX,
  coreDomainChartElement,
  coreDomainMarkerElements,
  coreDomainMovementElement,
  coreDomainMovementStyle,
  coreDomainSubdomainElements,
} from './toolbox.js';
