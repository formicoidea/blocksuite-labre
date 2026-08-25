import { describe, expect, it } from 'vitest';

import type { Layer } from '../../gfx/layer.js';
import { getLayerEndZIndex, updateLayersZIndex } from '../../utils/layer.js';

/**
 * A canvas layer used to occupy a single CSS z-index, because it was painted
 * as one canvas. Since the DOM renderer gives every canvas element its own
 * host node, each element of a canvas layer needs its own index too —
 * otherwise a shape and the note stacked right above it fight over the same
 * value. See upstream #13465.
 */
function makeLayer(type: 'block' | 'canvas', elementCount: number): Layer {
  return {
    type,
    zIndex: 0,
    elements: Array.from({ length: elementCount }, () => ({})),
    set: new Set(),
    indexes: ['a0', 'a0'],
  } as unknown as Layer;
}

describe('layer z-index accounting', () => {
  it('reserves one z-index per element in a canvas layer', () => {
    const layers = [
      makeLayer('block', 3),
      makeLayer('canvas', 2),
      makeLayer('block', 1),
    ];
    layers[0].zIndex = 1;

    updateLayersZIndex(layers, 0);

    expect(layers[0].zIndex).toBe(1);
    expect(layers[1].zIndex).toBe(4);
    // Would be 5 if the canvas layer only reserved a single index.
    expect(layers[2].zIndex).toBe(6);
  });

  it('ends a canvas layer after its last element', () => {
    const layers = [makeLayer('canvas', 3)];
    layers[0].zIndex = 2;

    expect(getLayerEndZIndex(layers, 0)).toBe(4);
    expect(getLayerEndZIndex(layers, 1)).toBe(0);
  });
});
