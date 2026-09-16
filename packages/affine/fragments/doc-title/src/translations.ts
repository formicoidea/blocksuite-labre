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

/** Every wording this package declares, in the order it renders them. */
export const DOC_TITLE_WORDINGS: readonly ChromeWording[] = [
  DOC_TITLE_PLACEHOLDER,
];
