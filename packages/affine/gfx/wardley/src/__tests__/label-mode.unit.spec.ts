import type { SerializedElementProps } from '@labre/affine-block-surface/interchange';
import { fitsInscribedLabel } from '@labre/affine-shared/utils';
import { Bound } from '@labre/global/gfx';
import { describe, expect, it } from 'vitest';

import { competitionOfPorterLetter } from '../porter-competition';
import { wardleyAreaBox, wardleyAreaProps } from '../presets';
import { WARDLEY_TOOLBOX } from '../toolbox';

/**
 * Rule R38 for Wardley (ADR 0029, amendment of 2026-11-04): every kind that
 * INSCRIBES text in its own shape fits "Hello World" at 18 units at its
 * creation size, except a declared GLYPH — a shape whose inscribed text IS the
 * notation, one character kept in step with a tag. The Porter letter is the
 * only such glyph: its 60-unit circle holds R, L or E and never a name.
 *
 * What it would have caught: a new Wardley kind born with its name as its own
 * inner text in a symbol too small to hold it, with no declared exception —
 * the deviation ADR 0029 found on `porter` and left as a Backlog ticket; and,
 * the other way, a Porter glyph that stops being a one-letter notation synced
 * with `wardley:competition` (a seed that is a word, a letter the tag cannot
 * read) while this spec still exempts it.
 *
 * The inscribed kinds are read off what the toolbar builds — a `shape` or a
 * `wardleyNode` that styles inner text — never off a hand-written list, so a
 * new item is checked the day it lands. The polygon area is added by hand: it
 * is a drawing tool the toolbar does not place (`WARDLEY_TOOLBOX`'s docblock).
 */

/** Kinds whose inscribed text is the notation itself (ADR 0029, 2026-11-04). */
const DECLARED_GLYPHS: ReadonlySet<string> = new Set(['porter']);

const inscribes = (element: SerializedElementProps) =>
  (element.type === 'shape' || element.type === 'wardleyNode') &&
  ('text' in element || 'fontSize' in element);

const inscribed: SerializedElementProps[] = [
  ...WARDLEY_TOOLBOX.items.flatMap(item => item.build({ x: 0, y: 0 })),
  wardleyAreaProps('polygon', { xywh: wardleyAreaBox('polygon', 0, 0) }),
].filter(inscribes);

const kindOf = (element: SerializedElementProps) =>
  String(element.kind ?? element.type);

const fits = (element: SerializedElementProps) => {
  const [, , w, h] = Bound.deserialize(String(element.xywh)).toXYWH();
  return fitsInscribedLabel({ w, h, shapeType: String(element.shapeType) });
};

describe('Wardley inscribed labels follow the symbol size (R38)', () => {
  it('finds the inscribed kinds, the declared glyph among them', () => {
    expect(inscribed.map(kindOf).sort()).toEqual(['area', 'area', 'porter']);
  });

  it.each(inscribed.filter(e => !DECLARED_GLYPHS.has(kindOf(e))))(
    '$kind ($shapeType) fits the probe',
    element => {
      expect(fits(element)).toBe(true);
    }
  );

  describe('the Porter letter is a declared glyph', () => {
    const porter = inscribed.filter(e => kindOf(e) === 'porter');

    it('would fail the probe, so the exemption is load-bearing', () => {
      expect(porter).toHaveLength(1);
      expect(fits(porter[0])).toBe(false);
    });

    it('inscribes one character the competition tag reads', () => {
      const text = String(porter[0].text);
      expect(text).toHaveLength(1);
      expect(competitionOfPorterLetter(text)).not.toBeNull();
    });
  });
});
