import { NoteDisplayMode } from '@labre/affine-model';
import { nothing, render } from 'lit';
import { describe, expect, it } from 'vitest';

import { EdgelessNoteBlockComponent } from '../note-edgeless-block.js';

/**
 * `EdgelessNoteBlockComponent` is a custom element sitting on a store, a gfx
 * controller and a viewport, so the two methods under test are exercised
 * against a hand-made `this` whose prototype is the component's. Lit's
 * `accessor` state fields live in private slots, hence the own data properties
 * that shadow them.
 */
function fakeNote({
  scale,
  zoom,
  borderRadius = 8,
}: {
  scale: number;
  zoom: number;
  borderRadius?: number;
}) {
  const note = Object.create(EdgelessNoteBlockComponent.prototype) as Record<
    string,
    unknown
  >;

  const own = (key: string, value: unknown) =>
    Object.defineProperty(note, key, { value, writable: true });

  own('model', {
    xywh: '[0,0,400,200]',
    props: {
      displayMode: NoteDisplayMode.DocAndEdgeless,
      xywh: '[0,0,400,200]',
      edgeless: {
        style: { borderRadius, borderSize: 4, shadowType: '' },
        collapse: false,
        scale,
      },
    },
    isPageBlock: () => false,
  });
  own('gfx', {
    viewport: { translateX: 0, translateY: 0, zoom },
    tool: { currentToolName$: { value: 'default' } },
  });
  own('std', { getOptional: () => undefined });
  own('store', { readonly$: { value: false } });
  own('host', undefined);
  own('renderPageContent', () => nothing);
  own('_editing', false);
  own('_isHover', false);
  own('_isResizing', false);
  own('_noteFullHeight', 0);
  own('hideMask', false);

  return note as unknown as EdgelessNoteBlockComponent;
}

/** Product of every `scale(n)` factor found in a CSS transform string. */
function effectiveScale(transform: string) {
  const factors = [...transform.matchAll(/scale\(([^)]+)\)/g)].map(m =>
    Number(m[1])
  );
  expect(factors.every(Number.isFinite)).toBe(true);
  return factors.reduce((acc, factor) => acc * factor, 1);
}

describe('edgeless note scale (upstream #14577)', () => {
  it('folds the note scale into the host element transform', () => {
    const note = fakeNote({ scale: 3, zoom: 2 });

    expect(effectiveScale(note.getCSSTransform())).toBeCloseTo(6);
  });

  it('leaves the host transform at the plain zoom when scale is 100%', () => {
    const note = fakeNote({ scale: 1, zoom: 2 });

    expect(effectiveScale(note.getCSSTransform())).toBeCloseTo(2);
  });

  it('does not scale the content a second time inside the element', () => {
    const note = fakeNote({ scale: 3, zoom: 2 });

    const host = document.createElement('div');
    render(note.renderGfxBlock(), host);

    const container = host.querySelector<HTMLElement>(
      '[data-testid="edgeless-note-container"]'
    );
    expect(container).not.toBeNull();
    // The element itself already carries the scale; a transform here would
    // paint the content at scale² inside a box sized for scale¹.
    expect(container?.style.transform).toBe('');
    expect(container?.dataset.scale).toBe('3');
  });
});
