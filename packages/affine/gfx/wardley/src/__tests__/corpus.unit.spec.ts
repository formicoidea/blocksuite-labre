import { evaluateRules } from '@labre/affine-block-surface';
import { describe, expect, it } from 'vitest';

import { WARDLEY_PROFILES } from '../profiles';
import { WARDLEY_RULES } from '../rules';
import {
  cardElements,
  type CorpusCard,
  TRANSITIONS,
  WARDLEY_CORPUS,
} from './corpus/fixtures';

/**
 * The corpus recipe: MODEL + ENGINE only, no editor, no canvas, no DI.
 *
 * Each card of `corpus/fixtures.ts` is a whole map and the exact set of rule
 * ids it must raise — a valid one raises nothing, an invalid one raises
 * precisely what it is named for and not a companion finding nobody asked for.
 * Over-reporting fails as loudly as under-reporting, which is the point: a rule
 * that indicts something extra is a rule nobody will keep switched on.
 *
 * Cards are judged on the STRICT profile: `sketch` demotes everything to
 * `audit` on purpose, so a corpus run against the default would pass with the
 * rules doing nothing.
 */

const strict = 'wardley.strict';

function violationsOf(card: CorpusCard): string[] {
  return evaluateRules(
    WARDLEY_RULES,
    cardElements(card, strict),
    WARDLEY_PROFILES
  )
    .map(violation => violation.ruleId)
    .sort();
}

describe('the Wardley corpus', () => {
  it('is built on the declaration, not on copied numbers', () => {
    // The three phase transitions of a 1600-wide map, read off the background
    // declaration. If the declaration moves, every card moves with it.
    expect(TRANSITIONS).toHaveLength(3);
    for (const at of TRANSITIONS) {
      expect(at).toBeGreaterThan(0);
      expect(at).toBeLessThan(1600);
    }
  });

  it('covers every rule the framework ships, from both sides', () => {
    // At least two valid cards and one invalid card per rule — the floor the
    // recipe is written against, checked rather than assumed.
    for (const rule of WARDLEY_RULES) {
      const invalid = WARDLEY_CORPUS.filter(card =>
        card.expected.includes(rule.id)
      );
      expect(invalid.length, `no invalid card for ${rule.id}`).toBeGreaterThan(0);
    }
    const valid = WARDLEY_CORPUS.filter(card => card.expected.length === 0);
    expect(valid.length).toBeGreaterThanOrEqual(WARDLEY_RULES.length * 2);
  });

  for (const card of WARDLEY_CORPUS) {
    it(card.name, () => {
      expect(violationsOf(card)).toEqual([...card.expected].sort());
    });
  }
});
