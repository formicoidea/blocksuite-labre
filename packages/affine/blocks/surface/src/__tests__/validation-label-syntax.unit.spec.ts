import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel, RoleDefs } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';

import {
  evaluateCheckup,
  evaluateRules,
  RULE_SCOPES,
  scopeOf,
  type ValidationRule,
  VERDICT_PROPS,
  verdictPropsOf,
} from '../extensions/validation.js';

/**
 * The `label-syntax` family: are the subject's words SPELLED the way the
 * notation spells them?
 *
 * `label-presence` asks whether anything is written; this one asks whether what
 * is written parses. The parser belongs to the FRAMEWORK — a notation's grammar
 * is a grammar, not a table — so the engine's half is only the WALK, and that is
 * what this suite pins: which label is read, how it is cut into lines, which
 * lines are notation rather than content, and what a `false` turns into.
 *
 * The toy parser below is deliberately not UML's. The engine must never know a
 * notation, and a suite written against `gfx/uml/src/grammar.ts` would be
 * testing that grammar twice (`gfx/uml/src/__tests__/rules.unit.spec.ts` owns
 * the real one).
 */

const ROLES: RoleDefs = {
  'test:frame': { id: 'test:frame', kind: 'node', labelKey: 'test.frame' },
  'test:members': {
    id: 'test:members',
    kind: 'text',
    labelKey: 'test.members',
  },
  // A specialisation, so a rule written on the parent covers it for free.
  'test:inherited-members': {
    id: 'test:inherited-members',
    parent: 'test:members',
    kind: 'text',
    labelKey: 'test.inherited-members',
  },
  'test:other': { id: 'test:other', kind: 'text', labelKey: 'test.other' },
  'test:link': { id: 'test:link', kind: 'edge', labelKey: 'test.link' },
};

/**
 * The toy grammar: a member line is `name: Type`, and nothing else.
 *
 * Two ways of failing, one with a reason and one without, because the family
 * prints them differently and both shapes have to be exercised.
 */
const member = (line: string) => {
  if (!line.includes(':')) return { ok: false, reason: 'no type' };
  if (line.startsWith(':')) return { ok: false };
  return { ok: true };
};

/** "Every member says what type it is." */
const MEMBER_SYNTAX: ValidationRule = {
  id: 'test.member-syntax',
  framework: 'test',
  family: 'label-syntax',
  severity: 'warning',
  appliesTo: 'test:members',
  roles: ROLES,
  messageKey: 'com.labre.test.member-syntax',
  messageFallback: 'This line is not a member declaration:',
  suggestionKey: 'com.labre.test.member-syntax.suggestion',
  suggestionFallback: 'Write it as "name: Type".',
  version: 1,
  backgroundRole: 'test:frame',
  labelSyntax: { parse: member },
};

function element(
  id: string,
  xywh: [number, number, number, number],
  props: Record<string, unknown> = {}
): GfxPrimitiveElementModel {
  const stub = {
    id,
    type: 'test',
    ...props,
    get elementBound() {
      return new Bound(...xywh);
    },
  };
  return stub as unknown as GfxPrimitiveElementModel;
}

const frame = (id = 'frame') =>
  element(id, [0, 0, 1000, 1000], { role: 'test:frame' });

/** A compartment: a text element carrying the tier role and its lines. */
const tier = (id: string, text?: string, role = 'test:members') =>
  element(id, [50, 50, 100, 40], {
    role,
    ...(text === undefined ? {} : { text }),
  });

const run = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  evaluateRules([rule], elements);

const ids = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  run(rule, elements).map(violation => violation.elementIds.join('+'));

