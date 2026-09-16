import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * Visual constants for the Liminal Cynefin diagram, reproduced from the official
 * SVG (viewBox 0 0 1080 777). All geometry is authored in that fixed reference
 * space and scaled uniformly to the element bounds by the renderer.
 *
 * ## i18n
 *
 * Every word painted on the diagram — domain headings and subheadings, the
 * Probe/Sense/Respond decision lines, the teal annotations, the small
 * exaptation sub-labels and the two central markers — carries a `…Key`
 * alongside its English text, resolved by `element-renderer.ts` through the
 * `CanvasRenderer` it is handed at paint time (the 4th argument every
 * `ElementRenderer` receives, `renderer.std`). The letters "A" and "C" on the
 * two markers are notation, not words, and are deliberately NOT keyed (PO
 * decision) — only their spelled-out NAMES ("Aporia", "Confusion") are.
 */

export const REF_W = 1080;
export const REF_H = 777;

export const COLORS = {
  boundary: '#333333',
  teal: '#2a9d99',
  /** Domain headings + subheadings (h1 / h2). */
  heading: '#6d6e71',
  /** Body, small annotations and the big A / C glyphs. */
  body: '#231f20',
} as const;

/**
 * Dark boundary strokes drawn *behind* the teal "iterate" curve:
 * [svg path, lineWidth, miterJoin].
 */
export const DARK_BACK_PATHS: ReadonlyArray<
  readonly [string, number, boolean]
> = [
  // Main arc: top segment (Complex|Complicated) then left segment (Complex|Chaotic)
  [
    'M 550.1 17 A 296 296 0 0 1 338 328.5 A 448.7 448.7 0 0 1 26 331',
    15.5,
    false,
  ],
  // Thin "Confusion" arc sweeping down towards the cliff
  ['M 649 294 C 644 382, 588 462, 440 506', 5, false],
];

/** Teal "iterate" curve, drawn *over* the back arcs and the dashed paving. */
export const TEAL_PATH =
  'M 475.1 9.1 C 477.5 13.3, 484.4 26.1, 489.3 34.6 C 494.2 43.1, 499.7 51.7, 504.4 60.2 C 509.1 68.7, 513.4 77.2, 517.6 85.7 C 521.8 94.2, 525.7 102.7, 529.7 111.2 C 533.7 119.7, 538.1 128.3, 541.8 136.8 C 545.5 145.3, 549.0 153.8, 551.9 162.3 C 554.8 170.8, 557.1 179.3, 559.0 187.8 C 560.9 196.3, 562.0 204.8, 563.0 213.3 C 564.0 221.8, 564.8 230.4, 565.0 238.9 C 565.2 247.4, 565.0 255.9, 564.0 264.4 C 563.0 272.9, 561.2 281.4, 559.0 289.9 C 556.8 298.4, 554.6 307.0, 550.9 315.5 C 547.2 324.0, 542.3 332.5, 536.8 341.0 C 531.2 349.5, 524.9 358.3, 517.6 366.5 C 510.4 374.7, 501.6 383.0, 493.3 390.0 C 485.0 397.0, 476.4 403.1, 468.0 408.4 C 459.6 413.7, 451.2 418.0, 442.8 421.7 C 434.4 425.4, 425.9 427.4, 417.5 430.8 C 409.1 434.2, 400.3 437.5, 392.2 442.1 C 384.1 446.7, 377.1 455.5, 369.0 458.4 C 360.9 461.3, 352.1 459.4, 343.7 459.4 C 335.3 459.4, 326.9 459.1, 318.5 458.4 C 310.1 457.7, 301.6 456.8, 293.2 455.4 C 284.8 454.0, 276.4 452.2, 268.0 450.3 C 259.6 448.4, 251.1 446.2, 242.7 444.1 C 234.3 442.1, 225.8 440.0, 217.4 438.0 C 209.0 436.0, 200.6 434.4, 192.2 431.9 C 183.8 429.3, 175.3 426.1, 166.9 422.7 C 158.5 419.3, 150.0 415.5, 141.6 411.4 C 133.2 407.3, 124.8 403.3, 116.4 398.2 C 108.0 393.1, 99.5 386.9, 91.1 380.8 C 82.7 374.7, 74.3 368.7, 65.9 361.4 C 57.5 354.1, 45.7 342.8, 40.6 336.9 C 35.5 330.9, 36.4 327.6, 35.5 325.7';
export const TEAL_WIDTH = 10.5;

/**
 * Dark boundary strokes drawn *over* the teal curve:
 * [svg path, lineWidth, miterJoin].
 */
