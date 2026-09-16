import { type ChromeWording } from '@labre/affine-shared/services';

/** `@labre/affine-inline-reference`'s own wordings — the alias-editing popup. */
export const REFERENCE_TITLE_PLACEHOLDER: ChromeWording = [
  'com.labre.inline-reference.popup.title-placeholder',
  'Add a custom title',
];

/**
 * Every wording declared above, in declaration order — walked by
 * `PACKAGE_WORDINGS` in `packages/affine/all/src/translations.ts`.
 */
export const REFERENCE_WORDINGS: readonly ChromeWording[] = [
  REFERENCE_TITLE_PLACEHOLDER,
];
