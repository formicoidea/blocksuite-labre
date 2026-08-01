import { evaluateRules } from '@labre/affine-block-surface';
import { describe, expect, it } from 'vitest';

import { WARDLEY_PROFILES } from '../profiles';
import { WARDLEY_ROLE } from '../roles';
import { WARDLEY_RULES } from '../rules';
import {
  cardElements,
  type CorpusCard,
  TRANSITIONS,
  WARDLEY_CORPUS,
} from './corpus/fixtures';
import { TEMPLATE_CARDS } from './corpus/templates';

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

const findingsOf = (card: CorpusCard) =>
  evaluateRules(WARDLEY_RULES, cardElements(card, strict), WARDLEY_PROFILES);

const violationsOf = (card: CorpusCard) =>
  findingsOf(card)
    .map(violation => violation.ruleId)
    .sort();

const namedFindingsOf = (card: CorpusCard) =>
  findingsOf(card)
    .map(v => `${v.ruleId}:${v.elementIds.join('+')}`)
    .sort();

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

  it('carries at least one card that is wrong in several ways at once', () => {
    // A card with two elements on it can only be reporting one thing, so it
    // never catches an over-eager rule. One card has to be a real map.
    const crowded = WARDLEY_CORPUS.filter(card => card.expected.length > 2);
    expect(crowded.length).toBeGreaterThan(0);
    expect(Math.max(...crowded.map(c => c.elements.length))).toBeGreaterThan(15);
  });

  for (const card of WARDLEY_CORPUS) {
    it(card.name, () => {
      expect(violationsOf(card)).toEqual([...card.expected].sort());
      if (card.expectedIds) {
        expect(namedFindingsOf(card)).toEqual([...card.expectedIds].sort());
      }
    });
  }
});

/**
 * The invariant the slice was missing: **a template the product ships must
 * evaluate to zero findings, at the strictest level of requirement.**
 *
 * A preset is the first Wardley map most users ever see. One that breaks the
 * rules the same release introduces teaches the wrong thing to exactly the
 * people who trust it most — and under the default `sketch` profile it does so
 * invisibly, until somebody switches their map to `strict` and gets a badge on
 * the centrepiece.
 *
 * These are also the only real maps in the repository, so they are the corpus
 * cards the hand-written fixtures cannot be: dozens of elements, every role,
 * every family at once.
 */
describe('every shipped template is conformant', () => {
  it('ships templates worth checking', () => {
    // Guard against the reader silently resolving nothing.
    expect(TEMPLATE_CARDS.length).toBeGreaterThan(10);
    const biggest = Math.max(...TEMPLATE_CARDS.map(c => c.elements.length));
    expect(biggest).toBeGreaterThan(30);
  });

  for (const card of TEMPLATE_CARDS) {
    it(`${card.name} raises nothing under strict`, () => {
      const onStrict = card.elements.map(el =>
        el.role === WARDLEY_ROLE.map
          ? ({
              id: el.id,
              role: el.role,
              validationProfile: strict,
              get elementBound() {
                return el.elementBound;
              },
            } as unknown as typeof el)
          : el
      );

      const findings = evaluateRules(
        WARDLEY_RULES,
        onStrict,
        WARDLEY_PROFILES
      ).map(v => `${v.ruleId}:${v.elementIds.join('+')}`);

      expect(findings).toEqual([]);
    });
  }
});
