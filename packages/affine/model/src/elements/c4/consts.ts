/**
 * Constants moved out of the element-class files of this folder, unchanged, so
 * the model's headless entry (`@labre/affine-model/headless`) exports them
 * without `@labre/std/gfx` behind them (ADR 0012, P3 as amended 2026-10-14;
 * the C4 toolbox of `docs/adr/0045` reads the board's metrics from there).
 * The folder index re-exports this file.
 */

/**
 * Height of the board's title band — the header strip across the top of the
 * sheet the diagram title is written in, in model units.
 *
 * Declared HERE, in the model, and re-exported by `@labre/affine-gfx-c4` rather
 * than the other way round, for the reason `POOL_BAND_WIDTH` is: the
 * board's own hit test needs it (a board is clickable by its title band as well
 * as its border), and `affine-model` cannot reach into `affine-block-surface`
 * where the declaration is resolved. One number, owned by the layer that both
 * the declaration and the hit test can read.
 *
 * It is the board's TOP MARGIN, and it always was — the deep inset the plot
 * gives up so the title has somewhere to be written. Naming it says out loud
 * what was already true, so the strip that is painted, the strip that is picked
 * and the strip that opens the rename are one number rather than three.
 *
 * 56 is what the title has been written in since the pack shipped: a 20-unit
 * title, sitting on a baseline a third of the band up from its foot, with the
 * rest as breathing room above and below. Changing it moves the title, so it is
 * a visual decision and not a hit-test one.
 */
export const C4_BOARD_TITLE_BAND_HEIGHT = 56;
