import {
  translateKey,
  type TranslationService,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';

/**
 * Where an icon picker element finds its words: the `translation` a host
 * handed it (a picker mounted outside an editor has no `std` to ask, issue
 * #636), else the editor's translation seam through `std`, else the English
 * fallback of the declaration.
 *
 * `translation` is the same `TranslationService` a host already registers with
 * `TranslationExtension`, so its catalogue of `com.labre.*` keys serves the
 * picker unchanged.
 */
export interface IconPickerWordingSource {
  std?: BlockStdScope;
  translation?: TranslationService;
}

export function iconPickerWording(
  { std, translation }: IconPickerWordingSource,
  [key, fallback]: readonly [string, string]
): string {
  if (translation) {
    const own = translation.t(key);
    return own !== undefined && own !== '' ? own : fallback;
  }
  return std ? translateKey(std, key, fallback) : fallback;
}
