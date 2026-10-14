import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';

export type Wording = (wording: ChromeWording) => string;

/**
 * Resolve the data-view's wordings through the translation seam when an
 * editor is there (`stdContext`), in English otherwise (a unit test, a
 * standalone mount). A popup renders outside the host, so its opener
 * resolves the words and hands this function down.
 */
export const wordingOf =
  (std: BlockStdScope | undefined): Wording =>
  ([key, fallback]) =>
    std ? translateKey(std, key, fallback) : fallback;

export const englishWording: Wording = ([, fallback]) => fallback;
