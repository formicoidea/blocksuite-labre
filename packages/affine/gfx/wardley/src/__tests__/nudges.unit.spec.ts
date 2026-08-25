import { describe, expect, it } from 'vitest';

import { WARDLEY_NUDGES } from '../nudges';

/**
 * Wardley map quality (PF13.9): the four nudges, as DATA.
 *
 * There is nothing else left to check here. Q5 and Q6 — the two on-demand rules
 * this suite also covered — were dropped from the framework on the PO recette of
 * 02/08/2026, and what they exercised belongs to the ENGINE anyway: the
 * on-demand moment and the `tone-convention` / `majority-fact` families are
 * tested where they live, in `blocks/surface`'s `map-quality.unit.spec.ts`,
 * against that suite's own vocabulary rather than through Wardley's.
 */

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
