import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * The document title's own wording: the ghost text shown in place of the
 * `<rich-text>` caret when the title is empty. Rendered through CSS
 * (`content: attr(data-placeholder)`, `./doc-title.ts`) rather than a lit
 * expression, because the placeholder IS the `::before` pseudo-element and
 * has no text node of its own to interpolate into — the resolved wording is
 * written to a `data-placeholder` attribute instead, which is the one thing
 * `content: attr(...)` can read.
 */
export const DOC_TITLE_PLACEHOLDER: ChromeWording = [
  'com.labre.doc-title.placeholder',
  'Title',
];

/* ── The title band (ADR 0035 §11), `./title-band/title-band.ts` ───────── */

/** The band's accessible name: the group of property chips. */
export const TITLE_BAND_LABEL: ChromeWording = [
  'com.labre.title-band.label',
  'Page properties',
];

/** What an empty chip says after the property's name (REQ-PR-1). */
export const TITLE_BAND_EMPTY: ChromeWording = [
  'com.labre.title-band.empty',
  'Not set',
];

/** The "+" (REQ-PR-4); what it does is the host's. */
export const TITLE_BAND_ADD: ChromeWording = [
  'com.labre.title-band.add',
  'Add a property',
];

/** The button beside the "+" that opens the host's properties panel. */
export const TITLE_BAND_OPEN_PANEL: ChromeWording = [
  'com.labre.title-band.open-panel',
  'Open the properties panel',
];

/** Folds the chips away. */
export const TITLE_BAND_COLLAPSE: ChromeWording = [
  'com.labre.title-band.collapse',
  'Hide properties',
];

/** The folded band's only button; `count` is the number of chips. */
export const TITLE_BAND_EXPAND: ChromeWording = [
  'com.labre.title-band.expand',
  'Properties ({{count}})',
];

/** The accessible name of the skeleton drawn while the sheet loads. */
export const TITLE_BAND_LOADING: ChromeWording = [
  'com.labre.title-band.loading',
  'Loading properties',
];

/** Clears a select or a date from its editor. */
export const TITLE_BAND_CLEAR: ChromeWording = [
  'com.labre.title-band.clear',
  'Clear value',
];

/**
 * The row of child pages the document holds but does not display, under the
 * title and in the note header (ADR 0035 §9d and its 2026-10-13 amendment).
 */
export const TITLE_BAND_NOT_SHOWN: ChromeWording = [
  'com.labre.title-band.not-shown',
  'Not shown in this document',
];

/**
 * The button beside each page of that row: inserts a card of the page here
 * (labre ADR-0045 §7).
 */
export const TITLE_BAND_SHOW_HERE: ChromeWording = [
  'com.labre.title-band.show-here',
  'Show here',
];

/** Every wording this package declares, in the order it renders them. */
export const DOC_TITLE_WORDINGS: readonly ChromeWording[] = [
  DOC_TITLE_PLACEHOLDER,
  TITLE_BAND_ADD,
  TITLE_BAND_CLEAR,
  TITLE_BAND_COLLAPSE,
  TITLE_BAND_EMPTY,
  TITLE_BAND_EXPAND,
  TITLE_BAND_LABEL,
  TITLE_BAND_LOADING,
  TITLE_BAND_NOT_SHOWN,
  TITLE_BAND_OPEN_PANEL,
  TITLE_BAND_SHOW_HERE,
];
