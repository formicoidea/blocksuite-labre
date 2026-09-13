import {
  BLOCK_NAME_HEADING_1,
  BLOCK_NAME_HEADING_2,
  BLOCK_NAME_HEADING_3,
  BLOCK_NAME_HEADING_4,
  BLOCK_NAME_HEADING_5,
  BLOCK_NAME_HEADING_6,
  type ChromeWording,
} from '@labre/affine-shared/services';

/**
 * This package's own wordings, declared beside the code that renders them —
 * the empty-paragraph placeholder (`./view.ts`). The heading placeholders
 * ("Heading 1".."Heading 6") say the exact same words as the gfx/note menu's
 * own block-type names, so they are re-exported from `chrome.ts` rather than
 * declared again.
 */

export const PARAGRAPH_PLACEHOLDER_H1 = BLOCK_NAME_HEADING_1;
export const PARAGRAPH_PLACEHOLDER_H2 = BLOCK_NAME_HEADING_2;
export const PARAGRAPH_PLACEHOLDER_H3 = BLOCK_NAME_HEADING_3;
export const PARAGRAPH_PLACEHOLDER_H4 = BLOCK_NAME_HEADING_4;
export const PARAGRAPH_PLACEHOLDER_H5 = BLOCK_NAME_HEADING_5;
export const PARAGRAPH_PLACEHOLDER_H6 = BLOCK_NAME_HEADING_6;

export const PARAGRAPH_PLACEHOLDER_TEXT: ChromeWording = [
  'com.labre.paragraph.placeholder.text',
  "Type '/' for commands",
];

/**
 * `./paragraph-block.ts` renders whatever `getPlaceholder(model)` returns —
 * a public extension option (`ParagraphBlockConfigExtension`), so its
 * signature stays untouched rather than widened to take `std`. Its DEFAULT
 * implementation still returns the plain English literal (`./view.ts`'s
 * `placeholders` map); this table lets the render site look that literal up
 * and resolve it through the seam, while a host-supplied `getPlaceholder`
 * that returns anything else keeps reading exactly as it did before.
 */
export const PARAGRAPH_PLACEHOLDER_WORDINGS: Readonly<
  Record<string, ChromeWording>
> = {
  "Type '/' for commands": PARAGRAPH_PLACEHOLDER_TEXT,
  'Heading 1': PARAGRAPH_PLACEHOLDER_H1,
  'Heading 2': PARAGRAPH_PLACEHOLDER_H2,
  'Heading 3': PARAGRAPH_PLACEHOLDER_H3,
  'Heading 4': PARAGRAPH_PLACEHOLDER_H4,
  'Heading 5': PARAGRAPH_PLACEHOLDER_H5,
  'Heading 6': PARAGRAPH_PLACEHOLDER_H6,
};

/**
 * Every wording DECLARED IN THIS FILE (not re-exported from `chrome.ts`), in
 * declaration order — walked by `PACKAGE_WORDINGS` in
 * `packages/affine/all/src/translations.ts`.
 */
export const PARAGRAPH_WORDINGS: readonly ChromeWording[] = [
  PARAGRAPH_PLACEHOLDER_TEXT,
];
