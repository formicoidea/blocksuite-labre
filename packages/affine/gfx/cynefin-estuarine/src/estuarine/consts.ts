import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * Visual constants for the Estuarine framework map, reproduced from the official
 * SVG (viewBox 0 0 690 801). All geometry is authored in that fixed space; the
 * renderer reads every coordinate below as a RATIO of the CROPPED window onto
 * it ({@link REF_X} … {@link REF_H}) and maps it onto the element's real width
 * and height independently, so a stretched map gets a longer time axis and a
 * taller energy axis rather than the same drawing letterboxed (see
 * `EstuarineFit` in `./element-renderer.ts`). The e axis is vertical &
 * double-headed (energy), the t axis horizontal & single-headed (time only
 * flows one way).
 *
 * The three curve legends below (`LABELS`) carry a `wording`, resolved by
 * `element-renderer.ts` through the `CanvasRenderer` it is handed at paint
 * time — see `cynefin/consts.ts` for the identical mechanism next door. The
 * italic `e` / `t` axis LETTERS (`AXIS_LABELS`) are notation, not words, and
 * are deliberately NOT keyed (PO decision).
 */

/**
 * The CROPPED window onto the authored 690 × 801 SVG space — the rectangle the
 * element's bounds are mapped onto.
 *
 * The SVG's own viewBox is loose around the drawing: the t axis stops at
 * `x = 616 / 690` and the e axis at `y = 763 / 801`, so a board born on the raw
 * viewBox carried dead space on every side (measured on the painted pixels at
 * birth size: 16.6 left, 12.6 top, 35.5 right, 20.4 bottom, in model units).
 * The board's own border is therefore nowhere near its drawing, which is both
 * ugly and awkward — a background is grabbed BY that border
 * (`framework-background/hit-test.ts`).
 *
 * So the reference box is the ink's bounding box grown by {@link REF_MARGIN},
 * not the viewBox. `REF_X` / `REF_Y` is where that window starts in authored
 * coordinates; every authored number in this file keeps its ORIGINAL value and
 * the renderer subtracts the origin (`ax` / `ay`), so nothing about the drawing
 * moves relative to anything else — only the frame around it tightens.
 *
 * `MAP_SCALE` (see `../presets.ts`) multiplies these, so a new board is born
 * smaller while its drawing keeps exactly the size it had.
 */
export const REF_X = 8;
export const REF_Y = 4.5;
export const REF_W = 659;
export const REF_H = 786.5;

/**
 * Space left between the ink and the edge of the board, in reference units.
 *
 * Small but not zero: a stroke is centred on its path, a glyph is measured
 * generously, and a board whose ink touched its own border would look clipped.
 * ~6 units is a little under one axis width (8) — enough to read as a margin,
 * little enough that the border is visibly AROUND the drawing.
 */
export const REF_MARGIN = 6;

export const COLORS = {
  axis: '#941253',
  /** Italic e / t axis letters. */
  axisLabel: '#c0392b',
  liminal: '#5ecc44',
  /** LIMINAL legend (darker than the curve). */
  liminalLabel: '#2e7d32',
  volatile: '#e63322',
  counterfactual: '#1a1a1a',
  /** VOLATILE + COUNTER FACTUAL legends. */
  label: '#1a1a1a',
} as const;

/** e axis (vertical, double-headed): x, top y, bottom y. */
export const E_AXIS = { x: 43.5, y1: 97, y2: 763 } as const;
/** t axis (horizontal, single-headed → right): y, left x, right x. */
export const T_AXIS = { y: 649, x1: 28, x2: 616 } as const;
export const AXIS_WIDTH = 8;

/**
 * A filled arrowhead, welded to the END OF ITS AXIS.
 *
 * Declared the way the shared primitive declares one (`drawAxis`,
 * `blocks/surface/src/framework-background/renderer.ts`): the head has ONE
 * proportional anchor — {@link at}, the point where its axis stops, which
 * travels with the stretch — and every other number below is an offset from
 * that anchor in FIXED units, painted at the isotropic `strokeScale`.
 *
 * That split is the whole point. The vertices used to be three absolute
 * authored points, so a stretch moved the tip by `sx` while the renderer
 * rebuilt the base from the tip at the isotropic factor: as soon as
 * `sx ≠ strokeScale` the triangle tore away from the line it belongs to
 * (a 29-unit gap at 1600 × 400, the head drowning in the stroke at 400 × 1600).
 * Anchoring the head to the axis end instead keeps it soldered at every ratio,
 * and reproduces the authored SVG exactly when `sx === sy` — which is what the
 * numbers below were read off.
 */
