import {
  evaluateRules,
  type ValidationRule,
  type Violation,
} from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { WARDLEY_ROLE } from '../roles';
import { WARDLEY_RULES } from '../rules';

/**
 * Element stand-in: the engine only ever reads `id`, `type`, `role` and
 * `elementBound`. `elementBound` is a GETTER that allocates, exactly like the
 * real accessor — the bench must not measure a cheaper element than production.
 */
function element(
  id: string,
  type: string,
  xywh: [number, number, number, number],
  role?: string
): GfxPrimitiveElementModel {
  return {
    id,
    type,
    role,
    get elementBound() {
      return new Bound(...xywh);
    },
  } as unknown as GfxPrimitiveElementModel;
}

/** The map itself: a 1600x900 background at the origin. */
const background = () => element('bg', 'wardley', [0, 0, 1600, 900]);

const inside = (id: string, role?: string) =>
  element(id, 'wardleyNode', [100, 100, 40, 40], role);
const outside = (id: string, role?: string) =>
  element(id, 'wardleyNode', [2000, 2000, 40, 40], role);

const evaluate = (elements: GfxPrimitiveElementModel[]) =>
  evaluateRules(WARDLEY_RULES, elements);

describe('wardley pilot rule: component outside the map', () => {
  it('flags a component drawn outside the map', () => {
    const violations = evaluate([
      background(),
      outside('c1', WARDLEY_ROLE.component),
    ]);

    expect(violations).toHaveLength(1);
    expect(violations[0].elementIds).toEqual(['c1']);
  });

  it('says nothing about a component drawn on the map', () => {
    expect(
      evaluate([background(), inside('c1', WARDLEY_ROLE.component)])
    ).toEqual([]);
  });

  it('flags a component only partly off the map', () => {
    // Straddling the right edge: `contains` is total containment.
    const straddling = element(
      'c1',
      'wardleyNode',
      [1580, 400, 40, 40],
      WARDLEY_ROLE.component
    );

    expect(evaluate([background(), straddling])).toHaveLength(1);
  });

  it('produces a well-formed violation object, with no prose', () => {
    const [violation] = evaluate([
      background(),
      outside('c1', WARDLEY_ROLE.component),
    ]);

    expect(violation).toStrictEqual<Violation>({
      ruleId: 'wardley.component-outside-map',
      elementIds: ['c1'],
      severity: 'warning',
      messageKey: 'com.labre.wardley.validation.component-outside-map',
      suggestion:
        'com.labre.wardley.validation.component-outside-map.suggestion',
    });
    // The engine renders no text: everything human-readable is an i18n key.
    expect(violation.messageKey).toMatch(/^com\.labre\./);
  });

  it('is a warning, never blocking — the sketch wins', () => {
    expect(WARDLEY_RULES[0].severity).toBe('warning');
  });

  it('says nothing when there is no map to be outside of', () => {
    // A Wardley node on a blank canvas is a sketch, not an error.
    expect(evaluate([outside('c1', WARDLEY_ROLE.component)])).toEqual([]);
  });
});

describe('proportionality: only the framework’s own roles are evaluated', () => {
  it('never evaluates a neutral element, wherever it sits', () => {
    const violations = evaluate([
      background(),
      // A generalist square, a free text, an inertia bar: no role at all.
      element('sq', 'shape', [3000, 3000, 40, 40]),
      element('tx', 'text', [3000, 3100, 40, 40]),
      outside('n1'),
    ]);

    expect(violations).toEqual([]);
  });

  it('ignores a role belonging to another framework', () => {
    expect(
      evaluate([background(), outside('e1', 'edgy:facet')])
    ).toEqual([]);
  });

  it('covers a specialisation through the role hierarchy', () => {
    // `wardley:market` specialises `wardley:component`: the rule written on
    // the parent catches it without ever naming it.
    const violations = evaluate([
      background(),
      outside('m1', WARDLEY_ROLE.market),
      outside('e1', WARDLEY_ROLE.ecosystem),
    ]);

    expect(violations.map(v => v.elementIds[0]).sort()).toEqual(['e1', 'm1']);
    expect(violations.every(v => v.ruleId === WARDLEY_RULES[0].id)).toBe(true);
  });

  it('leaves roles outside the rule’s scope alone', () => {
    // The anchor is a role of its own, not a component: out of scope, so no
    // message — proportionality means silence, not a softer warning.
    expect(
      evaluate([background(), outside('a1', WARDLEY_ROLE.anchor)])
    ).toEqual([]);
  });
});

describe('gating: no rule registered means no evaluation', () => {
  it('returns nothing when the framework flag is off', () => {
    // Flag off => the flag-gated WardleyViewExtension never registers its
    // rules => the manager resolves an empty rule list.
    const noRules: readonly ValidationRule[] = [];

    expect(
      evaluateRules(noRules, [
        background(),
        outside('c1', WARDLEY_ROLE.component),
      ])
    ).toEqual([]);
  });
});
