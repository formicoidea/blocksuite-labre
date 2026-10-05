import FULL_OWM_TEXT from './corpus/svg/full.owm?raw';
import FULL_LABRE_SVG from './corpus/svg/full.labre.svg?raw';
import HEURISTIC_SVG from './corpus/svg/heuristic.vector-editor.svg?raw';
import HOSTILE_SVG from './corpus/svg/hostile.onlinewardleymaps.svg?raw';
import FULL_OWM_SVG from './corpus/svg/full.onlinewardleymaps.svg?raw';
import MIXED_OWM_SVG from './corpus/svg/mixed.onlinewardleymaps.svg?raw';
import NOT_A_MAP_SVG from './corpus/svg/not-a-map.bpmn-io.svg?raw';
import SMALL_LABRE_SVG from './corpus/svg/small.labre.svg?raw';
import SMALL_OWM_TEXT from './corpus/svg/small.owm?raw';
import SMALL_OWM_SVG from './corpus/svg/small.onlinewardleymaps.svg?raw';
import SMALL_RENDERER_SVG from './corpus/svg/small.wardley-map-renderer.svg?raw';
import SMALL_RENDERER_LIVE_SVG from './corpus/svg/small.wardley-map-renderer-interactive.svg?raw';
import TEA_SHOP_LABRE_SVG from './corpus/svg/tea-shop.labre.svg?raw';
import TEA_SHOP_OWM_SVG from './corpus/svg/tea-shop.onlinewardleymaps.svg?raw';
import TEA_SHOP_OWM_TEXT from './corpus/svg/tea-shop.owm?raw';
import TEA_SHOP_RENDERER_SVG from './corpus/svg/tea-shop.wardley-map-renderer.svg?raw';
import TEA_SHOP_RENDERER_LIVE_SVG from './corpus/svg/tea-shop.wardley-map-renderer-interactive.svg?raw';

/**
 * The Wardley SVG corpus (ADR 0032 §9), checked in BYTE FOR BYTE as each
 * producer wrote it — the one exception is named below.
 *
 * ## Where every file came from
 *
 * - `*.onlinewardleymaps.svg` — OnlineWardleyMaps frontend 1.117.0 (commit
 *   `a1dc4f81`), its own `MapView` rendered in jsdom from the `.owm` text
 *   beside it (`UnifiedConverter` → `MapView`, map size 800 × 600, the
 *   `Plain` style), then its own `downloadMapAsSVG` steps applied to the
 *   rendered DOM (`MapEnvironment.tsx`: the pan-and-zoom group cloned, its
 *   matrix removed, wrapped in `translate(35, 45)`). Nothing was edited by
 *   hand. The tea-shop map is `TEA_SHOP_OWM` (`owm-corpus.ts`).
 * - `mixed.onlinewardleymaps.svg` — the small OWM export, plus what a person
 *   adds in a vector editor after exporting: a logo (a rect and its text) and
 *   a hand-drawn remark (a path and a text), as siblings of the exported map.
 *   The one file EDITED by hand, and only by appending those four nodes.
 * - `hostile.onlinewardleymaps.svg` — WRITTEN by hand, strictly in the shape
 *   of an OnlineWardleyMaps export, to carry everything ADR 0032 §7 refuses
 *   to act on: a `<script>`, an `onload` and an `onclick`, a
 *   `<foreignObject>`, a `<use>`, ids `__proto__` and `<script>`, markup in a
 *   name, and coordinates that are not finite numbers.
 * - `heuristic.vector-editor.svg` — WRITTEN by hand in the shape an Inkscape
 *   drawing has (layers as groups, paths with absolute, relative and implicit
 *   line-tos, styles in `style`), from a known map: five components at the
 *   `[visibility, evolution]` pairs of `HEURISTIC_OWM` below, four straight
 *   dependencies, and the things the heuristic must NOT promote — a curved
 *   link, a dashed red arrow, a thick bar, a pipeline-like rect, a circle with
 *   no name, a legend dot outside the plot.
 * - `*.labre.svg` — Labre's own board export (ADR 0025, with the ADR 0032 §6
 *   markers), written by `renderBoardSvg` in the integration suite's real
 *   editor from the `.owm` text beside it laid out by `importWardleyOwm`,
 *   every part switched on. Nothing edited by hand; element ids are the
 *   nanoids that editor minted.
 * - `not-a-map.bpmn-io.svg` — WRITTEN by hand in bpmn.io's export shape (a
 *   pool, two events, a task, two flows): a picture that is not a map and
 *   must yield NO native element.
 * - `*.wardley-map-renderer.svg` / `…-interactive.svg` — wardley-map-renderer
 *   1.0.0-beta.5 (commit `bfe11ad`), `render(map, { format: 'svg' })` and the
 *   same with `renderOptions: { interactive: true }`, from the JSON
 *   equivalent of the same maps (the renderer's visibility is `1 − OWM's`).
 *   The renderer draws no notes, so the small map's two notes are absent.
 *
 * The `.owm` texts are the source each producer drew from, and the reference
 * the SVG reader is measured against: the SVG of a map must import to the
 * same map as its OWM text.
 */
/** The map `heuristic.vector-editor.svg` was drawn from, plot `[60, 30, 700, 410]`. */
export const HEURISTIC_OWM = `component Customer [0.95, 0.70]
component Online shop [0.80, 0.55]
component Payment [0.55, 0.85]
component Catalogue [0.50, 0.40]
component Hosting [0.20, 0.90]
Customer->Online shop
Online shop->Payment
Online shop->Catalogue
Catalogue->Hosting
`;

export const SVG_CORPUS = {
  smallOwmText: SMALL_OWM_TEXT,
  fullOwmText: FULL_OWM_TEXT,
  smallOwm: SMALL_OWM_SVG,
  fullOwm: FULL_OWM_SVG,
  teaShopOwm: TEA_SHOP_OWM_SVG,
  mixedOwm: MIXED_OWM_SVG,
  hostile: HOSTILE_SVG,
  heuristic: HEURISTIC_SVG,
  notAMap: NOT_A_MAP_SVG,
  teaShopOwmText: TEA_SHOP_OWM_TEXT,
  smallLabre: SMALL_LABRE_SVG,
  teaShopLabre: TEA_SHOP_LABRE_SVG,
  fullLabre: FULL_LABRE_SVG,
  smallRenderer: SMALL_RENDERER_SVG,
  smallRendererLive: SMALL_RENDERER_LIVE_SVG,
  teaShopRenderer: TEA_SHOP_RENDERER_SVG,
  teaShopRendererLive: TEA_SHOP_RENDERER_LIVE_SVG,
} as const;
