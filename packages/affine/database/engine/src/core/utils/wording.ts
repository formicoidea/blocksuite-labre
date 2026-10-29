import {
  type ChromeWording,
  fillPlaceholders,
  type TranslationParams,
  translateKey,
} from '@labre/affine-shared/services';
import { type BlockStdScope, stdContext } from '@labre/std';
import { ContextEvent } from '@lit/context';

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

/**
 * The editor an element sits in, asked the way a `@consume` asks: a menu or
 * a cell built by a function with only its anchor in hand resolves its words
 * from there. Outside an editor (a unit test, a host panel that provides no
 * `std`), English.
 */
export const stdAround = (
  element: Element | null | undefined
): BlockStdScope | undefined => {
  let std: BlockStdScope | undefined;
  element?.dispatchEvent(
    new ContextEvent(stdContext, element, value => {
      std = value;
    })
  );
  return std;
};

/** {@link wordingOf} the editor `element` sits in. */
export const wordingFrom = (element: Element | null | undefined): Wording =>
  wordingOf(stdAround(element));

/**
 * A label declared with an optional wording beside its English text (a
 * filter, a property type, a statistic): the wording when there is one, the
 * text otherwise.
 */
export const propertyTypeName = (
  wording: Wording,
  config: { name: string; nameWording?: ChromeWording }
): string => sayLabel(wording, config.name, config.nameWording);

export const sayLabel = (
  wording: Wording,
  label: string,
  pair: ChromeWording | undefined
): string => (pair ? wording(pair) : label);
