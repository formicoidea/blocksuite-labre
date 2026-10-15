/**
 * Constants moved out of the element-class files of this folder, unchanged, so
 * the model's headless entry (`@labre/affine-model/headless`) exports them
 * without `@labre/std/gfx` behind them (ADR 0012, P3 as amended 2026-10-14).
 * The folder index re-exports this file.
 */

/**
 * Width of the participant band — the left margin strip the pool name is
 * written up, in model units.
 *
 * Declared HERE, in the model, and re-exported by `@labre/affine-gfx-bpmn`
 * rather than the other way round. The pool's own hit test needs it (a pool is
 * clickable by its title bands as well as its border, the bpmn.io convention),
 * and `affine-model` cannot reach into `affine-block-surface` where the
 * declaration is resolved. One number, owned by the layer that both the
 * declaration and the hit test can read.
 */
export const POOL_BAND_WIDTH = 28;

/**
 * Width of a lane's own title band — the strip immediately inside the
 * participant band, with the lane name turned on its side.
 *
 * Four units narrower than {@link POOL_BAND_WIDTH}, and for the same reason the
 * lane font is two points smaller: the two strips sit side by side, so the
 * subordinate one has to say so. Identical widths read as a single 56-unit
 * gutter rather than as a participant containing lanes, which is exactly the
 * relationship the picture has to carry.
 *
 * NO fill, divider only — what bpmn.io, Camunda and Visio all draw.
 */
export const POOL_LANE_BAND_WIDTH = 24;
