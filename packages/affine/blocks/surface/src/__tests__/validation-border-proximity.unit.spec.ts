import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel, RoleDefs } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';

import {
  evaluateRules,
  RULE_SCOPES,
  scopeOf,
  type ValidationRule,
} from '../extensions/validation.js';

/**
 * The `border-proximity` family (ADR 0024): the glyph is ON the box — is it
 * still on its EDGE?
 *
 * The three properties the suite is really about, and each of them is a line
 * three older families draw somewhere else:
 *
 *  - the measure is the CENTRE against the OUTLINE, not the extent against the
 *    area, so straddling the edge and sitting just inside it are both right and
 *    a glyph buried in the middle is wrong;
 *  - a subject touching NO carrier raises nothing, which is what keeps the
 *    family off a sketch;
 *  - the carrier has to be a `node` role, because an outline is a box's.
 *
 * The numbers below are UML's, one framework over: a component 220 × 120 at
 * (200, 200) — so the right edge is x = 420 — and a port 16 units square. The
 * tolerance is 16, the glyph's own side.
 */

const ROLES: RoleDefs = {
  'test:component': {
    id: 'test:component',
    kind: 'node',
    labelKey: 'test.component',
  },
  'test:sub-component': {
    id: 'test:sub-component',
    parent: 'test:component',
    kind: 'node',
    labelKey: 'test.sub-component',
  },
  'test:port': { id: 'test:port', kind: 'node', labelKey: 'test.port' },
  'test:socket': {
    id: 'test:socket',
    parent: 'test:port',
    kind: 'node',
    labelKey: 'test.socket',
  },
  'test:sheet': { id: 'test:sheet', kind: 'node', labelKey: 'test.sheet' },
  'test:wire': { id: 'test:wire', kind: 'edge', labelKey: 'test.wire' },
};

const RULE: ValidationRule = {
  id: 'test.port-on-border',
  framework: 'test',
  family: 'border-proximity',
  severity: 'warning',
  appliesTo: 'test:port',
  roles: ROLES,
  messageKey: 'com.labre.test.port-on-border',
  version: 1,
  backgroundRole: 'test:sheet',
  borderProximity: { carrierRole: 'test:component', tolerance: 16 },
};

function element(
  id: string,
  xywh: [number, number, number, number],
  role?: string
): GfxPrimitiveElementModel {
  const stub = {
    id,
    type: 'test',
    role,
    get elementBound() {
      return new Bound(...xywh);
    },
  };
  return stub as unknown as GfxPrimitiveElementModel;
}

/** The sheet the findings are attributed to. */
const sheet = (id = 'sheet') => element(id, [0, 0, 1200, 800], 'test:sheet');

/** The carrier: x 200…420, y 200…320. */
const box = (id = 'c', x = 200, y = 200, w = 220, h = 120) =>
  element(id, [x, y, w, h], 'test:component');

/** The carried glyph, 16 square — `x` is its LEFT edge, so its centre is x + 8. */
const glyph = (id: string, x: number, y = 250, role = 'test:port') =>
  element(id, [x, y, 16, 16], role);

const found = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  evaluateRules([rule], elements);

const ids = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  found(rule, elements).map(violation => violation.elementIds.join('+'));

describe('where the glyph sits on its carrier', () => {
  it('says nothing about one straddling the edge', () => {
    // Centre exactly on x 420: distance 0, and the drawing the notation prefers.
    expect(ids(RULE, [sheet(), box(), glyph('p', 412)])).toEqual([]);
  });

  it('says nothing about one tangent INSIDE the edge', () => {
    // The square clear of the line, centre 8 units in — half a glyph.
    expect(ids(RULE, [sheet(), box(), glyph('p', 404)])).toEqual([]);
  });

  it('says nothing about one tangent OUTSIDE the edge', () => {
    // 8 units the other way. Symmetric by construction: the distance is to the
    // LINE, and a family measuring containment could not say this.
    expect(ids(RULE, [sheet(), box(), glyph('p', 418)])).toEqual([]);
  });

  it('indicts one buried in the middle', () => {
    // Centre at x 308 — 58 units from the nearest edge, which is the top one.
    expect(ids(RULE, [sheet(), box(), glyph('p', 300)])).toEqual(['c+p']);
  });

  it('measures the CENTRE, not the extent', () => {
    // A glyph WIDE enough to clip the edge while its centre is far inside it.
    // An extent test would pass this; the eye does not.
    const wide = element('p', [300, 250, 130, 16], 'test:port');

    expect(ids(RULE, [sheet(), box(), wide])).toEqual(['c+p']);
  });

  it('measures against the nearest edge of the four', () => {
    // Centre at (308, 208): 108 from the left edge and 8 from the top one. The
    // top edge is the border this glyph is on.
    expect(ids(RULE, [sheet(), box(), glyph('p', 300, 200)])).toEqual([]);
  });
});

