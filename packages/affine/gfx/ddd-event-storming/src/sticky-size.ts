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

/** The side of a sticky of `kind` as the toolbar places it. */
export function eventStormingStickySize(kind: string): number {
  return kind === 'aggregate' ? AGGREGATE_SIZE : STICKY_SIZE;
}
