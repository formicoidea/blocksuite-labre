import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel, RoleDefs } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { evaluateRules, type ValidationRule } from '../extensions/validation.js';

/**
 * What `no-overlap` MEASURES, as an engine contract (PF5.13, calibrated
 * 01/08/2026).
 *
 * Two declarations decide whether a collision is one:
 *
 * - the role's `kind`. A `text` role is measured by the INK of its words, not
 *   by the box it was created at — a text box is sized by the tool that made
 *   it and says nothing about what it reads.
 * - the rule's `minPenetration`. A shared hair is not a collision; how far the
 *   two go INTO each other is.
 *
 * Both are framework data, so this suite declares its own vocabulary and its
 * own rule rather than borrowing Wardley's: the engine knows neither.
 */

const ROLES: RoleDefs = {
  'test:node': { id: 'test:node', kind: 'node' },
  'test:edge': { id: 'test:edge', kind: 'edge' },
  'test:text': { id: 'test:text', kind: 'text' },
};

const RULE: ValidationRule = {
  id: 'test.no-overlap',
  framework: 'test',
  family: 'no-overlap',
  severity: 'warning',
  roles: ROLES,
  messageKey: 'com.labre.test.no-overlap',
  version: 1,
  overlap: [
    ['test:text', 'test:text'],
    ['test:text', 'test:node'],
    ['test:text', 'test:edge'],
    ['test:node', 'test:node'],
  ],
};

/** The same rule with a threshold — the only difference between the two. */
const CALIBRATED: ValidationRule = { ...RULE, minPenetration: 4 };

function element(
  id: string,
  xywh: [number, number, number, number],
  role: string,
  extra: Record<string, unknown> = {}
): GfxPrimitiveElementModel {
  return {
    id,
    role,
    ...extra,
    get elementBound() {
      return new Bound(...xywh);
    },
  } as unknown as GfxPrimitiveElementModel;
}

/** A text element: a 200-wide box, and the words actually in it. */
const text = (
  id: string,
  x: number,
  content: string,
  textAlign: 'left' | 'center' | 'right' = 'left'
) =>
  element(id, [x, 100, 200, 20], 'test:text', {
    text: content,
    fontSize: 20,
    textAlign,
  });

const node = (id: string, x: number, w = 20) =>
  element(id, [x, 100, w, 20], 'test:node');

const link = (id: string, x: number) =>
  element(id, [x - 1, 0, 2, 400], 'test:edge', {
    absolutePath: [
      [x, 0],
      [x, 400],
    ],
  });

const raised = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  evaluateRules([rule], elements).map(v => v.elementIds.join('+'));

