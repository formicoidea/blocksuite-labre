// Its own module so the headless interchange entry (`./interchange`) can read
// it without the legend's editor graph (ADR 0012, P3 as amended 2026-10-14).

/**
 * The role the legend's GROUP carries — the one thing on a generated legend
 * that says what it is.
 *
 * Its glyphs deliberately carry none (see {@link addShape}), which is what
 * keeps a legend out of the scan and out of every validation rule. But "made of
 * nothing in particular" is unreadable to anything that has to tell a legend
 * from a drawing, and something does: the `.bpmn` export counts what it left
 * behind inside a pool, and a legend's fourteen glyphs would be reported as
 * fourteen losses. The wrapper says so instead, once, structurally — no title
 * to match on, no framework name, no geometry.
 *
 * `core:` because it belongs to no framework: no `RoleDefs` declares it, so
 * `roleIsA` matches it against nothing, no rule evaluates it and no legend row
 * lights because of it. Nothing is backfilled, as ever — a legend drawn before
 * this shipped carries no role and is not recognised.
 */
export const LEGEND_ROLE = 'core:legend';