describe('the tolerance', () => {
  it('lets the declared distance itself pass, and not one unit more', () => {
    // Centre at x 404 — exactly 16 in. The comparison is `<=`, so the edge case
    // is silence: a tolerance a framework declares is a distance it accepts.
    expect(ids(RULE, [sheet(), box(), glyph('p', 396)])).toEqual([]);
    // 17 in.
    expect(ids(RULE, [sheet(), box(), glyph('p', 395)])).toEqual(['c+p']);
  });

  it('is absolute, so a bigger carrier does not buy more slack', () => {
    // The same 58-unit offence against a carrier ten times the area. A tolerance
    // proportional to the box would have swallowed it.
    const huge = box('c', 200, 200, 2200, 1200);

    expect(ids(RULE, [sheet(), huge, glyph('p', 300)])).toEqual(['c+p']);
  });

  it('evaluates nothing, and warns once, with no positive tolerance', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sloppy: ValidationRule = {
      ...RULE,
      id: 'test.no-tolerance',
      borderProximity: { carrierRole: 'test:component', tolerance: 0 },
    };

    // A centre exactly on the line is a drawing no hand produces, so a rule with
    // no tolerance would indict every glyph on the board.
    expect(ids(sloppy, [sheet(), box(), glyph('p', 412)])).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('what the family stays silent about', () => {
  it('says nothing about a glyph touching no carrier', () => {
    // Dropped on open canvas: somebody drawing, not somebody wrong. The gate
    // that makes the family shippable.
    expect(ids(RULE, [sheet(), box(), glyph('p', 900, 600)])).toEqual([]);
  });

  it('says nothing about a glyph merely ADJACENT to a carrier', () => {
    // 20 units clear of the right edge: the boxes share no area, so there is no
    // carrier this glyph is on, and "it should be on one" is a different rule.
    expect(ids(RULE, [sheet(), box(), glyph('p', 440)])).toEqual([]);
  });

  it('says nothing about an element carrying no role', () => {
    expect(
      ids(RULE, [sheet(), box(), element('p', [300, 250, 16, 16])])
    ).toEqual([]);
  });

  it('says nothing when the surface carries no carrier at all', () => {
    expect(ids(RULE, [sheet(), glyph('p', 300)])).toEqual([]);
  });

  it('says nothing when the rule declares no subject role', () => {
    const { appliesTo: _dropped, ...roleless } = RULE;

    expect(
      ids(roleless as ValidationRule, [sheet(), box(), glyph('p', 300)])
    ).toEqual([]);
  });
});

describe('the two roles', () => {
  it('covers a specialisation of the SUBJECT role', () => {
    expect(
      ids(RULE, [sheet(), box(), glyph('s', 300, 250, 'test:socket')])
    ).toEqual(['c+s']);
  });

  it('covers a specialisation of the CARRIER role', () => {
    const inner = element('k', [200, 200, 220, 120], 'test:sub-component');

    expect(ids(RULE, [sheet(), inner, glyph('p', 300)])).toEqual(['k+p']);
  });

  it('refuses an EDGE carrier, and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const impossible: ValidationRule = {
      ...RULE,
      id: 'test.edge-carrier',
      borderProximity: { carrierRole: 'test:wire', tolerance: 16 },
    };

    // An outline is a box's. A rule naming an edge can never fire, and data that
    // can never fire and never says why is the worst kind.
    expect(ids(impossible, [sheet(), box(), glyph('p', 300)])).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('which carrier the finding names', () => {
  it('names the one whose edge the glyph is nearest', () => {
    // Two boxes overlapping the glyph: an outer one it is deep inside, and an
    // inner one whose edge it sits on. The inner one wins, and the glyph is on a
    // border — which is the reading the eye gives.
    const outer = box('outer', 0, 0, 1000, 600);
    const inner = box('inner', 200, 200, 220, 120);

    expect(ids(RULE, [sheet(), outer, inner, glyph('p', 412)])).toEqual([]);
  });

  it('reports ONE finding for a glyph inside two carriers', () => {
    // Deep inside both: one mistake, one sentence, and the nearer edge is what
    // it is measured against.
    const outer = box('outer', 0, 0, 1000, 600);
    const inner = box('inner', 200, 200, 220, 120);
    const violations = found(RULE, [sheet(), outer, inner, glyph('p', 300)]);

    expect(violations).toHaveLength(1);
    expect(violations[0].elementIds).toEqual(['inner', 'p']);
  });

  it('breaks an exact tie by the smaller id, never by walk order', () => {
    // Two carriers on top of each other: the same distance from both, and the
    // answer cannot depend on the order a `Y.Map` was rebuilt in.
    const first = box('b', 200, 200);
    const second = box('a', 200, 200);
    const violations = found(RULE, [sheet(), first, second, glyph('p', 300)]);

    expect(violations).toHaveLength(1);
    expect(violations[0].elementIds).toEqual(['a', 'p']);
  });
});

describe('what the finding carries', () => {
  it('attributes the finding to the sheet the glyph is on', () => {
    const [violation] = found(RULE, [sheet('s1'), box(), glyph('p', 300)]);

    // Attribution only — nothing about the sheet takes part in the verdict. It
    // is what a map-wide waiver is written against.
    expect(violation.backgroundId).toBe('s1');
  });

  it('still judges a glyph on a board with no sheet at all', () => {
    // Unlike the membership families, this one does not need a frame: the
    // requirement is about two artefacts, and the frame is for waivers.
    const [violation] = found(RULE, [box(), glyph('p', 300)]);

    expect(violation.elementIds).toEqual(['c', 'p']);
    expect(violation.backgroundId).toBeUndefined();
  });

  it('carries the rule own severity and words', () => {
    const [violation] = found(RULE, [sheet(), box(), glyph('p', 300)]);

    expect(violation.ruleId).toBe('test.port-on-border');
    expect(violation.severity).toBe('warning');
    expect(violation.messageKey).toBe('com.labre.test.port-on-border');
  });
});

describe('the dependency scope', () => {
  it('is declared, and is the surface', () => {
    // The carriers are collected from the WHOLE surface and bounded by no frame,
    // so a carrier moved anywhere can flip a subject verdict — including from a
    // finding to silence. Same reasoning `attachment` records (ADR 0015).
    expect(RULE_SCOPES['border-proximity']).toBe('surface');
    expect(scopeOf(RULE)).toBe('surface');
  });
});
