import {
  evaluateCheckup,
  evaluateRules,
  onDemandRules,
} from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { WARDLEY_BACKGROUND } from '../background';
import {
  INERTIA_COLOR,
  METHOD_FILL,
  NODE_FILL,
  NODE_STROKE,
  WARDLEY_RED,
} from '../node/consts';
import { WARDLEY_NATURE } from '../natures';
import { WARDLEY_CHECKUP_RULES, WARDLEY_NUDGES } from '../quality';
import { WARDLEY_ROLE } from '../roles';
import { WARDLEY_RULES } from '../rules';

/**
 * Wardley map quality (PF13.8 / PF13.9): the four nudges as DATA, and the two
 * on-demand rules that actually compute something.
 */

function element(
  id: string,
  xywh: [number, number, number, number],
  props: Record<string, unknown> = {}
): GfxPrimitiveElementModel {
  const stub = {
    id,
    type: 'wardley',
    ...props,
    get elementBound() {
      return new Bound(...xywh);
    },
  };
  return stub as unknown as GfxPrimitiveElementModel;
}

const map = () =>
  element('map', [0, 0, 1600, 900], { role: WARDLEY_ROLE.map });

/** A component drawn the way the toolbox draws it, unless told otherwise. */
const component = (id: string, props: Record<string, unknown> = {}) =>
  element(id, [200, 200, 18, 18], {
    role: WARDLEY_ROLE.component,
    fillColor: NODE_FILL,
    strokeColor: NODE_STROKE,
    ...props,
  });

const checkup = (elements: GfxPrimitiveElementModel[]) =>
  evaluateCheckup(WARDLEY_CHECKUP_RULES, elements);

describe('the Q1–Q4 checklist (PF13.9)', () => {
  it('ships the four nudges, in order, namespaced to wardley', () => {
    expect(WARDLEY_NUDGES.map(n => n.id)).toEqual([
      'wardley.q1-title',
      'wardley.q2-context',
      'wardley.q3-legend',
      'wardley.q4-evolution-axis',
    ]);
    for (const nudge of WARDLEY_NUDGES) {
      expect(nudge.framework).toBe('wardley');
      expect(nudge.id.startsWith('wardley.')).toBe(true);
    }
  });

  it('carries a key AND the framework’s own wording for every one', () => {
    // The seam is the same as a profile's and a background label's: a host with
    // a catalogue always wins, a host without one still reads a sentence.
    for (const nudge of WARDLEY_NUDGES) {
      expect(nudge.labelKey.startsWith('com.labre.wardley.quality.')).toBe(true);
      expect(nudge.fallback && nudge.fallback.length > 10).toBe(true);
    }
  });

  it('is never evaluated by anything', () => {
    // A nudge is not a rule and has no evaluation path at all — the type has no
    // family, no severity and no roles, so there is nothing for the engine to
    // reach even by accident.
    for (const nudge of WARDLEY_NUDGES) {
      expect('family' in nudge).toBe(false);
      expect('severity' in nudge).toBe(false);
    }
  });
});

describe('where the check-up rules live', () => {
  it('is on-demand and audit, every one of them', () => {
    for (const rule of WARDLEY_CHECKUP_RULES) {
      expect(rule.moment, rule.id).toBe('on-demand');
      // Collected, invisible on the canvas. The moment already keeps them out
      // of `violations$`; this is the braces to that belt.
      expect(rule.severity, rule.id).toBe('audit');
      expect(rule.framework, rule.id).toBe('wardley');
    }
    expect(onDemandRules(WARDLEY_CHECKUP_RULES)).toHaveLength(
      WARDLEY_CHECKUP_RULES.length
    );
  });

  it('stays OUT of the real-time array', () => {
    // `WARDLEY_RULES` is what the 16 ms bench measures and what a drag pays
    // for; a check-up rule has no business in either number.
    const realtime = new Set(WARDLEY_RULES.map(r => r.id));
    for (const rule of WARDLEY_CHECKUP_RULES) {
      expect(realtime.has(rule.id), rule.id).toBe(false);
    }
    expect(onDemandRules(WARDLEY_RULES)).toEqual([]);
  });

  it('costs the drawing path nothing, even registered together', () => {
    const board = [map(), component('a', { strokeColor: WARDLEY_RED })];
    const both = [...WARDLEY_RULES, ...WARDLEY_CHECKUP_RULES];

    // Same verdict with and without them: the real-time pass cannot see them.
    expect(evaluateRules(both, board)).toEqual(
      evaluateRules(WARDLEY_RULES, board)
    );
  });
});

