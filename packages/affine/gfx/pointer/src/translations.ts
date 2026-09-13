import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * This package's own wordings, joined into `PACKAGE_WORDINGS` in
 * `@labre/affine/translations` — see that file and
 * `packages/affine/shared/src/services/translation-service/README.md`.
 */

export const POINTER_TOOLTIP_HAND: ChromeWording = [
  'com.labre.pointer.tooltip.hand',
  'Hand',
];

export const POINTER_TOOLTIP_SELECT: ChromeWording = [
  'com.labre.pointer.tooltip.select',
  'Select',
];

export const POINTER_WORDINGS: readonly ChromeWording[] = [
  POINTER_TOOLTIP_HAND,
  POINTER_TOOLTIP_SELECT,
];
