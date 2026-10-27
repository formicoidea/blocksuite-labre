/**
 * `@labre/affine-gfx-cynefin-estuarine/interchange` — Cynefin and estuarine
 * mapping with no editor behind them.
 *
 * The framework declares no file format. What a host without an editor uses
 * is its toolbar as pure builders (`docs/adr/0045`): the elements a user
 * places from the toolbar, for a server or an MCP tool to place the same ones.
 *
 * Held by `interchange-headless.unit.spec.ts` in `packages/affine/all`.
 */
export {
  constraintHexagonElement,
  CYNEFIN_ESTUARINE_TOOLBOX,
  cynefinElement,
  estuarineMapElement,
} from './toolbox.js';
