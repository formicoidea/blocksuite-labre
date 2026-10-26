import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * This package's own wordings, declared beside the code that renders them —
 * the two header toggles of the row and column menus (ADR 0043). The menus'
 * older labels ("Insert Left", "Delete"…) are still literals held by
 * `literals.baseline.json`; they move here in their own pass.
 */

export const TABLE_HEADER_ROW: ChromeWording = [
  'com.labre.table.header-row',
  'Header row',
];

export const TABLE_HEADER_COLUMN: ChromeWording = [
  'com.labre.table.header-column',
  'Header column',
];

/**
 * Every wording declared above, in declaration order — walked by
 * `PACKAGE_WORDINGS` in `packages/affine/all/src/translations.ts`.
 */
export const TABLE_WORDINGS: readonly ChromeWording[] = [
  TABLE_HEADER_ROW,
  TABLE_HEADER_COLUMN,
];
