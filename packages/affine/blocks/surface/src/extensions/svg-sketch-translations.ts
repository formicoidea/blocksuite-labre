import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * The SVG importer's own remarks (`svg-sketch.ts`) — one key per SENTENCE
 * SHAPE, not per exact string: a `{{name}}` hole is filled by
 * `InterchangeNote.messageParams` at report time
 * (`interchange-import.ts`'s `remarkLine`), never split into two keys or
 * baked into the key itself.
 *
 * The reader that raises these is a pure function of text (`docs/adr/0012`,
 * P3): it has no `std`, so each note carries its key and (where it has one)
 * its params, and `reportInterchangeImport` resolves both when it draws the
 * report — see `InterchangeNote.messageKey` / `.messageParams`.
 *
 * NOT included: the three `throw new Error(...)` refusals `parseSvgRoot`
 * raises for a malformed or empty file. Those are caught by
 * `importInterchangeFile`'s single, format-agnostic `catch` — shared by
 * every interchange reader (BPMN, mermaid, OWM, this one) — which shows
 * `error.message` verbatim BY DESIGN ("shown as it is rather than replaced
 * with a wording of our own that knows less"). Keying them would mean
 * teaching that shared catch to resolve a per-reader key, a mechanism this
 * lot does not own the other readers to touch — flagged in this lot's report
 * instead of invented here.
 */

export const SVG_SKETCH_FONT_UNIT: ChromeWording = [
  'com.labre.interchange.svg.font-unit',
  'Font sizes in `{{unit}}` cannot be resolved without a page to measure against; those labels use the inherited size.',
];

export const SVG_SKETCH_HIDDEN_DISPLAY: ChromeWording = [
  'com.labre.interchange.svg.hidden-display',
  'Parts of the file marked `display:none` were not imported — they draw nothing where the file came from either.',
];

export const SVG_SKETCH_HIDDEN_VISIBILITY: ChromeWording = [
  'com.labre.interchange.svg.hidden-visibility',
  'Parts of the file marked `visibility:hidden` were not imported — they draw nothing where the file came from either.',
];

export const SVG_SKETCH_OPACITY: ChromeWording = [
  'com.labre.interchange.svg.opacity',
  'Transparency is not carried: partly transparent shapes arrive at full strength.',
];

export const SVG_SKETCH_PAINT_SERVER: ChromeWording = [
  'com.labre.interchange.svg.paint-server',
  'Gradients and patterns are not read; the shapes that used one are a flat neutral.',
];

export const SVG_SKETCH_CURRENT_COLOR: ChromeWording = [
  'com.labre.interchange.svg.current-color',
  '`currentColor` has no page to inherit from here; the shapes that used it are a flat neutral.',
];

export const SVG_SKETCH_TRANSFORM: ChromeWording = [
  'com.labre.interchange.svg.transform',
  '`{{kind}}` transforms are ignored (best effort): what carried one is placed as if it did not.',
];

export const SVG_SKETCH_LONE_POINT: ChromeWording = [
  'com.labre.interchange.svg.lone-point',
  'A path that never moved anywhere draws nothing and was skipped.',
];

export const SVG_SKETCH_CURVE: ChromeWording = [
  'com.labre.interchange.svg.curve',
  'Curves are approximated by their endpoints (best effort), so a curved path arrives as straight segments.',
];

export const SVG_SKETCH_EMPTY_BOX: ChromeWording = [
  'com.labre.interchange.svg.empty-box',
  'Shapes with no width or height were skipped.',
];

export const SVG_SKETCH_PERCENT_RADIUS: ChromeWording = [
  'com.labre.interchange.svg.percent-radius',
  'Corner radii given as a percentage were not read; those corners arrive square.',
];

export const SVG_SKETCH_FLAT_POLYGON: ChromeWording = [
  'com.labre.interchange.svg.flat-polygon',
  'A polygon with fewer than three corners, or flat on one axis, arrives as its bounding rectangle.',
];

export const SVG_SKETCH_EMPTY_TEXT: ChromeWording = [
  'com.labre.interchange.svg.empty-text',
  'Empty text elements were skipped.',
];

export const SVG_SKETCH_SWITCH: ChromeWording = [
  'com.labre.interchange.svg.switch',
  'A `<switch>` offers alternative renderings; the first was imported and the others were not.',
];

export const SVG_SKETCH_SKIPPED: ChromeWording = [
  'com.labre.interchange.svg.skipped',
  '`<{{name}}>` is not recognised and was skipped.',
];

export const SVG_SKETCH_REMOVED: ChromeWording = [
  'com.labre.interchange.svg.removed',
  '`<{{name}}>` was removed while sanitizing the file — it is one of the constructs an SVG can carry code in — so nothing it drew was imported.',
];

export const SVG_SKETCH_REMOVED_ATTRIBUTE: ChromeWording = [
  'com.labre.interchange.svg.removed-attribute',
  'Attributes outside the safe SVG drawing vocabulary — event handlers, script URLs, and anything else the sanitizer does not know — were removed before the file was read.',
];

export const SVG_SKETCH_EMPTY: ChromeWording = [
  'com.labre.interchange.svg.empty',
  'No shape or text was recognised in this SVG, so nothing was drawn.',
];

/**
 * Every wording declared above, in declaration order — joined into
 * `PACKAGE_WORDINGS` (`packages/affine/all/src/translations.ts`) alongside
 * `PROVENANCE_FALLBACK`/`SEVERITY_FALLBACK`/`EXEMPTION_FALLBACK`, this
 * package's other manifest contributions.
 */
export const SVG_SKETCH_WORDINGS: readonly ChromeWording[] = [
  SVG_SKETCH_FONT_UNIT,
  SVG_SKETCH_HIDDEN_DISPLAY,
  SVG_SKETCH_HIDDEN_VISIBILITY,
  SVG_SKETCH_OPACITY,
  SVG_SKETCH_PAINT_SERVER,
  SVG_SKETCH_CURRENT_COLOR,
  SVG_SKETCH_TRANSFORM,
  SVG_SKETCH_LONE_POINT,
  SVG_SKETCH_CURVE,
  SVG_SKETCH_EMPTY_BOX,
  SVG_SKETCH_PERCENT_RADIUS,
  SVG_SKETCH_FLAT_POLYGON,
  SVG_SKETCH_EMPTY_TEXT,
  SVG_SKETCH_SWITCH,
  SVG_SKETCH_SKIPPED,
  SVG_SKETCH_REMOVED,
  SVG_SKETCH_REMOVED_ATTRIBUTE,
  SVG_SKETCH_EMPTY,
];