export interface EstuarineArrowhead {
  /** Authored end of the axis this head is welded to — the ratio anchor. */
  at: readonly [number, number];
  /** Unit vector pointing OUT of the axis, towards the tip. */
  dir: readonly [number, number];
  /** How far past the axis end the tip sits, in fixed units. */
  tip: number;
  /** How far SHORT of the axis end the base sits: the weld's overlap. */
  overlap: number;
  /** Half the base's width, in fixed units. */
  halfWidth: number;
}

/** The three heads: both ends of the e axis, the right end of the t axis. */
export const ARROWHEADS: readonly EstuarineArrowhead[] = [
  // e — top
  {
    at: [E_AXIS.x, E_AXIS.y1],
    dir: [0, -1],
    tip: 25,
    overlap: 3,
    halfWidth: 13.5,
  },
  // e — bottom
  {
    at: [E_AXIS.x, E_AXIS.y2],
    dir: [0, 1],
    tip: 22,
    overlap: 5,
    halfWidth: 13.5,
  },
  // t — right
  {
    at: [T_AXIS.x2, T_AXIS.y],
    dir: [1, 0],
    tip: 27,
    overlap: 3,
    halfWidth: 13,
  },
];

/** Liminal: green boundary rising gently then dipping at the right end. */
export const LIMINAL_PATH =
  'M 63 193 C 67 192, 78 189, 85 188 C 92 187, 100 186, 107 185 C 114 184, 122 183, 129 183 C 136 183, 144 183, 151 183 C 158 183, 166 183, 173 183 C 180 183, 188 184, 195 185 C 202 186, 210 188, 217 189 C 224 190, 232 192, 239 194 C 246 196, 254 198, 261 201 C 268 204, 276 207, 283 210 C 290 213, 298 217, 305 220 C 312 223, 320 226, 327 230 C 334 234, 342 238, 349 242 C 356 246, 364 250, 371 255 C 378 260, 386 264, 393 269 C 400 274, 408 278, 415 283 C 422 288, 430 292, 437 297 C 444 302, 451 306, 458 310 C 465 314, 473 319, 480 323 C 487 327, 495 332, 502 335 C 509 338, 517 341, 524 343 C 531 345, 539 348, 546 349 C 553 350, 561 350, 568 350 C 575 350, 583 348, 590 346 C 597 344, 605 340, 612 336 C 619 332, 626 325, 633 319 C 640 313, 648 302, 651 298 C 654 294, 654 295, 654 294';
export const LIMINAL_WIDTH = 4.5;

/** Counter-factual: dark boundary sweeping from the top down to the right. */
export const COUNTERFACTUAL_PATH =
  'M 422 30 C 420 33, 414 41, 411 47 C 408 53, 405 59, 402 65 C 399 71, 397 77, 395 83 C 393 89, 392 95, 391 101 C 390 107, 389 113, 389 119 C 389 125, 389 131, 390 137 C 391 143, 392 149, 394 155 C 396 161, 399 167, 402 173 C 405 179, 408 185, 412 191 C 416 197, 421 203, 426 209 C 431 215, 436 221, 442 226 C 448 231, 454 237, 460 241 C 466 245, 472 249, 478 252 C 484 255, 490 258, 496 260 C 502 262, 508 264, 514 266 C 520 268, 526 270, 532 271 C 538 272, 544 274, 550 275 C 556 276, 562 277, 568 278 C 574 279, 580 279, 586 279 C 592 279, 598 280, 604 280 C 610 280, 616 281, 622 281 C 628 281, 634 280, 640 280 C 646 280, 655 279, 658 279';
export const COUNTERFACTUAL_WIDTH = 5.5;

/** Volatile: red boundary descending along the left, bulging right. */
export const VOLATILE_PATH =
  'M 58 446 C 61 447, 70 451, 76 454 C 82 457, 88 462, 94 466 C 100 470, 107 476, 112 481 C 117 486, 122 492, 126 498 C 130 504, 135 509, 139 515 C 143 521, 145 526, 148 532 C 151 538, 153 544, 155 550 C 157 556, 159 562, 160 568 C 161 574, 162 580, 163 586 C 164 592, 164 598, 164 604 C 164 610, 166 616, 166 622 C 166 628, 166 634, 165 640 C 164 646, 164 652, 163 658 C 162 664, 162 670, 161 676 C 160 682, 160 688, 159 694 C 158 700, 155 706, 154 712 C 153 718, 152 724, 151 730 C 150 736, 148 746, 147 749';
