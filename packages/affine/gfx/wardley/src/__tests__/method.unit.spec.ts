/**
 * The Wardley **method** tag (ADR 0046): what a component + method is offered,
 * and the table that relates each value to the wardley-map-renderer JSON pair
 * and to the ring it paints.
 *
 * Why it exists: the method node used to say its method only through a fill
 * colour picked from a palette — a fact no reader, no rule and no import could
 * name. The PO decision of 28/10/2026 is that a map imported from the
 * renderer's JSON (`method: { category, recommendation }`) lands as a real,
 * editable qualification and looks as it looked there. These pin the three
 * halves of that: the role reaches the tag, the tag holds the renderer's nine
 * facts and nothing else, and both directions of the pair agree.
 */
import {
  buildUniverseRegistry,
  tagAppliesToRole,
} from '@labre/affine-shared/services';
import { describe, expect, test } from 'vitest';

import {
  wardleyMethodOf,
  wardleyMethodParts,
  wardleyMethodRing,
} from '../method';
import {
  WARDLEY_METHOD,
  WARDLEY_METHOD_TAG_ID,
  WARDLEY_NATURE_TAG_ID,
  WARDLEY_TAG_DEFS,
} from '../natures';
import { METHOD_FAMILY_COLOR } from '../node/consts';
import { WARDLEY_ROLE, WARDLEY_ROLES } from '../roles';

const registry = buildUniverseRegistry([WARDLEY_TAG_DEFS]);

/** The renderer's three default `methods`, as its theme baseline spells them. */
const RENDERER_TABLE: ReadonlyArray<[string, string, string]> = [
  ['buying-policy', 'Uncharted', WARDLEY_METHOD.build],
  ['buying-policy', 'Transitional', WARDLEY_METHOD.buy],
  ['buying-policy', 'Industrialized', WARDLEY_METHOD.outsource],
  ['project-management', 'Uncharted', WARDLEY_METHOD.agile],
  ['project-management', 'Transitional', WARDLEY_METHOD.lean],
  ['project-management', 'Industrialized', WARDLEY_METHOD.sixSigma],
  ['attitudes', 'Uncharted', WARDLEY_METHOD.pioneers],
  ['attitudes', 'Transitional', WARDLEY_METHOD.settlers],
  ['attitudes', 'Industrialized', WARDLEY_METHOD.townPlanners],
];

describe('the method tag', () => {
  test('ships in the pack with no issue, single-valued, nine values', () => {
    expect(registry.issues()).toEqual([]);
    const method = registry.tag(WARDLEY_METHOD_TAG_ID)!;
    expect(method.cardinality).toBe('single');
    expect((method.values as { id: string }[]).map(v => v.id)).toEqual(
      Object.values(WARDLEY_METHOD)
    );
  });

  test('every value and the tag itself carry a key and an English label', () => {
    const method = registry.tag(WARDLEY_METHOD_TAG_ID)!;
    type Labelled = {
      id: string;
      label: string;
      labelKey?: string;
      descriptionKey?: string;
    };
    for (const def of [
      method,
      ...(method.values as Labelled[]),
    ] as Labelled[]) {
      expect(def.labelKey, def.id).toMatch(/^com\.labre\.wardley\.tag\.method/);
      expect(def.label, def.id).not.toBe('');
      expect(def.descriptionKey, def.id).toBe(`${def.labelKey}.description`);
    }
  });

  test('applies to the method node, and to nothing above or beside it', () => {
    const method = registry.tag(WARDLEY_METHOD_TAG_ID)!;
    expect(tagAppliesToRole(method, WARDLEY_ROLE.method, WARDLEY_ROLES)).toBe(
      true
    );
    // A parent never inherits a child's tag: a plain component has no ring to
    // say a method with.
    for (const role of [
      WARDLEY_ROLE.component,
      WARDLEY_ROLE.market,
      WARDLEY_ROLE.ecosystem,
      WARDLEY_ROLE.anchor,
      WARDLEY_ROLE.porter,
      WARDLEY_ROLE.label,
    ]) {
      expect(tagAppliesToRole(method, role, WARDLEY_ROLES), role).toBe(false);
    }
  });

  test('a method node is offered its nature first, then its method', () => {
    // The same dropdown a plain component opens, with one more section.
    expect(
      registry.tagsForRole(WARDLEY_ROLE.method, WARDLEY_ROLES).map(t => t.id)
    ).toEqual([WARDLEY_NATURE_TAG_ID, WARDLEY_METHOD_TAG_ID]);
    expect(
      registry.tagsForRole(WARDLEY_ROLE.component, WARDLEY_ROLES).map(t => t.id)
    ).toEqual([WARDLEY_NATURE_TAG_ID]);
  });
});

describe('the renderer pair, both directions', () => {
  test.each(RENDERER_TABLE)('%s / %s ↔ %s', (category, recommendation, id) => {
    expect(wardleyMethodOf(category, recommendation)).toBe(id);
    expect(wardleyMethodParts(id)).toEqual({
      family: category,
      phase: recommendation.toLowerCase(),
    });
  });

  test('reads the renderer forgivingly in case and blanks only', () => {
    expect(wardleyMethodOf(' Buying-Policy ', 'transitional')).toBe(
      WARDLEY_METHOD.buy
    );
    // A category the renderer config invented has no family here, and a
    // recommendation outside the three has no phase: no value, no guess.
    expect(wardleyMethodOf('sourcing', 'Uncharted')).toBeNull();
    expect(wardleyMethodOf('buying-policy', 'Genesis')).toBeNull();
    expect(wardleyMethodOf(undefined, 'Uncharted')).toBeNull();
  });

  test('a value no pack names has no parts', () => {
    expect(wardleyMethodParts('wardley:method/retired')).toBeNull();
    expect(wardleyMethodParts('toString')).toBeNull();
    expect(wardleyMethodParts(undefined)).toBeNull();
  });
});

describe('the ring each value paints', () => {
  test('the hue is the family, the fill is the phase', () => {
    for (const [category, , id] of RENDERER_TABLE) {
      const ring = wardleyMethodRing(id)!;
      const hue =
        METHOD_FAMILY_COLOR[category as keyof typeof METHOD_FAMILY_COLOR];
      expect(ring.stroke, id).toBe(hue);
      const phase = wardleyMethodParts(id)!.phase;
      expect(ring.fill, id).toBe(
        phase === 'uncharted'
          ? null
          : phase === 'transitional'
            ? `${hue}66`
            : hue
      );
    }
  });

  test('the renderer defaults, to the digit', () => {
    expect(METHOD_FAMILY_COLOR).toEqual({
      'buying-policy': '#2563eb',
      'project-management': '#16a34a',
      attitudes: '#f59e0b',
    });
  });

  test('no ring for a value that names no method', () => {
    expect(wardleyMethodRing('wardley:method/retired')).toBeNull();
    expect(wardleyMethodRing(undefined)).toBeNull();
  });
});
