import { evaluateRules, type Violation } from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { CM_PATTERN_ROLE, CONTEXT_MAP_ROLE } from '../roles';
import { CONTEXT_MAP_RULES } from '../rules';

/**
 * The five Context Map rules, rule by rule — and above all what each of them
 * stays SILENT about. Silence is the expensive half: a rule that fires on a
 * sketch is a rule the workshop switches off.
 */

const CM1 = 'context-map.relationship-endpoints';
const CM2 = 'context-map.acl-conformist-exclusive';
const CM3 = 'context-map.pattern-on-customer-supplier';
const CM4 = 'context-map.acl-on-customer-supplier';
const CM5 = 'context-map.context-off-board';

/** The engine reads `id`, `role`, `elementBound` and an edge's `source`/`target`. */
function element(
  id: string,
  xywh: [number, number, number, number],
  role?: string,
  ends?: { source: string; target: string }
): GfxPrimitiveElementModel {
  return {
    id,
    role,
    ...(ends
      ? { source: { id: ends.source }, target: { id: ends.target } }
      : {}),
    get elementBound() {
      return new Bound(...xywh);
    },
  } as unknown as GfxPrimitiveElementModel;
}

/** The board: 1400×900 at the origin, carrying its role. */
const board = () => element('bg', [0, 0, 1400, 900], CONTEXT_MAP_ROLE.board);

/** A board authored before `context-map:board` existed: same box, no role. */
const legacyBoard = () => element('bg', [0, 0, 1400, 900]);

const context = (id: string, x = 100, y = 100) =>
  element(id, [x, y, 150, 70], CONTEXT_MAP_ROLE.context);

/** A neutral drawing — a cloud, a note, a rectangle somebody thought with. */
const sketch = (id: string, x = 100, y = 400) => element(id, [x, y, 180, 120]);

const link = (
  id: string,
  role: string | undefined,
  source: string,
  target: string
) => element(id, [200, 150, 300, 1], role, { source, target });

const evaluate = (elements: GfxPrimitiveElementModel[]) =>
  evaluateRules(CONTEXT_MAP_RULES, elements);

const idsOf = (violations: readonly Violation[]) =>
  violations.map(violation => violation.ruleId).sort();

describe('what the framework ships', () => {
  it('ships exactly the five rules of the pack', () => {
    expect(CONTEXT_MAP_RULES.map(rule => rule.id)).toEqual([
      CM1,
      CM2,
      CM3,
      CM4,
      CM5,
    ]);
  });

  it('namespaces every rule and holds no prose in the engine', () => {
    for (const rule of CONTEXT_MAP_RULES) {
      expect(rule.framework).toBe('ddd-context-map');
      expect(rule.id.startsWith('context-map.')).toBe(true);
      expect(rule.messageKey).toMatch(/^com\.labre\./);
      expect(rule.messageFallback).toBeTruthy();
      expect(rule.backgroundRole).toBe(CONTEXT_MAP_ROLE.board);
    }
  });

  it('never declares a level the pipework cannot honour', () => {
    // `blocking-overridable` is carried by the engine and acted on by nobody.
    for (const rule of CONTEXT_MAP_RULES) {
      expect(['warning', 'audit']).toContain(rule.severity);
    }
    expect(CONTEXT_MAP_RULES.find(rule => rule.id === CM4)?.severity).toBe(
      'audit'
    );
  });
});

describe('CM1 · the endpoints of a relationship', () => {
  it('says nothing about a well-formed relationship', () => {
    expect(
      evaluate([
        board(),
        context('a'),
        context('b', 600, 100),
        link('r1', CM_PATTERN_ROLE.partnership, 'a', 'b'),
      ])
    ).toEqual([]);
  });

  it('says nothing about an end that is not a bounded context', () => {
    // The alphabet of this rule is `context-map:context` and nothing else, so
    // an end carrying any other role takes the whole edge out of the
    // conversation — off-matrix is structurally unreachable, by design. See the
    // header of `relationshipEndpoints`.
    expect(
      evaluate([
        board(),
        context('a'),
        element('x', [600, 100, 150, 70], CONTEXT_MAP_ROLE.board),
        link('r1', CM_PATTERN_ROLE.acl, 'a', 'x'),
      ])
    ).toEqual([]);
  });

  it('flags a relationship looping back onto its own context', () => {
    const violations = evaluate([
      board(),
      context('a'),
      link('r1', CM_PATTERN_ROLE.conformist, 'a', 'a'),
    ]);
    expect(idsOf(violations)).toEqual([CM1]);
    expect(violations[0].elementIds).toEqual(['a', 'r1']);
  });

  it('flags the same pattern drawn twice the same way round', () => {
    const violations = evaluate([
      board(),
      context('a'),
      context('b', 600, 100),
      link('r1', CM_PATTERN_ROLE.ohs, 'a', 'b'),
      link('r2', CM_PATTERN_ROLE.ohs, 'a', 'b'),
    ]);
    expect(idsOf(violations)).toEqual([CM1]);
    // The FIRST link keeps its innocence; the copy is the finding.
    expect(violations[0].elementIds).toEqual(['a', 'b', 'r2']);
  });

  it('says nothing about two DIFFERENT patterns on one couple', () => {
    // C/S with OHS is DDD Crew's own example of a legitimate combination —
    // except that C/S + OHS is what CM3 arbitrates, so use two that coexist.
    expect(
      evaluate([
        board(),
        context('a'),
        context('b', 600, 100),
        link('r1', CM_PATTERN_ROLE.ohs, 'a', 'b'),
        link('r2', CM_PATTERN_ROLE.publishedLanguage, 'a', 'b'),
      ])
    ).toEqual([]);
  });

  it('says nothing about a relationship onto a neutral drawing', () => {
    // The hard requirement of the family: an end outside the alphabet takes the
    // whole edge out of the conversation. A cloud carries no role in v1, so
    // integrating with a Big Ball of Mud system is a sketch, not a fault.
    expect(
      evaluate([
        board(),
        context('a'),
        sketch('cloud'),
        link('r1', CM_PATTERN_ROLE.acl, 'a', 'cloud'),
      ])
    ).toEqual([]);
  });

  it('says nothing about a link carrying no role at all', () => {
    // Every relationship drawn before WS2 — proportionality, promesse #71.
    expect(
      evaluate([
        board(),
        context('a'),
        context('b', 600, 100),
        link('r1', undefined, 'a', 'b'),
      ])
    ).toEqual([]);
  });

  it('says nothing about a relationship with a free end', () => {
    expect(
      evaluate([
        board(),
        context('a'),
        element('r1', [200, 150, 300, 1], CM_PATTERN_ROLE.partnership, {
          source: 'a',
          target: 'gone',
        }),
      ])
    ).toEqual([]);
  });
});