export const DARK_FRONT_PATHS: ReadonlyArray<
  readonly [string, number, boolean]
> = [
  // Thick descending branch with the bottom elbow (right edge of the cliff)
  ['M 340 332 C 390 440, 437 525, 472 632 Q 479 658, 453 700', 15.5, true],
  // Thin left line (left edge of the cliff)
  [
    'M 345 356 C 372 440, 408 540, 413 655 C 414 685, 412 710, 412 738',
    4,
    false,
  ],
];

/** Cliff hatching: [x1,y1,x2,y2], lineWidth 3. */
export const HATCHES: ReadonlyArray<readonly [number, number, number, number]> =
  [
    [375, 420, 371, 431],
    [386, 443, 380, 461],
    [395, 462, 386, 483],
    [402, 477, 392, 506],
    [412, 497, 400, 539],
    [417, 511, 403, 558],
    [427, 533, 409, 591],
    [435, 551, 411, 612],
    [444, 573, 415, 659],
    [455, 603, 415, 700],
  ];

/** Dashed Complicated↔Clear boundary, as oriented square pavings: [x,y,size,rotateDeg]. */
export const DASH_RECTS: ReadonlyArray<
  readonly [number, number, number, number]
> = [
  [511, 245, 13.8, 206.8],
  [530, 255.5, 13.7, 205.2],
  [549.5, 265.5, 13.6, 203.5],
  [569.5, 274.5, 13.5, 201.9],
  [590, 282.5, 13.5, 200.2],
  [610.5, 289.5, 13.4, 198.6],
  [631, 296, 13.3, 196.9],
  [673.5, 307, 13.2, 193.6],
  [695, 311.5, 13.1, 192.0],
  [716, 315.5, 13.0, 190.3],
  [738, 319, 12.9, 188.7],
  [759.5, 322, 12.8, 187.0],
  [781, 324.5, 12.8, 185.4],
  [803, 325.5, 12.7, 183.7],
  [824.5, 326.5, 12.6, 182.1],
  [846, 327.5, 12.5, 180.5],
  [868, 327.5, 12.4, 178.8],
  [889.5, 326.5, 12.3, 177.2],
  [912, 325.5, 12.2, 175.5],
  [933, 323.5, 12.1, 173.9],
  [954.5, 321.5, 12.1, 172.2],
  [976, 318, 12.0, 170.6],
  [998, 314, 11.9, 168.9],
  [1019, 310, 11.8, 167.3],
];

/* ── i18n: headings, subheadings and decision lines ───────────────────── */

const HEADING_COMPLEX: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.heading.complex',
  'Complex',
];
const HEADING_COMPLICATED: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.heading.complicated',
  'Complicated',
];
const HEADING_CHAOTIC: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.heading.chaotic',
  'Chaotic',
];
const HEADING_CLEAR: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.heading.clear',
  'Clear',
];

const SUBHEADING_ADAPTIVE: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.subheading.adaptive-system',
  'Adaptive system',
];
/** Shared by Complicated and Clear — the same word, one key. */
const SUBHEADING_ORDERED: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.subheading.ordered-system',
  'Ordered system',
];
const SUBHEADING_UNORDERED: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.subheading.un-ordered-system',
  'Un-ordered system',
];

/**
 * The ten distinct decision sentences (two are shared verbatim between two
 * domains — "Sense how the context reacts", "Sense the context with
 * analytical methods" — one key each, reused rather than duplicated).
 *
 * The fallback is the FULL sentence (`lead` + `rest` concatenated): the
 * renderer draws `lead` bold and `rest` roman as two `fillText` calls only
 * while NO host answered (byte-identical to before these keys existed); once
 * a host resolves the key, the whole sentence is drawn as one run — a
 * translation is not guaranteed to keep the same first word, so splitting it
 * at the English boundary would be a guess.
 */
const LINE_PROBE: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.line.probe',
  'Probe the context with parallel experiments',
];
const LINE_SENSE_REACTS: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.line.sense-reacts',
  'Sense how the context reacts',
];
const LINE_RESPOND_AMPLIFY: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.line.respond-amplify',
  'Respond by amplifying positive experiments',
];
const LINE_SENSE_ANALYTICAL: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.line.sense-analytical',
  'Sense the context with analytical methods',
];
const LINE_ANALYSE: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.line.analyse',
  'Analyse observations',
];
const LINE_RESPOND_MANY_SOLUTIONS: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.line.respond-many-solutions',
  'Respond by applying one of many good solutions',
];
const LINE_ACT: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.line.act',
  'Act on the context to stabilize (it or yourself)',
];
const LINE_RESPOND_REACT: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.line.respond-react',
  'Respond by re-acting',
];
const LINE_CATEGORIZE: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.line.categorize',
  'Categorize observations',
];
const LINE_RESPOND_PRACTICES: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.line.respond-practices',
  'Respond by applying tried and true practices',
];

