import { InteractivityIdentifier } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { isEmptyCanvasAt } from '../dblclick-add-edgeless-text';

/**
 * A double click on bare canvas drops a text block. "Bare" used to mean one
 * thing — the model hit test picked nothing — and that was true for as long as
 * the only areas an element reacted on were the areas it could be selected by.
 *
 * Framework backgrounds broke the tie (#194): a Wardley map, an EDGY board or a
 * C4 boundary is selected by its border alone, while its axis and title labels
 * keep answering the double click that renames them. Over such a label the
 * model says "nobody is here" and the view is already opening an input, so the
 * text block lands on top of it and blurs it shut.
 */

function gfxStub(options: { picked?: object | null; viewAt?: boolean }) {
  return {
    getElementByPoint: () => options.picked ?? null,
    std: {
      getOptional: (identifier: unknown) =>
        identifier === InteractivityIdentifier && options.viewAt !== undefined
          ? { hasViewAt: () => options.viewAt }
          : null,
    },
  };
}

describe('what counts as empty canvas under a double click', () => {
  it('is empty when neither the model nor a view answers', () => {
    const gfx = gfxStub({ picked: null, viewAt: false });

    expect(isEmptyCanvasAt(gfx as never, 800, 400)).toBe(true);
  });

  it('is taken when the model picks an element', () => {
    const gfx = gfxStub({ picked: { id: 'shape' }, viewAt: false });

    expect(isEmptyCanvasAt(gfx as never, 800, 400)).toBe(false);
  });

  it('is taken when only the view answers — the label case', () => {
    const gfx = gfxStub({ picked: null, viewAt: true });

    expect(isEmptyCanvasAt(gfx as never, 1500, 880)).toBe(false);
  });

  it('falls back to the model when no interactivity manager is registered', () => {
    const gfx = gfxStub({ picked: null });

    expect(isEmptyCanvasAt(gfx as never, 800, 400)).toBe(true);
  });
});
