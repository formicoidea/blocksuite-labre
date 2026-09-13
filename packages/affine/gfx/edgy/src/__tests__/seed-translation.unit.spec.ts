import { describe, expect, it, vi } from 'vitest';

import { createEdgyFacets } from '../actions';

/**
 * `createEdgyFacets` writes the three facet names explicitly rather than
 * leaving them to the model's defaults (#278) — this proves the mechanism:
 * a fake `TranslationProvider` changes what lands in the document, its
 * absence keeps the English literal (`Identity` / `Architecture` /
 * `Experience`, the very defaults `EdgyFacetsElementModel` still carries for
 * a document created before this key existed).
 */

type Added = Record<string, unknown>;

function fakeStd(translate?: (key: string) => string) {
  const added: Added[] = [];
  const gfx = {
    surface: { addElement: (props: Added) => (added.push(props), 'el-0') },
    viewport: { centerX: 100, centerY: 200 },
    doc: { captureSync: vi.fn() },
    tool: { setTool: vi.fn() },
    selection: { set: vi.fn() },
  };
  const std = {
    get: () => gfx,
    getOptional: () => (translate ? { t: translate } : undefined),
  };
  return { std: std as never, added };
}

describe('the EDGY facets diagram names its three circles at creation', () => {
  it('writes the English defaults with no provider registered', () => {
    const { std, added } = fakeStd();
    createEdgyFacets(std);
    expect(added[0]?.['identityLabel']).toBe('Identity');
    expect(added[0]?.['architectureLabel']).toBe('Architecture');
    expect(added[0]?.['experienceLabel']).toBe('Experience');
  });

  it('writes the translated words when a provider is registered', () => {
    const { std, added } = fakeStd(key => {
      if (key === 'com.labre.edgy.seed.identity') return 'Identité';
      if (key === 'com.labre.edgy.seed.architecture') return 'Architecture-FR';
      if (key === 'com.labre.edgy.seed.experience') return 'Expérience';
      return '';
    });
    createEdgyFacets(std);
    expect(added[0]?.['identityLabel']).toBe('Identité');
    expect(added[0]?.['architectureLabel']).toBe('Architecture-FR');
    expect(added[0]?.['experienceLabel']).toBe('Expérience');
  });
});