/**
 * The four domain blocks. Each has a heading (h1) and, when descriptions are
 * shown, a subheading (h2) and three decision lines whose lead word is bold
 * (English, no host) or drawn whole (translated). All three text levels share
 * the block's left `x`.
 */
export interface DomainBlock {
  heading: ChromeWording;
  /** Left edge shared by heading, subheading and body lines. */
  x: number;
  /** Heading (h1) baseline. */
  hy: number;
  subheading: ChromeWording;
  /** Subheading (h2) baseline. */
  sy: number;
  /** Decision lines: bold lead word + remainder + the full sentence's key. */
  lines: ReadonlyArray<{
    lead: string;
    rest: string;
    wording: ChromeWording;
    y: number;
  }>;
}

export const DOMAINS: ReadonlyArray<DomainBlock> = [
  {
    heading: HEADING_COMPLEX,
    x: 37,
    hy: 31,
    subheading: SUBHEADING_ADAPTIVE,
    sy: 53,
    lines: [
      {
        lead: 'Probe',
        rest: ' the context with parallel experiments',
        wording: LINE_PROBE,
        y: 71,
      },
      {
        lead: 'Sense',
        rest: ' how the context reacts',
        wording: LINE_SENSE_REACTS,
        y: 90,
      },
      {
        lead: 'Respond',
        rest: ' by amplifying positive experiments',
        wording: LINE_RESPOND_AMPLIFY,
        y: 109,
      },
    ],
  },
  {
    heading: HEADING_COMPLICATED,
    x: 779,
    hy: 31,
    subheading: SUBHEADING_ORDERED,
    sy: 53,
    lines: [
      {
        lead: 'Sense',
        rest: ' the context with analytical methods',
        wording: LINE_SENSE_ANALYTICAL,
        y: 71,
      },
      { lead: 'Analyse', rest: ' observations', wording: LINE_ANALYSE, y: 90 },
      {
        lead: 'Respond',
        rest: ' by applying one of many good solutions',
        wording: LINE_RESPOND_MANY_SOLUTIONS,
        y: 109,
      },
    ],
  },
  {
    heading: HEADING_CHAOTIC,
    x: 37,
    hy: 587,
    subheading: SUBHEADING_UNORDERED,
    sy: 609,
    lines: [
      {
        lead: 'Act',
        rest: ' on the context to stabilize (it or yourself)',
        wording: LINE_ACT,
        y: 627,
      },
      {
        lead: 'Sense',
        rest: ' how the context reacts',
        wording: LINE_SENSE_REACTS,
        y: 646,
      },
      {
        lead: 'Respond',
        rest: ' by re-acting',
        wording: LINE_RESPOND_REACT,
        y: 665,
      },
    ],
  },
  {
    heading: HEADING_CLEAR,
    x: 779,
    hy: 587,
    subheading: SUBHEADING_ORDERED,
    sy: 609,
    lines: [
      {
        lead: 'Sense',
        rest: ' the context with analytical methods',
        wording: LINE_SENSE_ANALYTICAL,
        y: 627,
      },
      {
        lead: 'Categorize',
        rest: ' observations',
        wording: LINE_CATEGORIZE,
        y: 646,
      },
      {
        lead: 'Respond',
        rest: ' by applying tried and true practices',
        wording: LINE_RESPOND_PRACTICES,
        y: 665,
      },
    ],
  },
];

/* ── i18n: teal annotations and small exaptation sub-labels ────────────── */

const TEAL_ITERATE: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.teal.iterate',
  'iterate',
];
const TEAL_STRATEGY_BY_DESIGN: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.teal.strategy-by-design',
  'strategy by design',
];
const TEAL_RADICAL_INNOVATION: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.teal.radical-innovation',
  'radical innovation',
];
const TEAL_BY_DESIGN: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.teal.by-design',
  'by design',
];
const TEAL_EXTREME_REPURPOSING: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.teal.extreme-repurposing',
  'extreme repurposing',
];
const TEAL_GOOD_PRACTICE: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.teal.good-practice',
  'good practice',
];
const TEAL_BEST_PRACTICE: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.teal.best-practice',
  'best practice',
];

