/**
 * The Wardley SVG import's own remarks, as `[key, English]` pairs (ADR 0032
 * §3) — the same shape, and the same reason, as `WARDLEY_OWM_IMPORT_REMARKS`:
 * a reader is a pure function with no `std`, so it hands the key over and
 * `reportInterchangeImport` resolves it. `{{count}}` is filled from
 * `messageParams`; plural wording stays neutral, the host pluralises.
 *
 * Contributed to the manifest by `./translations.ts`.
 */
export const WARDLEY_SVG_IMPORT_REMARKS = {
  sketchedRemainder: [
    'com.labre.wardley.import.svg.remark.sketched-remainder',
    '{{count}} shape(s) were not recognised as Wardley and arrive as a sketch.',
  ],
  inventedPlot: [
    'com.labre.wardley.import.svg.remark.invented-plot',
    'the file draws no plot this reader could find, so evolution and visibility were ESTIMATED from the extent of the drawing, not read.',
  ],
  danglingLink: [
    'com.labre.wardley.import.svg.remark.dangling-link',
    'a link in this file names an artefact the drawing does not hold, so it arrives as a sketch rather than as a dependency.',
  ],
  unreadableCoordinates: [
    'com.labre.wardley.import.svg.remark.unreadable-coordinates',
    'its position in the file is not a pair of numbers this reader can trust, so it arrives as a sketch.',
  ],
} as const satisfies Record<string, readonly [key: string, english: string]>;
