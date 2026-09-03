import { WARDLEY_COMPETITION } from './natures';

/**
 * The letter and the tag, in both directions — the whole of what makes the
 * drawing and the qualification say the same thing.
 *
 * A pure module on purpose: this is the only place where the notation
 * (`R` / `L` / `E`, one character in a circle) and the queryable fact
 * (`wardley:competition/...`) are related to one another, and it is the part of
 * `WardleyPorterWatcher` worth being wrong about. Nothing here reads an
 * element, a surface or a document.
 */

/** The three letters the notation admits, and nothing else. */
export type WardleyPorterLetter = 'R' | 'L' | 'E';

const LETTER_OF_VALUE: Readonly<Record<string, WardleyPorterLetter>> = {
  [WARDLEY_COMPETITION.relative]: 'R',
  [WARDLEY_COMPETITION.struggle]: 'L',
  [WARDLEY_COMPETITION.establish]: 'E',
};

const VALUE_OF_LETTER: Readonly<Record<WardleyPorterLetter, string>> = {
  R: WARDLEY_COMPETITION.relative,
  L: WARDLEY_COMPETITION.struggle,
  E: WARDLEY_COMPETITION.establish,
};

/**
 * What a competition value is written as, `null` when it is not one of the
 * three.
 *
 * Total over anything a DOCUMENT can carry, not just over the ids this pack
 * declares: defs are runtime configuration and are never persisted, so a board
 * may legitimately hold a value whose pack was removed or renamed. Such a value
 * has no letter, and the watcher leaves the circle alone rather than guessing
 * one.
 */
export function porterLetterOfCompetition(
  valueId: string | null | undefined
): WardleyPorterLetter | null {
  if (typeof valueId !== 'string') return null;
  // A null-prototype lookup would be tidier, but the table is a literal and
  // `Object.hasOwn` is what stops `'toString'` resolving to a letter.
  return Object.hasOwn(LETTER_OF_VALUE, valueId)
    ? LETTER_OF_VALUE[valueId]
    : null;
}

/**
 * The competition value a circle's text states, `null` when it states none.
 *
 * Deliberately forgiving in exactly two ways and strict everywhere else. It
 * trims — the shape editor keeps whatever whitespace the author left — and it
 * upper-cases, because `l` is the same force as `L` and refusing it would make
 * the qualification depend on a shift key. It then demands EXACTLY one of the
 * three letters: `RL` is not a force, `X` is not a force, and neither is an
 * empty circle. Anything else clears the tag rather than picking the nearest
 * value, because a glyph nobody can read must not be reported as a force
 * somebody named.
 */
export function competitionOfPorterLetter(
  text: string | null | undefined
): string | null {
  if (typeof text !== 'string') return null;
  const letter = text.trim().toUpperCase();
  return Object.hasOwn(VALUE_OF_LETTER, letter)
    ? VALUE_OF_LETTER[letter as WardleyPorterLetter]
    : null;
}
