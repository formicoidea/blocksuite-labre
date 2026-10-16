import {
  type ChromeWording,
  fillPlaceholders,
  type TranslationParams,
  translateKey,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';

/**
 * `params` fills `{{name}}` placeholders; the host pluralises on `count`, the
 * English fallback stays neutral.
 */
export type Wording = (
  wording: ChromeWording,
  params?: TranslationParams
) => string;

/**
 * Resolve the data-view's wordings through the translation seam when an
 * editor is there (`stdContext`), in English otherwise (a unit test, a
 * standalone mount). A popup renders outside the host, so its opener
 * resolves the words and hands this function down.
 */
export const wordingOf =
  (std: BlockStdScope | undefined): Wording =>
  ([key, fallback], params) =>
    std
      ? translateKey(std, key, fallback, params)
      : fillPlaceholders(fallback, params);

export const englishWording: Wording = ([, fallback], params) =>
  fillPlaceholders(fallback, params);
