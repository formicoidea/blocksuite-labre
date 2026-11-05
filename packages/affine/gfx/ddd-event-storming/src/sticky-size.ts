import { STICKY_SIZE } from '@labre/affine-gfx-ddd-shared/headless';

/**
 * The aggregate is created BIG — 160 against the standard 120.
 *
 * Size is half of how the notation distinguishes it: on a real wall the
 * aggregate is the large pale sticky a run of commands lands on, and the
 * colour ladder in `ES_STICKIES` carries the other half. Declared here rather
 * than in the shared palette because it is a FORMAT, not a colour: the palette
 * says which yellow, the toolbox says how big.
 *
 * Its own module, editor-free, so the toolbox (`toolbox.ts`, `docs/adr/0045`)
 * builds a host's aggregate at the size the toolbar places it at; it lived in
 * `commands.ts`, which imports the editor.
 */
export const AGGREGATE_SIZE = 160;

/**
 * The hotspot is created at 180, so its name fits the diamond (rule R38,
 * ADR 0029 amendment of 2026-11-04).
 *
 * A diamond only offers the rectangle inscribed in it, half of each side: at
 * the standard 120 that leaves 40 units for two lines of Kalam 20, and the
 * `Contained` fit shrank the seed to keep it in. Two lines need about 140;
 * 180 holds the seed "Hotspot" (≈ 70 units) at its own size with room for a
 * second word. Existing hotspots keep their 120 (nothing is migrated), and a
 * morph never resizes (`morph.ts`), so a sticky morphed into a hotspot keeps
 * its size too.
 */
export const HOTSPOT_SIZE = 180;

/** The side of a sticky of `kind` as the toolbar places it. */
export function eventStormingStickySize(kind: string): number {
  if (kind === 'aggregate') return AGGREGATE_SIZE;
  if (kind === 'hotspot') return HOTSPOT_SIZE;
  return STICKY_SIZE;
}
