import { type Color, DefaultTheme, FontWeight } from '@labre/affine-model';
import { HEADING_SCALE } from '@labre/affine-shared/consts';
import { darkThemeV2, lightThemeV2 } from '@toeverything/theme/v2';

/**
 * The slide masks' one system: geometry, typography and the one paper.
 * Every mask in `masks.ts` reads these and restates none of them, so a size
 * or a colour changes here, once, for the whole set.
 */

/** A 16:9 slide, the frame menu's own `16:9` preset (1600 × 900). */
export const SLIDE_WIDTH = 1600;
export const SLIDE_HEIGHT = 900;

/** The side margin every mask aligns its content on. */
export const SLIDE_MARGIN = 96;

/** Where the footer line (footer text, slide number) sits. */
export const SLIDE_FOOTER_Y = 846;

/**
 * A slide is read from across a room: its type is the document's heading
 * scale (DESIGN.md, The Title-Ratio Rule) times one factor, so the steps
 * between levels stay the editor's own. 1.5 puts the title at 48 model units
 * on a 1600-wide slide, the proportion of the PO's reference deck.
 */
export const SLIDE_TYPE_FACTOR = 1.5;

/**
 * The doc title has no entry in `HEADING_SCALE` (it sits above the scale,
 * DESIGN.md, Hierarchy: 700, 40px); the body is 15px. Both are restated
 * here as the two values the scale does not carry.
 */
const DOC_TITLE_SIZE = 40;
const BODY_SIZE = 15;
const CAPTION_SIZE = 12;

const size = (px: number) => Math.round(px * SLIDE_TYPE_FACTOR);
const weight = (value: number) => String(value) as FontWeight;

export type SlideTextRole =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'caption'
  | 'figure';

export type SlideType = { fontSize: number; fontWeight: FontWeight };

export const SLIDE_TYPE: Readonly<Record<SlideTextRole, SlideType>> = {
  /** The cover's and a section's title: the doc title's tier. */
  display: { fontSize: size(DOC_TITLE_SIZE), fontWeight: FontWeight.Bold },
  /** Every slide's own title: H1. */
  title: {
    fontSize: size(HEADING_SCALE.h1.fontSize),
    fontWeight: weight(HEADING_SCALE.h1.fontWeight),
  },
  /** A point's or a column's heading: H3. */
  heading: {
    fontSize: size(HEADING_SCALE.h3.fontSize),
    fontWeight: weight(HEADING_SCALE.h3.fontWeight),
  },
  body: { fontSize: size(BODY_SIZE), fontWeight: FontWeight.Regular },
  /** Footer, slide number, eyebrow, axis and placeholder labels. */
  caption: { fontSize: size(CAPTION_SIZE), fontWeight: FontWeight.Regular },
  /** A key figure: twice the slide title, the one number a slide is about. */
  figure: {
    fontSize: 2 * size(HEADING_SCALE.h1.fontSize),
    fontWeight: FontWeight.Bold,
  },
};

/**
 * What a text box adds to its font size per line. The renderer measures the
 * real line box in the DOM (`getLineHeight`, `gfx/text`); the seeds only need
 * a box tall enough not to overlap the next zone.
 *
 * ponytail: a fixed 1.25 ratio, close to Inter's measured line box. The
 * ceiling is a host font with a taller line box, whose seeds would overlap
 * by a few units until edited; the upgrade is measuring with `wrapText` and
 * `getLineHeight` at placement, which needs a DOM the snapshot build has not.
 */
export const SLIDE_LINE_HEIGHT = 1.25;

/**
 * The colours a slide paints with. Only `{ light, dark }` pairs of the base
 * palette or palette values that read on both papers: a mask's elements
 * carry no role and sit on no framework board, so they are painted as stored
 * on a dark canvas (ADR 0039, point 6). A raw hex would leave a white slide
 * on a dark canvas; a pair inverts with the theme.
 */
export type SlidePalette = {
  /** The frame's background. */
  paper: Color;
  /** Titles, headings, body text, key figures. */
  ink: Color;
  /** Eyebrows, captions, footer, slide number, axis labels, details. */
  muted: Color;
  /** Rules, arrows and the outlines meant to be seen (a Venn circle). */
  rule: Color;
  /** Hairlines, card outlines, the fill of a placeholder. */
  hairline: Color;
  /** The dashed outline of a fill zone. */
  zoneStroke: Color;
};

const MEDIUM_GREY = DefaultTheme.StrokeColorShortMap['Grey'] as Color;

/**
 * The theme's one grey that has a dark side, the note palette's grey
 * (`#e6e6e6` / `#565656`). `DefaultTheme` maps no grey note, so the pair is
 * read from the same theme tables `getColorByKey` reads.
 */
const NOTE_GREY: Color = {
  dark: darkThemeV2['edgeless/note/grey'],
  light: lightThemeV2['edgeless/note/grey'],
};

/**
 * One paper for every mask: white, turning dark grey on a dark canvas. The
 * set once had an `inverse` black slide (section, statement, quote); the PO
 * wants every slide of a deck on white (recette of 0.60), so a deck reads as
 * one sheet and prints as one.
 *
 * Words reach WCAG AA (4.5:1) on both sides of the paper, which the base
 * palette's medium grey does not (`#929292` on white is 3.1:1): secondary
 * words are set in ink, and their tone is carried by their role's size.
 * The medium grey stays for rules and outlines, where 3:1 is the bar.
 *
 * ponytail: `muted` is the ink pair, so a muted line looks like an ink one
 * at the same size. The ceiling is a deck with no tonal step between a
 * heading and its detail; the upgrade is a darker grey `{ light, dark }`
 * pair in the base palette (one AA on white and on `#252525`), set here.
 */
export const SLIDE_PALETTE = {
  paper: DefaultTheme.NoteBackgroundColorMap['White'] as Color,
  ink: DefaultTheme.black,
  muted: DefaultTheme.black,
  rule: MEDIUM_GREY,
  hairline: NOTE_GREY,
  zoneStroke: MEDIUM_GREY,
} as const satisfies SlidePalette;

/** Stroke widths, model units. */
export const SLIDE_HAIRLINE_WIDTH = 2;
export const SLIDE_ZONE_STROKE_WIDTH = 2;
/** Corner radius of a card or a fill zone. */
export const SLIDE_RADIUS = 12;
