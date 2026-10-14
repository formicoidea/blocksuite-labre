// Its own module so the headless interchange entry (`./interchange`) can read
// it without the SVG export's graph (ADR 0012, P3 as amended 2026-10-14).

/**
 * The marker version an export writes on its root (`data-labre-svg`), and the
 * one a reader of it must know (ADR 0032 §6). Bumped only when the meaning of
 * a marker changes; adding one is not a new version.
 */
export const BOARD_SVG_MARKER_VERSION = '1';
