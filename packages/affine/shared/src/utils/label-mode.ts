/**
 * Whether a catalogue symbol can carry its name INSIDE it, or the name must
 * GRAVITATE around it (rule R38, `docs/add-a-framework/02-framework-rules.md`;
 * ADR 0029).
 *
 * The rule has one criterion, the symbol's size: a normal-size text — 18 model
 * units, the size Wardley's prominent labels and BPMN's inner text use — of two
 * five-letter words must fit legibly inside the shape at its canonical creation
 * size, without enlarging it. If it does not, the label is a free text element
 * grouped with the symbol (R16) instead of the shape's own `text`.
 *
 * The test is arithmetic on the preset, so a framework's spec can assert its
 * label mode for every kind without a canvas:
 *
 *  - the inner box is the shape minus the native shape text insets
 *    (`SHAPE_TEXT_VERTICAL_PADDING` = 10, `SHAPE_TEXT_PADDING` = 20 in
 *    `@labre/affine-model`, the defaults below);
 *  - a non-rectangular silhouette only offers the rectangle inscribed in it:
 *    ≈ 1/√2 of each side for an ellipse (0.7), half of each side for a diamond;
 *  - the probe is "Hello World" (two five-letter words and a space), set on one
 *    line or broken into two lines of five letters; it fits if either layout
 *    fits.
 *
 * Average advance 0.5 em: Inter's advances for the probe itself ("Hello World"
 * ≈ 5.4 em) average 0.49 em, which is what decides a 140-wide annotation at 18
 * units — a generic 0.55 em prose average would reject a box the probe
 * visibly fits. Line height 1.2 em, the renderer's default for single-spaced
 * canvas text.
 *
 * ponytail: no real font metrics — a fixed per-glyph average and a fixed line
 * height, so a shape within a few units of the threshold may be judged wrongly
 * for a font other than Inter. The upgrade is to measure the probe with the
 * shape renderer's `wrapText` / `getLineHeight` in a browser-mode spec.
 */

/** The probe: two five-letter words, as in "Hello World". */
const PROBE_WORD_LENGTH = 5;
const PROBE_ONE_LINE_LENGTH = 2 * PROBE_WORD_LENGTH + 1;
/** Average Inter advance over the probe, in em. */
const AVERAGE_ADVANCE_EM = 0.5;
const LINE_HEIGHT_EM = 1.2;

/** Share of each side of the inner box a silhouette leaves usable. */
const INSCRIBED_FACTOR: Record<string, number> = Object.assign(
  Object.create(null) as Record<string, number>,
  { ellipse: 0.7, diamond: 0.5 }
);

export interface InscribedLabelProbe {
  /** Canonical creation width, model units. */
  w: number;
  /** Canonical creation height, model units. */
  h: number;
  /** Native shape type: `ellipse`, `diamond`, `rect`, or a polygon name. */
  shapeType: string;
  /** Reference size of the fit test, not a mandate for the label's own size. */
  fontSize?: number;
  /** `[vertical, horizontal]` inset, as the native shape pads its text. */
  padding?: [number, number];
}

export const fitsInscribedLabel = ({
  w,
  h,
  shapeType,
  fontSize = 18,
  padding = [10, 20],
}: InscribedLabelProbe): boolean => {
  const factor = INSCRIBED_FACTOR[shapeType] ?? 1;
  const innerW = (w - 2 * padding[1]) * factor;
  const innerH = (h - 2 * padding[0]) * factor;
  if (innerW <= 0 || innerH <= 0) return false;

  const advance = AVERAGE_ADVANCE_EM * fontSize;
  const lineHeight = LINE_HEIGHT_EM * fontSize;

  const oneLine =
    PROBE_ONE_LINE_LENGTH * advance <= innerW && lineHeight <= innerH;
  if (oneLine) return true;

  return PROBE_WORD_LENGTH * advance <= innerW && 2 * lineHeight <= innerH;
};
