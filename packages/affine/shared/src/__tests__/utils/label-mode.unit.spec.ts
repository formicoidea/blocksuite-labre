import { describe, expect, it } from 'vitest';

import { fitsInscribedLabel } from '../../utils/label-mode.js';

/**
 * The arithmetic of rule R38 (ADR 0029): does "Hello World" at 18 units fit
 * inside a symbol at its creation size, or must its label gravitate?
 *
 * Each case is a real catalogue size, so a change to the constants that flips
 * one of them flips a framework's label mode — and its `label-mode` spec with
 * it. The BPMN task (180×108) and the BPMN event (56-unit ring) are the two
 * ends the rule was written from; the annotation (140×48) is the case that sits
 * within a unit of the one-line threshold.
 */
describe('fitsInscribedLabel', () => {
  it('fits in a 180×108 rect (BPMN activity)', () => {
    expect(fitsInscribedLabel({ w: 180, h: 108, shapeType: 'rect' })).toBe(
      true
    );
  });

  it('does not fit in a 56×56 ellipse (BPMN event)', () => {
    expect(fitsInscribedLabel({ w: 56, h: 56, shapeType: 'ellipse' })).toBe(
      false
    );
  });

  it('does not fit in a 72×72 diamond (BPMN gateway)', () => {
    expect(fitsInscribedLabel({ w: 72, h: 72, shapeType: 'diamond' })).toBe(
      false
    );
  });

  it('fits on one line in a 140×48 rect (BPMN annotation)', () => {
    // Too short for two lines (2 × 21.6 > 28): only the one-line layout fits.
    expect(fitsInscribedLabel({ w: 140, h: 48, shapeType: 'rect' })).toBe(true);
  });

  it('fits on two lines in a 120×72 rect', () => {
    // Too narrow for one line (99 > 80): only the two-line layout fits.
    expect(fitsInscribedLabel({ w: 120, h: 72, shapeType: 'rect' })).toBe(true);
  });

  it('treats an unknown polygon as a rectangle', () => {
    expect(fitsInscribedLabel({ w: 180, h: 108, shapeType: 'triangle' })).toBe(
      true
    );
  });

  it('never fits a box smaller than its insets', () => {
    expect(fitsInscribedLabel({ w: 30, h: 16, shapeType: 'rect' })).toBe(false);
  });

  it('scales with the reference font size', () => {
    expect(
      fitsInscribedLabel({ w: 140, h: 48, shapeType: 'rect', fontSize: 24 })
    ).toBe(false);
  });
});