describe('Q5 — the tone convention', () => {
  it('leaves the landscape alone', () => {
    expect(checkup([map(), component('a')])).toEqual([]);
  });

  it('accepts the greys the toolbox actually creates', () => {
    // A method node's fill and an inertia bar's black are both landscape tones;
    // the check-up must not indict the framework's own defaults.
    expect(
      checkup([
        map(),
        component('a', { fillColor: METHOD_FILL }),
        component('b', { fillColor: INERTIA_COLOR }),
      ])
    ).toEqual([]);
  });

  it('remarks on a component painted in the change tone', () => {
    // Red is reserved for what is moving. A component coloured red for emphasis
    // makes a claim about the future its author never made.
    const remarks = checkup([map(), component('a', { fillColor: WARDLEY_RED })]);

    expect(remarks.map(r => r.ruleId)).toEqual(['wardley.tone-off-convention']);
    expect(remarks[0].elementIds).toEqual(['a']);
    expect(remarks[0].backgroundId).toBe('map');
  });

  it('reads the map’s own declared palette', () => {
    // The rule names entries, never colours: this is the indirection that lets
    // a host restyle the frame and the convention together.
    const palette = WARDLEY_BACKGROUND.chrome?.palette ?? {};
    expect(Object.keys(palette)).toEqual(
      expect.arrayContaining(['landscape', 'change', 'benefit'])
    );
    expect(palette['change']).toBe(WARDLEY_RED);
  });

  it('never indicts a change arrow', () => {
    // Red IS its sanctioned tone: it is created red, and a rule flagging it
    // would be flagging the convention being honoured.
    const arrow = element('arrow', [300, 300, 180, 2], {
      role: WARDLEY_ROLE.changeArrow,
      strokeColor: WARDLEY_RED,
    });

    expect(checkup([map(), arrow])).toEqual([]);
  });

  it('covers market and ecosystem for free', () => {
    // Both SPECIALISE `wardley:component` in the role data, so the rule reaches
    // them with nothing written about either.
    const remarks = checkup([
      map(),
      element('m', [200, 200, 30, 30], {
        role: WARDLEY_ROLE.market,
        fillColor: WARDLEY_RED,
      }),
      element('e', [400, 200, 40, 40], {
        role: WARDLEY_ROLE.ecosystem,
        fillColor: WARDLEY_RED,
      }),
    ]);

    expect(remarks.map(r => r.elementIds[0]).sort()).toEqual(['e', 'm']);
  });
});

describe('Q6 — the phase nomenclature, and the condition it waits on', () => {
  /**
   * ## The nature has LANDED, in another shape — Q6 is not wired to it yet
   *
   * Q6 was written when the type-3 nature did not exist at all, and its gate was
   * "no subject carries the fact". MF3 (#95) has since shipped it: the four
   * natures are a tag def pack ({@link WARDLEY_NATURE}), and an element carries
   * its qualification in `tags` — a nested `Y.Map<string[]>` keyed by tag def id
   * — not in a flat `nature` prop.
   *
   * `majority-fact` reads a flat prop, by design and by documentation. So Q6 is
   * still inert, and it is now inert for a DIFFERENT reason: not "the fact does
   * not exist" but "the fact exists in a shape this family does not read". That
   * is a real gap and it is deliberately not closed inside a merge commit —
   * teaching the family to read a tag is a behaviour change that belongs in its
   * own slice, with its own review.
   *
   * These tests are the record of exactly that state, so it cannot rot into
   * "later means never":
   *
   * - the family still behaves correctly on the contract it declares (a flat
   *   prop), which is what the last three cases pin;
   * - the two below pin the CROSSING — the tag id that now exists, and the flat
   *   prop that still does not — so whoever wires them meets a test that already
   *   describes both ends.
   */
  it('says nothing today, because nothing carries the fact it reads', () => {
    const board = [map(), component('a'), component('b'), component('c')];
    const remarks = checkup(board).filter(
      r => r.ruleId === 'wardley.phase-nomenclature'
    );

    expect(remarks).toEqual([]);
  });

  it('records the gap: the nature exists as a TAG, Q6 reads a flat prop', () => {
    // The fact now exists — MF3 shipped the four natures as a tag def pack...
    expect(WARDLEY_NATURE.activity).toBe('wardley:nature/activity');

    // ...and Q6 asks for a flat `nature` prop, which no element carries. Both
    // halves stated as facts rather than as a comment, so the day somebody
    // teaches `majority-fact` to read a tag, this is the test that tells them
    // the rule is already written and waiting.
    const rule = WARDLEY_CHECKUP_RULES.find(
      r => r.id === 'wardley.phase-nomenclature'
    )!;
    expect(rule.majority).toEqual({ fact: 'nature', value: 'activity' });
    expect('nature' in component('a')).toBe(false);
  });

  it('produces the remark the moment a majority of components is an activity', () => {
    const remarks = checkup([
      map(),
      component('a', { nature: 'activity' }),
      component('b', { nature: 'activity' }),
      component('c', { nature: 'practice' }),
    ]).filter(r => r.ruleId === 'wardley.phase-nomenclature');

    expect(remarks).toHaveLength(1);
    // About the MAP, and never imposed: it names the background, and its own
    // wording offers rather than demands.
    expect(remarks[0].elementIds).toEqual(['map']);
    expect(remarks[0].suggestionFallback).toContain('never imposed');
  });

  it('stays quiet when the activities are not a majority', () => {
    const remarks = checkup([
      map(),
      component('a', { nature: 'activity' }),
      component('b', { nature: 'practice' }),
      component('c', { nature: 'data' }),
    ]).filter(r => r.ruleId === 'wardley.phase-nomenclature');

    expect(remarks).toEqual([]);
  });
});
