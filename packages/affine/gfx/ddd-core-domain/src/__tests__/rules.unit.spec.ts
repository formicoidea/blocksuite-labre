import { evaluateRules } from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { CORE_DOMAIN_ROLE } from '../roles';
import { CORE_DOMAIN_RULES } from '../rules';

/**
 * Each rule, twice: the case it must speak about, and the cases it must stay
 * silent on. The silences are the half that decides whether a validation
 * platform survives contact with a workshop.
 *
 * Every coordinate below is against a chart at the origin, 900 × 820 — the size
 * the sub-menu creates one at — whose plot is `60…846 × 24…770`. The Core
 * quadrant of the CLASSIC reading is therefore `x 440…840, y 30…390`.
 */

const rule = (id: string) => {
  const found = CORE_DOMAIN_RULES.find(r => r.id === id);
  expect(found, id).toBeDefined();
  return found!;
};

function element(
  id: string,
  xywh: [number, number, number, number],
  props: Record<string, unknown> = {}
): GfxPrimitiveElementModel {
  const stub = {
    id,
    type: 'shape',
    ...props,
    get elementBound() {
      return new Bound(...xywh);
    },
  };
  return stub as unknown as GfxPrimitiveElementModel;
}

const chart = (variant = 'classic', id = 'chart') =>
  element(id, [0, 0, 900, 820], {
    type: 'coreDomain',
    role: CORE_DOMAIN_ROLE.chart,
    variant,
    showZones: true,
    showLabels: true,
  });

/** A 26-unit dot centred on `(cx, cy)`, in the given role. */
const dot = (id: string, role: string, cx: number, cy: number, props = {}) =>
  element(id, [cx - 13, cy - 13, 26, 26], { role, filled: true, ...props });

/** A movement connector between two elements. */
const movement = (id: string, source: string, target: string) =>
  element(id, [0, 0, 1, 1], {
    type: 'connector',
    role: CORE_DOMAIN_ROLE.movement,
    source: { id: source },
    target: { id: target },
  });

const ids = (id: string, elements: GfxPrimitiveElementModel[]) =>
  evaluateRules([rule(id)], elements).map(v => v.elementIds.join('+'));

describe('C1 — an outsourced sub-domain in the Core quadrant', () => {
  const id = 'core-domain.outsourced-core';
  /** Dead centre of the Core quadrant. */
  const inCore = (elId: string, role: string = CORE_DOMAIN_ROLE.outsourced) =>
    dot(elId, role, 640, 210);
  const inGeneric = (
    elId: string,
    role: string = CORE_DOMAIN_ROLE.outsourced
  ) => dot(elId, role, 145, 400);

  it('speaks when the dot is in the core', () => {
    expect(ids(id, [chart(), inCore('d1')])).toEqual(['d1']);
    expect(
      evaluateRules([rule(id)], [chart(), inCore('d1')])[0].boundaryId
    ).toBe('core');
  });

  it('says nothing anywhere else on the chart', () => {
    expect(ids(id, [chart(), inGeneric('d1')])).toEqual([]);
  });

  it('says nothing about the four other presets', () => {
    for (const role of [
      CORE_DOMAIN_ROLE.bigBet,
      CORE_DOMAIN_ROLE.platform,
      CORE_DOMAIN_ROLE.bcCurrent,
      CORE_DOMAIN_ROLE.bcFuture,
    ]) {
      expect(ids(id, [chart(), inCore('d1', role)])).toEqual([]);
    }
  });

  it('says nothing about a dot on blank canvas, or a neutral one', () => {
    expect(ids(id, [inCore('d1')])).toEqual([]);
    expect(ids(id, [chart(), element('d1', [627, 197, 26, 26])])).toEqual([]);
  });

  /**
   * The variant test the whole `variants` mechanism exists for: the very same
   * dot at the very same coordinates, on a chart turned to its migration
   * reading. There is no Core quadrant on that page, so there is nothing to be
   * inside of — and indicting the user for a region they cannot see would be
   * the worst kind of false positive.
   */
  it('falls silent on a chart turned to its migration reading', () => {
    expect(ids(id, [chart('classic'), inCore('d1')])).toEqual(['d1']);
    expect(ids(id, [chart('migration'), inCore('d1')])).toEqual([]);
  });
});