/** Teal annotation labels (centered): [wording, x, y]. */
export const TEAL_LABELS: ReadonlyArray<
  readonly [ChromeWording, number, number]
> = [
  [TEAL_ITERATE, 510, 16],
  [TEAL_ITERATE, 533, 230],
  [TEAL_STRATEGY_BY_DESIGN, 257, 225],
  [TEAL_RADICAL_INNOVATION, 268, 390],
  [TEAL_BY_DESIGN, 268, 406],
  [TEAL_EXTREME_REPURPOSING, 217, 496],
  [TEAL_GOOD_PRACTICE, 814, 196],
  [TEAL_BEST_PRACTICE, 751, 459],
];

const SMALL_DISPOSITIONAL: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.small.dispositional-exaptation',
  'dispositional exaptation',
];
const SMALL_STIMULATED: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.small.stimulated-exaptation',
  'stimulated exaptation',
];
const SMALL_STRESS_BASED: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.small.stress-based-exaptation',
  'stress-based exaptation',
];

/** Small exaptation sub-labels (centered): [wording, x, y]. */
export const SMALL_LABELS: ReadonlyArray<
  readonly [ChromeWording, number, number]
> = [
  [SMALL_DISPOSITIONAL, 257, 239],
  [SMALL_STIMULATED, 268, 419],
  [SMALL_STRESS_BASED, 217, 510],
];

/* ── i18n: the two central markers ──────────────────────────────────── */

const MARKER_APORIA_NAME: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.marker.aporia',
  'Aporia',
];
const MARKER_CONFUSION_NAME: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.marker.confusion',
  'Confusion',
];
const MARKER_APORIA_NOTE: ChromeWording = [
  'com.labre.cynefin-estuarine.cynefin.marker.aporia-note',
  'prepare to exit',
];

/**
 * The two central markers — Aporia (A) and Confusion (C) — each a big glyph and
 * a name, with an optional teal note ("prepare to exit"). All centered.
 *
 * `letter` is the notation itself ("A" / "C") and is deliberately NOT keyed
 * (PO decision) — only the spelled-out `name` is.
 */
export interface Marker {
  letter: string;
  /** Big glyph position. */
  lx: number;
  ly: number;
  name: ChromeWording;
  /** Name (body) position. */
  nx: number;
  ny: number;
  /** Optional teal note position + wording. */
  note?: { wording: ChromeWording; x: number; y: number };
}

export const MARKERS: ReadonlyArray<Marker> = [
  {
    letter: 'A',
    lx: 444,
    ly: 334,
    name: MARKER_APORIA_NAME,
    nx: 447,
    ny: 349,
    note: { wording: MARKER_APORIA_NOTE, x: 449, y: 366 },
  },
  {
    letter: 'C',
    lx: 531,
    ly: 419,
    name: MARKER_CONFUSION_NAME,
    nx: 529,
    ny: 436,
  },
];

/**
 * Every wording this file paints, for `translations.ts`'s manifest
 * contribution. Deduplicated by key (`iterate` and the two shared lines are
 * each listed once), which is what `mergeTranslationEntries` needs to see one
 * entry per key rather than two identical ones.
 */
export const CYNEFIN_CANVAS_WORDINGS: readonly ChromeWording[] = [
  HEADING_COMPLEX,
  HEADING_COMPLICATED,
  HEADING_CHAOTIC,
  HEADING_CLEAR,
  SUBHEADING_ADAPTIVE,
  SUBHEADING_ORDERED,
  SUBHEADING_UNORDERED,
  LINE_PROBE,
  LINE_SENSE_REACTS,
  LINE_RESPOND_AMPLIFY,
  LINE_SENSE_ANALYTICAL,
  LINE_ANALYSE,
  LINE_RESPOND_MANY_SOLUTIONS,
  LINE_ACT,
  LINE_RESPOND_REACT,
  LINE_CATEGORIZE,
  LINE_RESPOND_PRACTICES,
  TEAL_ITERATE,
  TEAL_STRATEGY_BY_DESIGN,
  TEAL_RADICAL_INNOVATION,
  TEAL_BY_DESIGN,
  TEAL_EXTREME_REPURPOSING,
  TEAL_GOOD_PRACTICE,
  TEAL_BEST_PRACTICE,
  SMALL_DISPOSITIONAL,
  SMALL_STIMULATED,
  SMALL_STRESS_BASED,
  MARKER_APORIA_NAME,
  MARKER_CONFUSION_NAME,
  MARKER_APORIA_NOTE,
];
