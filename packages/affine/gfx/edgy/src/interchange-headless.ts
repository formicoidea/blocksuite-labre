/**
 * `@labre/affine-gfx-edgy/interchange` — EDGY with no editor behind it.
 *
 * EDGY declares no file format. What a host without an editor uses is its
 * toolbar as pure builders (`docs/adr/0045`): the elements a user places from
 * the toolbar, for a server or an MCP tool to place the same ones.
 *
 * Held by `interchange-headless.unit.spec.ts` in `packages/affine/all`.
 */
export {
  EDGY_FACETS_SIZE,
  EDGY_PEOPLE_SIZE,
  EDGY_TOOLBOX,
  edgyBoardElement,
  edgyBoxElement,
  edgyFacetsElement,
  type EdgyFacetsTexts,
  edgyPeopleElements,
  edgyRelationElement,
} from './toolbox.js';