describe('reading a label against the framework’s own grammar', () => {
  it('says nothing about a compartment that parses', () => {
    expect(
      ids(MEMBER_SYNTAX, [frame(), tier('a', 'total: Money\nname: String')])
    ).toEqual([]);
  });

  it('indicts a compartment holding one bad line', () => {
    const found = run(MEMBER_SYNTAX, [
      frame(),
      tier('a', 'total: Money\nbroken\nname: String'),
    ]);

    expect(found.map(violation => violation.elementIds)).toEqual([['a']]);
    expect(found[0].messageKey).toBe('com.labre.test.member-syntax');
    expect(found[0].suggestion).toBe('com.labre.test.member-syntax.suggestion');
    expect(found[0].suggestionFallback).toBe('Write it as "name: Type".');
  });

  it('names the FIRST bad line and the reason in its own sentence', () => {
    const [found] = run(MEMBER_SYNTAX, [
      frame(),
      tier('a', 'first bad\nsecond bad'),
    ]);

    expect(found.messageFallback).toBe(
      'This line is not a member declaration: “first bad” — no type.'
    );
  });

  it('quotes the line without a reason when the parser gives none', () => {
    const [found] = run(MEMBER_SYNTAX, [frame(), tier('a', ': Money')]);

    expect(found.messageFallback).toBe(
      'This line is not a member declaration: “: Money”'
    );
  });

  it('raises ONE finding per element, however many lines are wrong', () => {
    // Six lines of a compartment with three of them unfinished is three
    // brackets on one text element and one thing to fix.
    expect(ids(MEMBER_SYNTAX, [frame(), tier('a', 'one\ntwo\nthree')])).toEqual(
      ['a']
    );
  });

  it('elides a very long line rather than setting the width of the panel', () => {
    const long = `${'x'.repeat(200)}`;
    const [found] = run(MEMBER_SYNTAX, [frame(), tier('a', long)]);

    // 79 characters plus the ellipsis — the cap, not the line.
    expect(found.messageFallback).toBe(
      `This line is not a member declaration: “${'x'.repeat(79)}…” — no type.`
    );
  });

  it('attributes the finding to the frame it was drawn on', () => {
    expect(
      run(MEMBER_SYNTAX, [frame('board'), tier('a', 'broken')])[0].backgroundId
    ).toBe('board');
  });

  it('covers a specialisation of the subject role', () => {
    expect(
      ids(MEMBER_SYNTAX, [
        frame(),
        tier('s', 'broken', 'test:inherited-members'),
      ])
    ).toEqual(['s']);
  });

  it('reads a live Y.Text-like value the way the canvas holds one', () => {
    // Duck-typed on `toString`, exactly like `label-presence` is.
    const holder = { toString: () => 'ok: Type\nbroken' };
    expect(
      ids(MEMBER_SYNTAX, [
        frame(),
        element('a', [50, 50, 100, 40], {
          role: 'test:members',
          text: holder,
        }),
      ])
    ).toEqual(['a']);
  });
});

