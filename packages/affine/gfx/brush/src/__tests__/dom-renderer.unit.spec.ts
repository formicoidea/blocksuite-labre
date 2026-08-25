import type {
  BrushElementModel,
  HighlighterElementModel,
} from '@labre/affine-model';
import type { ExtensionType } from '@labre/store';
import { describe, expect, it } from 'vitest';

import {
  BrushDomRendererExtension,
  HighlighterDomRendererExtension,
} from '../renderer';

type DomElementRenderer = (
  model: unknown,
  domElement: HTMLElement,
  renderer: unknown
) => void;

/**
 * The extensions only expose themselves through the DI container, so pull the
 * renderer back out with a container stub instead of duplicating it here.
 */
function extractRenderer(extension: ExtensionType): DomElementRenderer {
  let implementation: DomElementRenderer | undefined;
  extension.setup({
    addValue: (_identifier: unknown, value: DomElementRenderer) => {
      implementation = value;
    },
  } as never);
  if (!implementation) throw new Error('no renderer registered');
  return implementation;
}

function makeRenderer(zoom = 1) {
  return {
    viewport: { zoom },
    getColorValue: () => '#123456',
    // Present on purpose: a renderer that reached for it would be applying a
    // z-index of its own, which `DomRenderer` now owns.
    layerManager: {
      getZIndex: () => {
        throw new Error('element renderers must not read the z-index');
      },
    },
  };
}

function makeStroke(overrides: Record<string, unknown> = {}) {
  return {
    deserializedXYWH: [0, 0, 40, 20],
    commands: 'M0 0 L10 10 Z',
    rotate: 0,
    color: '#000000',
    ...overrides,
  } as unknown as BrushElementModel & HighlighterElementModel;
}

describe.each([
  ['brush', BrushDomRendererExtension],
  ['highlighter', HighlighterDomRendererExtension],
])('%s DOM renderer', (_name, extension) => {
  const render = extractRenderer(extension);

  it('paints the stroke as an svg path', () => {
    const host = document.createElement('div');

    render(makeStroke(), host, makeRenderer(2));

    const svg = host.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('viewBox')).toBe('0 0 40 20');
    expect(svg!.style.width).toBe('80px');

    const path = svg!.querySelector('path');
    expect(path!.getAttribute('d')).toBe('M0 0 L10 10 Z');
    expect(path!.getAttribute('fill')).toBe('#123456');

    expect(host.style.width).toBe('80px');
    expect(host.style.height).toBe('40px');
  });

  it('leaves the z-index to the DOM renderer', () => {
    const host = document.createElement('div');

    render(makeStroke(), host, makeRenderer());

    expect(host.style.zIndex).toBe('');
  });

  it('keeps the same svg node across renders', () => {
    const host = document.createElement('div');

    render(makeStroke(), host, makeRenderer());
    const first = host.querySelector('svg');

    render(makeStroke({ commands: 'M0 0 L20 20 Z' }), host, makeRenderer(3));
    const second = host.querySelector('svg');

    expect(second).toBe(first);
    expect(second!.querySelector('path')!.getAttribute('d')).toBe(
      'M0 0 L20 20 Z'
    );
    expect(second!.style.width).toBe('120px');
  });

  it('drops the retained nodes when the stroke turns degenerate', () => {
    const host = document.createElement('div');

    render(makeStroke(), host, makeRenderer());
    expect(host.querySelector('svg')).not.toBeNull();

    render(makeStroke({ commands: '' }), host, makeRenderer());
    expect(host.querySelector('svg')).toBeNull();

    // ...and comes back with a fresh node once the stroke is drawable again.
    render(makeStroke(), host, makeRenderer());
    expect(host.querySelector('svg')).not.toBeNull();
  });

  it('draws nothing for a degenerate stroke', () => {
    const host = document.createElement('div');

    render(makeStroke({ deserializedXYWH: [0, 0, 0, 0] }), host, makeRenderer());
    expect(host.querySelector('svg')).toBeNull();

    render(makeStroke({ commands: '' }), host, makeRenderer());
    expect(host.querySelector('svg')).toBeNull();
  });
});
