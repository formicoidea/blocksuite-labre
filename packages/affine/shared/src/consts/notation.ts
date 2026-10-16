/**
 * The neutral scale every framework notation on the canvas shares: inks,
 * greys, borders and the card fill.
 *
 * **Wardley is the reference.** The values are the Wardley map's own (its
 * background `COLORS`, its node stroke and fill, its legend frame), so a
 * Wardley board is unchanged by this module existing; every other framework
 * (BPMN, C4, EDGY, the DDD notations, the generic templates) reads its neutrals
 * from here instead of restating a near-identical grey of its own. One scale,
 * one place to change it.
 *
 * **Hues stay per framework.** An event ring, a C4 container blue, a sticky
 * colour or an evolution red is the notation's meaning and lives in that
 * framework's `consts.ts`. So do the neutrals a notation borrows from an
 * official source (the C4 stencil's `#444444`, the Cynefin and Estuarine SVGs,
 * the EDGY facet picto) and the greys that carry a meaning (a future bounded
 * context, a Core Domain zone): those are content of the notation, not chrome.
 *
 * **No band tint.** The title or header strip of a board (BPMN participant
 * band, C4 board header, a generic template's column) is plain `cardFill`
 * white, set apart by its divider line (PO, 11/09/2026). The Wardley phase
 * bands are not chrome: a graded wash across four zones is the map's meaning,
 * so they stay Wardley's own.
 *
 * **Stored colours are never rewritten.** A creation default is copied into
 * the element when it is placed, so changing a value here repaints only the
 * render-time chrome of existing boards (backgrounds, cards, frames) and the
 * elements created from now on. Any code that recognises an element by its
 * stored colour must keep accepting the value it was created with.
 */
const SCALE = {
  /**
   * Artefact ink: node strokes, text inside or under an artefact, labels,
   * legend text, the default connector stroke (Wardley `NODE_STROKE`).
   */
  ink: '#1f2328',
  /**
   * Background structure: axes, frame lines, board titles, pool frames and
   * names, axis titles (Wardley `COLORS.axis`).
   */
  frameInk: '#3b3d42',
  /**
   * Secondary labels drawn on a background: headings, tick labels (Wardley
   * `COLORS.label`).
   */
  label: '#6b7280',
  /**
   * Dashed dividers, group strokes, secondary strokes (Wardley
   * `COLORS.divider`).
   */
  divider: '#9aa0a6',
  /** Board, card and node fill (Wardley `COLORS.card` / `NODE_FILL`). */
  cardFill: '#ffffff',
  /** The board card's border (Wardley `COLORS.cardBorder`). */
  cardBorder: '#e3e2e4',
  /** A legend's frame and separators (the Wardley legend). */
  legendBorder: '#cfd2d6',
};

/**
 * Typed as plain strings on purpose, not `as const`: a framework constant set
 * from the scale (`NODE_STROKE = NOTATION_NEUTRALS.ink`) must stay a `string`,
 * as the hex literal it replaces was, so it can still be passed wherever any
 * colour is (a helper whose parameter type is inferred from a default).
 */
export const NOTATION_NEUTRALS: Readonly<typeof SCALE> = Object.freeze(SCALE);

export type NotationNeutral = keyof typeof NOTATION_NEUTRALS;

/**
 * The same scale on the dark canvas, key for key (ADR 0039). A canvas in the
 * dark scheme does not show a white card with a near-black ink: the PAPER
 * inverts and the hues stay. These values are what a notation element is
 * painted with at render time when the canvas is dark; nothing is written to a
 * document, and the SVG export keeps the light scale.
 *
 * Read off the dark chrome the editor already paints (`@toeverything/theme`,
 * AFFiNE's dark tables): the card is the dark page itself (`rgb(20, 20, 20)`,
 * `--affine-background-primary-color`), exactly as the light card is the white
 * page, so a board is told apart by its border in both schemes; the ink is the
 * dark primary text (`rgb(234, 234, 234)`) and the label the dark secondary
 * text (`rgb(156, 156, 160)`). Every other step keeps the contrast its light
 * twin has on white, within a hair (`notation-dark-scale.unit.spec.ts`).
 *
 * The card being the page is also what keeps a dark accent around 3:1 under a
 * selection (labre ADR-0049, question 2): anything lighter than the page
 * beneath a selection frame lowers it.
 */
const DARK_SCALE: Readonly<Record<NotationNeutral, string>> = {
  ink: '#eaeaea',
  frameInk: '#c4c5c9',
  label: '#9c9ca0',
  divider: '#5f6166',
  cardFill: '#141414',
  cardBorder: '#3a3a3c',
  legendBorder: '#4b4d52',
};

export const NOTATION_NEUTRALS_DARK: Readonly<Record<NotationNeutral, string>> =
  Object.freeze(DARK_SCALE);