describe('what a label-syntax rule stays silent about', () => {
  it('skips BLANK lines', () => {
    expect(
      ids(MEMBER_SYNTAX, [frame(), tier('a', 'total: Money\n\n  \nb: Int')])
    ).toEqual([]);
  });

  it('skips the ELLIPSIS, in both spellings', () => {
    // §9.2.4's elision marker: "there are more, not shown". A rule that
    // indicted it would indict the author for having said so.
    expect(
      ids(MEMBER_SYNTAX, [frame(), tier('a', 'total: Money\n...\n…')])
    ).toEqual([]);
  });

  it('says nothing about a label that is only invisible code points', () => {
    // Present in the string, absent from the page — and absent from the
    // finding, which would otherwise quote a line the author cannot see.
    expect(
      ids(MEMBER_SYNTAX, [
        frame(),
        tier('a', String.fromCharCode(0x200b, 0x2060, 0xfeff)),
      ])
    ).toEqual([]);
  });

  it('says nothing about an empty or absent label', () => {
    // "This artefact says nothing" is `label-presence`'s question, and a
    // framework that wants both asks them with two rules.
    expect(ids(MEMBER_SYNTAX, [frame(), tier('a', '')])).toEqual([]);
    expect(ids(MEMBER_SYNTAX, [frame(), tier('b')])).toEqual([]);
  });

  it('says nothing about an element carrying no role', () => {
    expect(
      ids(MEMBER_SYNTAX, [
        frame(),
        element('free', [0, 0, 40, 40], { text: 'broken' }),
      ])
    ).toEqual([]);
  });

  it('says nothing about a tier of another role', () => {
    expect(
      ids(MEMBER_SYNTAX, [frame(), tier('o', 'broken', 'test:other')])
    ).toEqual([]);
  });

  it('needs no frame on the board', () => {
    // `backgroundRole` buys attribution only — the `no-overlap` pattern.
    const found = run(MEMBER_SYNTAX, [tier('a', 'broken')]);

    expect(found.map(violation => violation.elementIds)).toEqual([['a']]);
    expect(found[0].backgroundId).toBeUndefined();
  });

  it('evaluates NOTHING when the rule carries no parse function', () => {
    // A rule of this family holds a closure and cannot survive a round trip
    // through JSON. Passing every line would be the dangerous answer: a
    // compartment nobody checks that reports itself checked.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const serialized = {
      ...MEMBER_SYNTAX,
      id: 'test.member-syntax-serialized',
      labelSyntax: {} as unknown as ValidationRule['labelSyntax'],
    };

    expect(ids(serialized, [frame(), tier('a', 'broken')])).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('evaluates nothing when the rule names no subject role', () => {
    const roleless: ValidationRule = { ...MEMBER_SYNTAX, appliesTo: undefined };
    expect(ids(roleless, [frame(), tier('a', 'broken')])).toEqual([]);
  });
});

/**
 * `perLine`, which is the whole difference between a COMPARTMENT and an
 * EXPRESSION: a list of attributes is judged line by line, a transition label or
 * a multiplicity is one subject whatever the author wrapped.
 */
describe('perLine', () => {
  const WHOLE: ValidationRule = {
    ...MEMBER_SYNTAX,
    id: 'test.whole-label',
    labelSyntax: {
      parse: line => ({
        ok: line === 'a\nb',
        reason: 'not the whole label',
      }),
      perLine: false,
    },
  };

  it('hands the WHOLE label to the parser, newlines kept', () => {
    expect(ids(WHOLE, [frame(), tier('a', 'a\nb')])).toEqual([]);
    expect(ids(WHOLE, [frame(), tier('b', 'a')])).toEqual(['b']);
  });

  it('still drops a label that is blank or elided', () => {
    expect(ids(WHOLE, [frame(), tier('a', '   ')])).toEqual([]);
    expect(ids(WHOLE, [frame(), tier('b', '...')])).toEqual([]);
  });
});

/**
 * WHICH label a rule reads — the reason {@link LabelTarget} exists. A
 * multiplicity is written at the END of an association and not in the middle of
 * it.
 */
describe('the three labels of a connector', () => {
  const END_SYNTAX = (target: 'source-label' | 'target-label') => ({
    ...MEMBER_SYNTAX,
    id: `test.${target}`,
    appliesTo: 'test:link' as const,
    labelSyntax: { parse: member, perLine: false, target },
  });

  const link = (props: Record<string, unknown>) =>
    element('link', [0, 0, 300, 1], { role: 'test:link', ...props });

  it('reads the FLAT end-label prop the connector model carries', () => {
    expect(
      ids(END_SYNTAX('source-label'), [
        frame(),
        link({ sourceLabel: 'broken' }),
      ])
    ).toEqual(['link']);
    expect(
      ids(END_SYNTAX('source-label'), [
        frame(),
        link({ sourceLabel: 'n: Int' }),
      ])
    ).toEqual([]);
  });

  it('reads a NESTED `{ text }` end label too', () => {
    // The shape the same field takes in an importer's serialized props.
    expect(
      ids(END_SYNTAX('target-label'), [
        frame(),
        link({ targetLabel: { text: 'broken' } }),
      ])
    ).toEqual(['link']);
  });

  it('never confuses one end with the other, or with the centre', () => {
    const board = [frame(), link({ text: 'broken', targetLabel: 'n: Int' })];
    expect(ids(END_SYNTAX('target-label'), board)).toEqual([]);
    expect(ids(END_SYNTAX('source-label'), board)).toEqual([]);
    // ...and the centre label is what the default target reads.
    expect(
      ids(
        {
          ...MEMBER_SYNTAX,
          id: 'test.centre',
          appliesTo: 'test:link',
          labelSyntax: { parse: member, perLine: false },
        },
        board
      )
    ).toEqual(['link']);
  });

  /**
   * `'end-labels'` — the two ends as two LINES of one subject, which is what
   * lets one rule cover a grammar the notation places at both ends.
   */
  describe('end-labels', () => {
    const BOTH_ENDS: ValidationRule = {
      ...MEMBER_SYNTAX,
      id: 'test.both-ends',
      appliesTo: 'test:link',
      labelSyntax: { parse: member, target: 'end-labels' },
    };

    it('judges each end on its own', () => {
      expect(
        ids(BOTH_ENDS, [
          frame(),
          link({ sourceLabel: 'a: Int', targetLabel: 'b: Int' }),
        ])
      ).toEqual([]);
      expect(
        ids(BOTH_ENDS, [
          frame(),
          link({ sourceLabel: 'a: Int', targetLabel: 'broken' }),
        ])
      ).toEqual(['link']);
    });

    it('quotes the end that is wrong', () => {
      const [found] = run(BOTH_ENDS, [
        frame(),
        link({ sourceLabel: 'a: Int', targetLabel: 'broken' }),
      ]);
      expect(found.messageFallback).toContain('“broken”');
    });

    it('raises ONE finding when both ends are wrong', () => {
      expect(
        ids(BOTH_ENDS, [
          frame(),
          link({ sourceLabel: 'one', targetLabel: 'two' }),
        ])
      ).toEqual(['link']);
    });

    it('says nothing about a connector labelled at neither end', () => {
      // The centre label is a different question and a different target: a
      // connector carrying a name in the middle has no end labels at all.
      expect(ids(BOTH_ENDS, [frame(), link({ text: 'broken' })])).toEqual([]);
    });
  });
});

/**
 * The dependency scope (ADR 0015) and what the family costs the drawing path.
 */
describe('what the family declares about itself', () => {
  it('is element-scoped: the verdict reads the subject’s own words', () => {
    expect(RULE_SCOPES['label-syntax']).toBe('element');
    expect(scopeOf(MEMBER_SYNTAX)).toBe('element');
  });

  it('makes text verdict-bearing only for a REAL-TIME rule', () => {
    expect(VERDICT_PROPS).not.toContain('text');
    expect(verdictPropsOf([MEMBER_SYNTAX]).has('text')).toBe(true);
    const later: ValidationRule = { ...MEMBER_SYNTAX, moment: 'on-demand' };
    expect(verdictPropsOf([later]).has('text')).toBe(false);
  });

  it('answers the same question at either moment', () => {
    const later: ValidationRule = { ...MEMBER_SYNTAX, moment: 'on-demand' };
    const board = [frame(), tier('a', 'broken')];

    expect(evaluateRules([later], board)).toEqual([]);
    expect(
      evaluateCheckup([later], board).map(v => v.elementIds.join('+'))
    ).toEqual(['a']);
  });
});
