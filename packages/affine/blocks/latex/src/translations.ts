import {
  type ChromeWording,
  EQUATION_EMPTY_LABEL,
  EQUATION_ERROR_LABEL,
} from '@labre/affine-shared/services';

/**
 * This package's own wordings, declared beside the code that renders them —
 * the slash-menu's two equation items and the katex placeholder/error labels.
 */

export const LATEX_SLASH_INLINE_NAME: ChromeWording = [
  'com.labre.latex.slash-menu.inline.name',
  'Inline equation',
];

export const LATEX_SLASH_INLINE_DESCRIPTION: ChromeWording = [
  'com.labre.latex.slash-menu.inline.description',
  'Create a inline equation.',
];

/**
 * The inline item's tooltip caption says the exact same word as its name —
 * reused rather than declared twice.
 */
export const LATEX_SLASH_INLINE_CAPTION = LATEX_SLASH_INLINE_NAME;

export const LATEX_SLASH_BLOCK_NAME: ChromeWording = [
  'com.labre.latex.slash-menu.block.name',
  'Equation',
];

export const LATEX_SLASH_BLOCK_DESCRIPTION: ChromeWording = [
  'com.labre.latex.slash-menu.block.description',
  'Create a equation block.',
];

/** The block item's tooltip caption says the same word as its name too. */
export const LATEX_SLASH_BLOCK_CAPTION = LATEX_SLASH_BLOCK_NAME;

export const LATEX_TOOLTIP_INTRO: ChromeWording = [
  'com.labre.latex.slash-menu.inline.tooltip-intro',
  'Energy. Mass. Light. In a single equation,',
];

export const LATEX_TOOLTIP_BLOCK_INTRO: ChromeWording = [
  'com.labre.latex.slash-menu.block.tooltip-intro',
  'Create a equation via LaTeX.',
];

/**
 * `./latex-block.ts`'s own placeholders: the empty block, and a block whose
 * LaTeX source failed to render. `LATEX_EMPTY_PLACEHOLDER`'s fallback is the
 * SAME word as the slash-menu item's own name (`LATEX_SLASH_BLOCK_NAME`), but
 * it is a different surface (rendered inside the katex container, not the
 * slash menu), so it keeps its own key rather than aliasing.
 */
export const LATEX_EMPTY_PLACEHOLDER = EQUATION_EMPTY_LABEL;

export const LATEX_ERROR_PLACEHOLDER = EQUATION_ERROR_LABEL;

/**
 * Every wording declared above, in declaration order — walked by
 * `PACKAGE_WORDINGS` in `packages/affine/all/src/translations.ts`. The two
 * caption aliases (`LATEX_SLASH_INLINE_CAPTION` / `_BLOCK_CAPTION`) are not
 * listed again, same rule the note/slash-menu packages' own chrome aliases
 * already follow.
 */
export const LATEX_WORDINGS: readonly ChromeWording[] = [
  LATEX_SLASH_INLINE_NAME,
  LATEX_SLASH_INLINE_DESCRIPTION,
  LATEX_SLASH_BLOCK_NAME,
  LATEX_SLASH_BLOCK_DESCRIPTION,
  LATEX_TOOLTIP_INTRO,
  LATEX_TOOLTIP_BLOCK_INTRO,
];
