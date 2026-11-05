import { STICKY_FONT_SIZE } from '@labre/affine-gfx-ddd-shared';
import { fitsInscribedLabel } from '@labre/affine-shared/utils';
import { Bound } from '@labre/global/gfx';
import { describe, expect, it } from 'vitest';

import { ES_STICKY_ROLE, type EventStormingStickyKind } from '../roles';
import { eventStormingStickyElements } from '../toolbox';

/**
 * Rule R38 for Event Storming (ADR 0029, amendment of 2026-11-04): every
 * sticky carries its name as its own inner text, so every sticky, as the
 * toolbar places it, must hold two lines of its Kalam 20 inside its
 * silhouette — the hotspot's diamond included, now born at 180.
 *
 * What it would have caught: the hotspot ADR 0029 recorded as a deviation — a
 * 120-unit diamond whose inscribed rectangle (40 units wide) cannot hold a
 * five-letter word at 20, so the `Contained` fit shrank the font below the
 * wall's handwriting size; and any new sticky kind, or a size change, that
 * puts a name in a symbol too small for it.
 */
const KINDS = Object.keys(ES_STICKY_ROLE) as EventStormingStickyKind[];

describe('Event Storming stickies hold their name (R38)', () => {
  it.each(KINDS)('%s', kind => {
    const [, face] = eventStormingStickyElements(kind, { x: 0, y: 0 });
    const [, , w, h] = Bound.deserialize(String(face?.xywh)).toXYWH();
    expect(
      fitsInscribedLabel({
        w,
        h,
        shapeType: String(face?.shapeType),
        fontSize: STICKY_FONT_SIZE,
      })
    ).toBe(true);
  });

  it('includes the hotspot diamond', () => {
    expect(KINDS).toContain('hotspot');
  });
});
