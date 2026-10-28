/**
 * The Wardley **method** tag (ADR 0046): what a component + method is offered,
 * and the table that relates each value to the wardley-map-renderer JSON pair
 * and to the prefabricated ring it paints.
 *
 * Why it exists: the method node used to say its method only through a fill
 * colour picked from a palette — a fact no reader, no rule and no import could
 * name. The PO decision of 28/10/2026 is that a map imported from the
 * renderer's JSON (`method: { category, recommendation }`) lands as a real,
 * editable qualification; the PO's review of the same day made the colour the
 * TYPE: each of the nine values has its own prefabricated style, and the
 * picker shows them family by family. These pin all of it: the role reaches
 * the tag, the tag holds the renderer's nine facts under three family titles
 * and nothing else, both directions of the pair agree, and the nine rings are
 * nine different pictures, on white and on the dark card.
 */
import {
  buildUniverseRegistry,
  tagAppliesToRole,
} from '@labre/affine-shared/services';
import { NotationTint } from '@labre/affine-block-surface';
import { describe, expect, test } from 'vitest';

import { WARDLEY_DARK_PALETTE } from '../dark-palette';

import {
  wardleyMethodOf,
  wardleyMethodParts,
  wardleyMethodStyle,
} from '../method';
import {
  WARDLEY_METHOD,
  WARDLEY_METHOD_TAG_ID,
  WARDLEY_NATURE_TAG_ID,
  WARDLEY_TAG_DEFS,
} from '../natures';
import {
  METHOD_BUY_FILL,
  METHOD_FILL,
  METHOD_OUTSOURCE_FILL,
  NODE_FILL,
  NODE_STROKE,
  WARDLEY_PEACE,
  WARDLEY_PEACE_LIGHT,
  WARDLEY_WAR,
} from '../node/consts';
import { WARDLEY_ROLE, WARDLEY_ROLES } from '../roles';
import { legendOf, textsOf } from './legend-stub';

const registry = buildUniverseRegistry([WARDLEY_TAG_DEFS]);

