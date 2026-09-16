import {
  type ChromeWording,
  UNKNOWN_LABEL,
} from '@labre/affine-shared/services';

/**
 * The remote cursor's own fallback label, shown under a collaborator's
 * cursor when their `awarenessStore` user record carries no name. An alias
 * (L7 dedupe): the same word as {@link UNKNOWN_LABEL}, one key.
 */
export const REMOTE_SELECTION_UNKNOWN_USER = UNKNOWN_LABEL;

/**
 * Every wording DECLARED IN THIS FILE — none: this package's one wording
 * aliases `chrome.ts` (L7 dedupe), so nothing is restated here.
 */
export const REMOTE_SELECTION_WORDINGS: readonly ChromeWording[] = [];