describe('CM2 · Conformist and ACL cannot both be true', () => {
  const couple = (...links: GfxPrimitiveElementModel[]) => [
    board(),
    context('a'),
    context('b', 600, 100),
    ...links,
  ];

  it('flags the pair, naming both links and both contexts', () => {
    const violations = evaluate(
      couple(
        link('r1', CM_PATTERN_ROLE.conformist, 'a', 'b'),
        link('r2', CM_PATTERN_ROLE.acl, 'a', 'b')
      )
    );
    expect(idsOf(violations)).toEqual([CM2]);
    expect(violations[0].elementIds).toEqual(['a', 'b', 'r1', 'r2']);
  });

  it('flags it whichever way round the two links were drawn', () => {
    // The node pair is unordered, and so is the role pair.
    expect(
      idsOf(
        evaluate(
          couple(
            link('r1', CM_PATTERN_ROLE.acl, 'a', 'b'),
            link('r2', CM_PATTERN_ROLE.conformist, 'b', 'a')
          )
        )
      )
    ).toEqual([CM2]);
  });

  it('says nothing when the two patterns sit on different couples', () => {
    expect(
      evaluate([
        board(),
        context('a'),
        context('b', 600, 100),
        context('c', 1000, 100),
        link('r1', CM_PATTERN_ROLE.conformist, 'a', 'b'),
        link('r2', CM_PATTERN_ROLE.acl, 'a', 'c'),
      ])
    ).toEqual([]);
  });
});

describe('CM3 / CM4 · what may ride on a Customer/Supplier', () => {
  const couple = (...links: GfxPrimitiveElementModel[]) => [
    board(),
    context('a'),
    context('b', 600, 100),
    ...links,
  ];

  it('flags a Conformist on a Customer/Supplier', () => {
    expect(
      idsOf(
        evaluate(
          couple(
            link('r1', CM_PATTERN_ROLE.customerSupplier, 'a', 'b'),
            link('r2', CM_PATTERN_ROLE.conformist, 'a', 'b')
          )
        )
      )
    ).toEqual([CM3]);
  });

  it('flags an Open Host Service on a Customer/Supplier', () => {
    expect(
      idsOf(
        evaluate(
          couple(
            link('r1', CM_PATTERN_ROLE.customerSupplier, 'a', 'b'),
            link('r2', CM_PATTERN_ROLE.ohs, 'a', 'b')
          )
        )
      )
    ).toEqual([CM3]);
  });

  it('reports an ACL on a Customer/Supplier as an AUDIT finding', () => {
    const violations = evaluate(
      couple(
        link('r1', CM_PATTERN_ROLE.customerSupplier, 'a', 'b'),
        link('r2', CM_PATTERN_ROLE.acl, 'a', 'b')
      )
    );
    expect(idsOf(violations)).toEqual([CM4]);
    expect(violations[0].severity).toBe('audit');
  });

  it('says nothing about a Published Language on a Customer/Supplier', () => {
    expect(
      evaluate(
        couple(
          link('r1', CM_PATTERN_ROLE.customerSupplier, 'a', 'b'),
          link('r2', CM_PATTERN_ROLE.publishedLanguage, 'a', 'b')
        )
      )
    ).toEqual([]);
  });
});

describe('CM5 · a bounded context belongs on the map', () => {
  it('flags a context parked beside the board', () => {
    const violations = evaluate([board(), context('a', 1600, 100)]);
    expect(idsOf(violations)).toEqual([CM5]);
    expect(violations[0].elementIds).toEqual(['a']);
    expect(violations[0].backgroundId).toBe('bg');
  });

  it('says nothing about a context on the board', () => {
    expect(evaluate([board(), context('a')])).toEqual([]);
  });

  it('says nothing when there is no board to be off', () => {
    // A context map sketched on the bare canvas, and a board drawn before the
    // role existed, are the same case: no frame, no verdict.
    expect(evaluate([context('a', 1600, 100)])).toEqual([]);
    expect(evaluate([legacyBoard(), context('a', 1600, 100)])).toEqual([]);
  });

  it('says nothing about a neutral shape off the board', () => {
    expect(evaluate([board(), sketch('note', 1600, 100)])).toEqual([]);
  });
});
