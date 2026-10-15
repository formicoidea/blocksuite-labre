import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * "Discuss": the toolbar action that asks the host to open the discussion of
 * a block or a canvas element, and the accessible name of the mark drawn on
 * what already has one (ADR 0038).
 */
export const THREAD_DISCUSS: ChromeWording = [
  'com.labre.thread.discuss',
  'Discuss',
];

/** Every wording this package declares, in the order it renders them. */
export const THREAD_MARKS_WORDINGS: readonly ChromeWording[] = [THREAD_DISCUSS];
