import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * This package's own wordings, declared beside the code that renders them —
 * the slash-menu's single "Callout" item.
 */

export const CALLOUT_SLASH_NAME: ChromeWording = [
  'com.labre.callout.slash-menu.name',
  'Callout',
];

export const CALLOUT_SLASH_DESCRIPTION: ChromeWording = [
  'com.labre.callout.slash-menu.description',
  'Let your words stand out.',
];

/** The item's tooltip caption says the exact same word as its name. */
export const CALLOUT_SLASH_CAPTION = CALLOUT_SLASH_NAME;

/**
 * Every wording declared above, in declaration order — walked by
 * `PACKAGE_WORDINGS` in `packages/affine/all/src/translations.ts`. The
 * caption alias is not listed again, same rule other packages' chrome
 * aliases already follow.
 */
export const CALLOUT_WORDINGS: readonly ChromeWording[] = [
  CALLOUT_SLASH_NAME,
  CALLOUT_SLASH_DESCRIPTION,
];