describe('a `text` role is measured by its ink', () => {
  it('ignores the empty part of the box the text was created in', () => {
    // "abc" at 20px: ~30 units of ink in a 200-unit box. A link at x = 150
    // crosses the box and nothing the eye can see.
    expect(raised(RULE, [text('t1', 0, 'abc'), link('d1', 150)])).toEqual([]);
    // ...and the same link through the letters is still a collision.
    expect(raised(RULE, [text('t1', 0, 'abc'), link('d1', 15)])).toEqual([
      'd1+t1',
    ]);
  });

  it('follows the alignment, because the renderer does', () => {
    // Same box, same word, three places for the ink to be.
    expect(raised(RULE, [text('t1', 0, 'abc', 'right'), link('d1', 15)])).toEqual(
      []
    );
    expect(
      raised(RULE, [text('t1', 0, 'abc', 'right'), link('d1', 185)])
    ).toEqual(['d1+t1']);
    expect(
      raised(RULE, [text('t1', 0, 'abc', 'center'), link('d1', 100)])
    ).toEqual(['d1+t1']);
  });

  it('sizes a name letter by letter, not by an average', () => {
    // `utility` is seven NARROW letters: drawn 41 units at font 18, where an
    // average advance reads 63 and puts a ghost 22 units past the last one.
    // A link on that white paper is the PO's first capture with another word.
    const narrow = element(
      't1',
      [400, 100, 200, 20],
      'test:text',
      { text: 'utility', fontSize: 18, textAlign: 'left' }
    );
    expect(raised(RULE, [narrow, link('d1', 455)])).toEqual([]);
    // ...and the letters themselves are still letters.
    expect(raised(RULE, [narrow, link('d1', 420)])).toEqual(['d1+t1']);

    // The other end of the same table: `W` is three times an `i`, so a word of
    // them must not read like a word of anything else.
    const wide = element(
      't2',
      [400, 100, 200, 20],
      'test:text',
      { text: 'WWWW', fontSize: 18, textAlign: 'left' }
    );
    expect(raised(RULE, [wide, link('d1', 455)])).toEqual(['d1+t2']);
  });

  it('hands a ROTATED text its whole box back', () => {
    // The band this cuts is where an UNROTATED renderer draws. At 180° the
    // words are at the other end of the box, so narrowing would be a MISS —
    // and this family's rotated failure mode is a warning too many, never a
    // miss. Both ends of the box therefore report.
    const flipped = element(
      't1',
      [400, 100, 200, 20],
      'test:text',
      { text: 'abc', fontSize: 18, textAlign: 'left', rotate: 180 }
    );

    expect(raised(RULE, [flipped, link('d1', 585)])).toEqual(['d1+t1']);
    expect(raised(RULE, [flipped, link('d1', 410)])).toEqual(['d1+t1']);
  });

  it('drops a text emptied of its words from the pass', () => {
    // No ink at all: a zero-width box is still a vertical LINE, and a wider box
    // contains it — so an emptied label would go on being reported for exactly
    // as long as it went on existing.
    const emptied = element(
      't1',
      [400, 100, 120, 20],
      'test:text',
      { text: '', fontSize: 18, textAlign: 'left' }
    );

    expect(raised(RULE, [emptied, node('n1', 380, 120)])).toEqual([]);
    expect(raised(RULE, [emptied, link('d1', 410)])).toEqual([]);
  });

  it('keeps a perfectly straight edge, whose box is flat too', () => {
    // A vertical connector has a zero-WIDTH box and is measured along its path.
    // Dropping flat boxes wholesale would take every straight dependency on the
    // map out of the pass along with the emptied labels.
    const flat = element('d1', [150, 0, 0, 400], 'test:edge', {
      absolutePath: [
        [150, 0],
        [150, 400],
      ],
    });

    expect(raised(RULE, [text('t1', 100, 'abcdefghij'), flat])).toEqual([
      'd1+t1',
    ]);
  });

  it('never widens a box, and leaves an element with no text alone', () => {
    // A word longer than its box is clipped by the box, not spilled out of it.
    const long = text('t1', 0, 'a'.repeat(200));
    expect(raised(RULE, [long, node('n1', 210)])).toEqual([]);
    // And an element that exposes no text at all is measured as it always was.
    const boxOnly = element('t1', [0, 100, 200, 20], 'test:text');
    expect(raised(RULE, [boxOnly, link('d1', 150)])).toEqual(['d1+t1']);
  });
});

describe('`minPenetration` is what makes a touch a collision', () => {
  it('ignores boxes that barely reach into each other', () => {
    // Three units deep: reported without a threshold, silent with one.
    expect(raised(RULE, [node('n1', 0), node('n2', 17)])).toEqual(['n1+n2']);
    expect(raised(CALIBRATED, [node('n1', 0), node('n2', 17)])).toEqual([]);
    // Five, and both agree again.
    expect(raised(CALIBRATED, [node('n1', 0), node('n2', 15)])).toEqual([
      'n1+n2',
    ]);
  });

  it('measures how deep a path goes under an edge, not how long it stays', () => {
    const box = element('t1', [0, 100, 200, 20], 'test:text');
    const along = (y: number) =>
      element('d1', [0, y - 1, 400, 2], 'test:edge', {
        absolutePath: [
          [-100, y],
          [300, y],
        ],
      });

    // Running the whole length of the box, two units under its top edge: a lot
    // of crossing, no depth.
    expect(raised(CALIBRATED, [box, along(102)])).toEqual([]);
    // Through the middle: half the height of the box.
    expect(raised(CALIBRATED, [box, along(110)])).toEqual(['d1+t1']);
  });

  it('still reports two paths that cross, having no depth to measure', () => {
    // A line has no width, so there is nothing for a threshold to compare —
    // the crossing is the finding.
    const crossing: ValidationRule = {
      ...CALIBRATED,
      overlap: [['test:edge', 'test:edge']],
    };
    const diagonal = element('d2', [0, 0, 400, 400], 'test:edge', {
      absolutePath: [
        [0, 0],
        [400, 400],
      ],
    });

    expect(raised(crossing, [link('d1', 200), diagonal])).toEqual(['d1+d2']);
  });
});