export const VOLATILE_WIDTH = 5;

const LABEL_COUNTERFACTUAL: ChromeWording = [
  'com.labre.cynefin-estuarine.estuarine.legend.counter-factual',
  'COUNTER FACTUAL',
];
const LABEL_LIMINAL: ChromeWording = [
  'com.labre.cynefin-estuarine.estuarine.legend.liminal',
  'LIMINAL',
];
const LABEL_VOLATILE: ChromeWording = [
  'com.labre.cynefin-estuarine.estuarine.legend.volatile',
  'VOLATILE',
];

/** Every {@link LABELS} wording, for `translations.ts`'s manifest. */
export const ESTUARINE_CANVAS_WORDINGS: readonly ChromeWording[] = [
  LABEL_COUNTERFACTUAL,
  LABEL_LIMINAL,
  LABEL_VOLATILE,
];

/**
 * Uppercase legends: anchored centre, alphabetic baseline, with letter-spacing.
 *
 * `prop` names the model key a double-click renames the legend into (issue
 * #355), and `visibleProp` the toggle that shows it — the legend is painted
 * with its curve and hidden with it, so it is aimable exactly when it is drawn.
 *
 * The three legends and nothing else: the italic `e` / `t` axis letters are
 * notation, not words (PO decision, and the reason they carry no i18n key
 * either), so they are not renamable.
 */
export const LABELS = {
  counterfactual: {
    wording: LABEL_COUNTERFACTUAL,
    prop: 'counterfactualLabel',
    visibleProp: 'showCounterfactual',
    x: 422,
    y: 25,
    size: 20,
    color: COLORS.label,
  },
  liminal: {
    wording: LABEL_LIMINAL,
    prop: 'liminalLabel',
    visibleProp: 'showLiminal',
    x: 316,
    y: 192,
    size: 18,
    color: COLORS.liminalLabel,
  },
  volatile: {
    wording: LABEL_VOLATILE,
    prop: 'volatileLabel',
    visibleProp: 'showVolatile',
    x: 219,
    y: 783,
    size: 20,
    color: COLORS.volatile,
  },
} as const;

/**
 * Italic Georgia axis letters (left-anchored, alphabetic baseline).
 *
 * Each letter NAMES an axis, so it is declared against that axis the way a
 * declared background declares a word (`backgroundPoint`,
 * `blocks/surface/src/framework-background/def.ts`): a proportional anchor
 * (`at`, the end of the axis it names) plus a FIXED `dx`/`dy` gap, painted at
 * the isotropic `strokeScale` like the glyph itself.
 *
 * They used to be absolute authored positions projected by `sx`/`sy` while the
 * glyph was typed isotropically, so the gap between letter and axis grew or
 * collapsed with the ratio — the `t` climbing onto its own axis at 1600 × 400,
 * falling far below it at 400 × 1600. `at + d·strokeScale` is exactly the
 * authored position when `sx === sy`, and a constant gap everywhere else.
 */
export const AXIS_LABELS = {
  e: { text: 'e', at: [E_AXIS.x, E_AXIS.y1], dx: -29.5, dy: 41 },
  t: { text: 't', at: [T_AXIS.x2, T_AXIS.y], dx: -36, dy: 36 },
  size: 34,
} as const;

export const LABEL_LETTER_SPACING = 4;

/**
 * Hexi constraint node (Estuarine mapping). Pointy-top regular hexagon —
 * two vertices on the VERTICAL symmetry axis (top/bottom) — as normalized
 * polygon vertices, clockwise from the top vertex. Shared by the toolbar
 * menu and the templates so the two can never drift apart.
 */
export const HEX_SIZE = 120;
export const HEX_FILL = '#34c724';
export const HEX_STROKE = '#1f1f1f';
export const HEX_VERTICES: number[][] = [
  [0.5, 0],
  [0.933, 0.25],
  [0.933, 0.75],
  [0.5, 1],
  [0.067, 0.75],
  [0.067, 0.25],
];
