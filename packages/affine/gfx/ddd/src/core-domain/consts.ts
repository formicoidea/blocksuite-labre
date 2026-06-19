/**
 * Visual constants for the Core Domain Chart background (DDD Crew). Authored in
 * a fixed reference space (900 × 820) and scaled uniformly to the element bounds
 * by the renderer. Reproduces the supplied template: two axes (Complexity ×
 * Business differentiation), Low/High ticks and the translucent Generic /
 * Supporting / Core zone bands. The "Notation" legend is a separate prefab group.
 */

export const REF_W = 900;
export const REF_H = 820;

export const COLORS = {
  axis: '#000000',
  zoneLabel: '#ffffff',
  tick: '#777777',
  title: '#000000',
} as const;

/** Translucent zone bands (drawn at 0.6 alpha), back-to-front. */
export const ZONES: ReadonlyArray<{
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}> = [
  { x: 70, y: 30, w: 150, h: 720, fill: '#b3b3b3' },
  { x: 220, y: 30, w: 220, h: 720, fill: '#9933ff' },
  { x: 440, y: 30, w: 400, h: 360, fill: '#4d9900' },
  { x: 440, y: 390, w: 400, h: 360, fill: '#9933ff' },
];

/** Zone names (centred): [text, x, y, fontSize]. */
export const ZONE_LABELS: ReadonlyArray<readonly [string, number, number, number]> = [
  ['Core', 640, 214, 26],
  ['Supporting', 340, 474, 20],
  ['Generic', 150, 474, 20],
];

/** Axis frame: origin (ox, oy) bottom-left, up to `top`, right to `right`. */
export const AXIS = { ox: 60, oy: 770, top: 24, right: 846 } as const;