/** The renderer's three default `methods`, as its theme baseline spells them. */
const RENDERER_TABLE: ReadonlyArray<[string, string, string]> = [
  ['buying-policy', 'Uncharted', WARDLEY_METHOD.make],
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

describe('the dropdown reads family by family', () => {
  test('three titled families, three values each, in evolution order', () => {
    const method = registry.tag(WARDLEY_METHOD_TAG_ID)!;
    const rows: string[] = [];
    let open: string | undefined;
    for (const value of method.values as {
      id: string;
      group?: { label: string; labelKey?: string };
    }[]) {
      if (value.group?.label !== open) rows.push(`# ${value.group?.label}`);
      open = value.group?.label;
      rows.push(value.id.slice(WARDLEY_METHOD_TAG_ID.length + 1));
    }
    expect(rows).toEqual([
      '# Buying policy',
      'make',
      'buy',
      'outsource',
      '# Project management',
      'agile',
      'lean',
      'six-sigma',
      '# Attitudes',
      'pioneers',
      'settlers',
      'town-planners',
    ]);
  });

  test('each family title is a key, listed once in the manifest', () => {
    const method = registry.tag(WARDLEY_METHOD_TAG_ID)!;
    const keys = new Set(
      (method.values as { group?: { labelKey?: string } }[]).map(
        v => v.group?.labelKey
      )
    );
    expect([...keys]).toEqual([
      'com.labre.wardley.tag.method.group.buying-policy',
      'com.labre.wardley.tag.method.group.project-management',
      'com.labre.wardley.tag.method.group.attitudes',
    ]);
  });
});

/** Each value's ring, spelled with the named tokens it is made of. */
const STYLES: ReadonlyArray<[string, string, string, number]> = [
  [WARDLEY_METHOD.make, METHOD_FILL, NODE_STROKE, 2],
  [WARDLEY_METHOD.buy, METHOD_BUY_FILL, NODE_STROKE, 2],
  [WARDLEY_METHOD.outsource, METHOD_OUTSOURCE_FILL, NODE_STROKE, 2],
  [WARDLEY_METHOD.agile, `${NODE_STROKE}26`, `${NODE_STROKE}26`, 1.5],
  [WARDLEY_METHOD.lean, `${NODE_STROKE}59`, `${NODE_STROKE}59`, 1.5],
  [WARDLEY_METHOD.sixSigma, `${NODE_STROKE}8c`, `${NODE_STROKE}8c`, 1.5],
  [WARDLEY_METHOD.pioneers, `${WARDLEY_PEACE_LIGHT}80`, WARDLEY_PEACE, 2],
  [WARDLEY_METHOD.settlers, WARDLEY_PEACE, WARDLEY_PEACE, 2],
  [WARDLEY_METHOD.townPlanners, `${WARDLEY_WAR}66`, WARDLEY_WAR, 2],
];

describe('the prefabricated ring of each method', () => {
  test.each(STYLES)('%s', (id, fill, stroke, lineWidth) => {
    expect(wardleyMethodStyle(id)).toEqual({ fill, stroke, lineWidth });
  });

  test('the palette tokens are the swatches the colour picker offers', () => {
    // "Wardley blue" and "Wardley violet" are Peace and War: named once.
    expect([WARDLEY_PEACE, WARDLEY_PEACE_LIGHT, WARDLEY_WAR]).toEqual([
      '#5b9cf6',
      '#c6dbfc',
      '#9d6df0',
    ]);
    expect([METHOD_FILL, METHOD_BUY_FILL, METHOD_OUTSOURCE_FILL]).toEqual([
      '#d9d9d9',
      '#8c8c8c',
      '#404040',
    ]);
  });

  test('nine different pictures, none of them a plain component', () => {
    const pictures = STYLES.map(([, fill, stroke]) => `${fill} ${stroke}`);
    expect(new Set(pictures).size).toBe(9);
    // A plain component is a white disc in the ink: no ring is that.
    expect(pictures).not.toContain(`${NODE_FILL} ${NODE_STROKE}`);
  });

  test('still nine on the dark card, the grey ramps in their order', () => {
    const tint = new NotationTint([WARDLEY_DARK_PALETTE]);
    const dark = STYLES.map(
      ([, fill, stroke]) =>
        `${tint.resolve(fill, 'fill')} ${tint.resolve(stroke, 'ink')}`
    );
    expect(new Set(dark).size).toBe(9);
    // Outsource stays the step furthest from the paper: lightest on dark.
    const grey = (hex: string) => Number.parseInt(hex.slice(1, 3), 16);
    const [make, buy, outsource] = [
      METHOD_FILL,
      METHOD_BUY_FILL,
      METHOD_OUTSOURCE_FILL,
    ].map(v => grey(tint.resolve(v, 'fill')));
    expect(make < buy && buy < outsource).toBe(true);
    // The project-management intensities keep their alpha on the light ink.
    expect(tint.resolve(`${NODE_STROKE}8c`, 'fill')).toMatch(/8c$/);
  });

  test('no style for a value that names no method', () => {
    expect(wardleyMethodStyle('wardley:method/retired')).toBeNull();
    expect(wardleyMethodStyle('toString')).toBeNull();
    expect(wardleyMethodStyle(undefined)).toBeNull();
  });
});

/**
 * The legend lists every method the map USES, one row each, under its
 * family's title, after the "Component + method" row (PO decision,
 * 2026-10-28). Run on the real Wardley commands through the real engine.
 */
describe('the legend lists the methods the map uses', () => {
  const method = (valueId?: string) => ({
    role: WARDLEY_ROLE.method,
    ...(valueId ? { tags: { [WARDLEY_METHOD_TAG_ID]: [valueId] } } : {}),
  });

  test('a method row appears only when its value is used, once', () => {
    const texts = textsOf(
      legendOf([
        method(WARDLEY_METHOD.buy),
        method(WARDLEY_METHOD.buy),
        method(WARDLEY_METHOD.pioneers),
      ])
    );
    expect(texts).toContain('Component + method (the ring names the method)');
    expect(texts.filter(t => t === 'Buy')).toHaveLength(1);
    expect(texts).toContain('Pioneers');
    expect(texts).toContain('Buying policy');
    expect(texts).toContain('Attitudes');
    for (const unused of ['Make', 'Outsource', 'Agile', 'Project management']) {
      expect(texts, unused).not.toContain(unused);
    }
  });

  test('an untagged method node lists the method row alone', () => {
    const texts = textsOf(legendOf([method()]));
    expect(texts).toContain('Component + method (the ring names the method)');
    for (const value of ['Make', 'Buy', 'Settlers', 'Buying policy']) {
      expect(texts, value).not.toContain(value);
    }
  });

  test('each method row is drawn as an editable text beside a method glyph', () => {
    const added = legendOf([method(WARDLEY_METHOD.settlers)]);
    const at = added.findIndex(
      el => el.type === 'text' && el.text === 'Settlers'
    );
    expect(at).toBeGreaterThan(0);
    // A plain canvas text, like every legend row: the author rewrites it in
    // place to tell the story of the picture.
    expect(added[at]).toMatchObject({ type: 'text' });
    expect(
      added.filter(el => el.type === 'wardleyNode' && el.kind === 'method')
    ).toHaveLength(2);
  });
});
