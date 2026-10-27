/**
 * `@labre/affine-gfx-ddd-shared/headless` — the DDD tables and the pure
 * element builders, with no editor behind them (`docs/adr/0045`): what a
 * board's `./interchange` toolbox builds a sticky, a bubble, a dot, a marker,
 * a cloud or a relationship from. The package index re-exports every one of
 * these unchanged.
 *
 * Held by `interchange-headless.unit.spec.ts` in `packages/affine/all`: add
 * only from files that import nothing but the headless entries of core
 * (`@labre/global`, `@labre/affine-model/headless`,
 * `@labre/affine-shared/headless`, `@labre/affine-block-surface/interchange`).
 */
export * from './shared/consts.js';
export * from './shared/elements.js';