describe('C2 — a malformed movement', () => {
  const id = 'core-domain.malformed-movement';
  const current = (elId: string) =>
    dot(elId, CORE_DOMAIN_ROLE.bcCurrent, 200, 200);
  const future = (elId: string) =>
    dot(elId, CORE_DOMAIN_ROLE.bcFuture, 600, 200);

  it('says nothing about a movement drawn the right way round', () => {
    expect(
      ids(id, [chart(), current('a'), future('b'), movement('m', 'a', 'b')])
    ).toEqual([]);
  });

  it('speaks when the movement is drawn backwards', () => {
    // `b → a` is `future is moving to current`, a sentence the chart has no
    // reading for. All three elements are named: the arrow and both ends.
    expect(
      ids(id, [chart(), current('a'), future('b'), movement('m', 'b', 'a')])
    ).toEqual(['a+b+m']);
  });

  it('speaks when the movement loops back on its own start', () => {
    expect(ids(id, [chart(), current('a'), movement('m', 'a', 'a')])).toEqual([
      'a+m',
    ]);
  });

  it('stays silent on a free connector — a drawing is not a claim', () => {
    const free = element('m', [0, 0, 1, 1], {
      type: 'connector',
      source: { id: 'b' },
      target: { id: 'a' },
    });
    expect(ids(id, [chart(), current('a'), future('b'), free])).toEqual([]);
  });

  it('stays silent on a movement with a free end, or a dangling one', () => {
    const loose = element('m', [0, 0, 1, 1], {
      type: 'connector',
      role: CORE_DOMAIN_ROLE.movement,
      source: { id: 'a' },
      target: { position: [10, 10] },
    });
    expect(ids(id, [chart(), current('a'), loose])).toEqual([]);
    expect(
      ids(id, [chart(), current('a'), movement('m', 'a', 'gone')])
    ).toEqual([]);
  });

  /**
   * The alphabet rule of the family, and the reason it is shippable: a movement
   * dropped on a big bet or on a plain rectangle is a SKETCH, and a grammar
   * that indicted the sketch would be switched off within a day.
   */
  it('stays silent when an end is outside its alphabet', () => {
    const bet = dot('x', CORE_DOMAIN_ROLE.bigBet, 600, 400);
    expect(
      ids(id, [chart(), current('a'), bet, movement('m', 'a', 'x')])
    ).toEqual([]);
    const neutral = element('n', [600, 400, 26, 26]);
    expect(
      ids(id, [chart(), current('a'), neutral, movement('m', 'a', 'n')])
    ).toEqual([]);
  });

  it('does not object to two movements between the same pair', () => {
    // Two dated statements about one journey is a legitimate use of the chart,
    // which is why the rule declares no `forbidDuplicate`.
    expect(
      ids(id, [
        chart(),
        current('a'),
        future('b'),
        movement('m1', 'a', 'b'),
        movement('m2', 'a', 'b'),
      ])
    ).toEqual([]);
  });
});

describe('C3 — overlapping sub-domains', () => {
  const id = 'core-domain.overlapping-artefacts';

  it('speaks when two dots are drawn on top of each other', () => {
    expect(
      ids(id, [
        chart(),
        dot('a', CORE_DOMAIN_ROLE.bigBet, 300, 300),
        dot('b', CORE_DOMAIN_ROLE.platform, 305, 300),
      ])
    ).toEqual(['a+b']);
  });

  it('says nothing about two dots that merely graze each other', () => {
    // 26-unit dots 22 apart share 4 units — under the 6-unit threshold.
    expect(
      ids(id, [
        chart(),
        dot('a', CORE_DOMAIN_ROLE.bigBet, 300, 300),
        dot('b', CORE_DOMAIN_ROLE.platform, 322, 300),
      ])
    ).toEqual([]);
  });

  it('says nothing about a dot overlapping a neutral shape', () => {
    expect(
      ids(id, [
        chart(),
        dot('a', CORE_DOMAIN_ROLE.bigBet, 300, 300),
        element('n', [290, 290, 26, 26]),
      ])
    ).toEqual([]);
  });
});

describe('C4 — a dot off the legend colours', () => {
  const id = 'core-domain.off-legend-colour';

  it('is an audit finding, in every profile', () => {
    expect(rule(id).severity).toBe('audit');
  });

  it('says nothing about the five legend colours', () => {
    for (const fill of [
      '#9933ff',
      '#66b2ff',
      '#99ff99',
      '#ff3333',
      '#cccccc',
    ]) {
      expect(
        ids(id, [
          chart(),
          dot('d1', CORE_DOMAIN_ROLE.bigBet, 300, 300, {
            fillColor: fill,
            strokeColor: '#1f2328',
          }),
        ])
      ).toEqual([]);
    }
  });

  it('speaks when a dot is recoloured off the notation', () => {
    // Orange is in no legend entry's tone family.
    expect(
      ids(id, [
        chart(),
        dot('d1', CORE_DOMAIN_ROLE.bigBet, 300, 300, {
          fillColor: '#ff8800',
          strokeColor: '#1f2328',
        }),
      ])
    ).toEqual(['d1']);
  });

  it('judges the TONE, not the hex', () => {
    // Another purple entirely: the same statement, in the user's own shade.
    expect(
      ids(id, [
        chart(),
        dot('d1', CORE_DOMAIN_ROLE.bigBet, 300, 300, {
          fillColor: '#8a2be2',
          strokeColor: '#1f2328',
        }),
      ])
    ).toEqual([]);
  });
});

describe('the rule set as a whole', () => {
  it('never claims an effect nothing implements', () => {
    for (const r of CORE_DOMAIN_RULES) {
      expect(['warning', 'audit']).toContain(r.severity);
    }
  });

  it('frames every rule against the chart role', () => {
    for (const r of CORE_DOMAIN_RULES) {
      expect(r.backgroundRole).toBe(CORE_DOMAIN_ROLE.chart);
      expect(r.framework).toBe('core-domain');
      expect(r.id.startsWith('core-domain.')).toBe(true);
    }
  });

  it('cites no zone of the migration reading', () => {
    // A migration quadrant is a region of READING: what counts as a low-hanging
    // fruit is a judgement no coordinate decides.
    const cited = CORE_DOMAIN_RULES.flatMap(r => r.inZone?.zoneIds ?? []);
    expect(cited).toEqual(['core']);
  });
});
