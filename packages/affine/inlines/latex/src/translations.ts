import { type ChromeWording } from '@labre/affine-shared/services';

/**
 * `@labre/affine-inline-latex`'s own wordings — the editor popup's help
 * text. The empty-state and KaTeX-error words are shared with `blocks/latex`
 * and declared in `chrome.ts` instead (`EQUATION_EMPTY_LABEL` /
 * `EQUATION_ERROR_LABEL`), so they are not restated here.
 */
export const LATEX_LINE_BREAK_HINT: ChromeWording = [
  'com.labre.latex.line-break-hint',
  'Shift Enter to line break',
];

/**
 * Every wording declared above, in declaration order — walked by
 * `PACKAGE_WORDINGS` in `packages/affine/all/src/translations.ts`.
 */
export const LATEX_WORDINGS: readonly ChromeWording[] = [LATEX_LINE_BREAK_HINT];
