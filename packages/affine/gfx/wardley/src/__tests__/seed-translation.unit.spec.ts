import { describe, expect, it, vi } from 'vitest';

import { createWardleyBackground, createWardleyNode } from '../actions';

/**
 * The seeds this lot (#278) put through the translation seam:
 * `createWardleyNode`'s label and `createWardleyBackground`'s axis titles.
 * Mirrors the mechanism `docs/adr/0016` already proves for BPMN — a fake
 * `TranslationProvider` changes what lands in the document, its absence
 * keeps the English literal.
 */

type Added = Record<string, unknown>;

function fakeGfx(translate?: (key: string, params?: unknown) => string) {
  const added: Added[] = [];
  let n = 0;
  const gfx = {
    surface: {
      addElement: (props: Added) => {
        added.push(props);
        return `el-${n++}`;
      },
      getElementsByType: () => [],
    },
    viewport: { centerX: 100, centerY: 200, zoom: 1 },
    doc: { captureSync: vi.fn() },
    tool: { setTool: vi.fn() },
    selection: { set: vi.fn() },
    std: {
      getOptional: () => (translate ? { t: translate } : undefined),
      get: () => ({ recordLastProps: vi.fn() }),
      command: {
        exec: (_command: unknown, _options: { elements: string[] }) => [
          {},
          { groupId: 'group-0' },
        ],
      },
    },
  };
  return { gfx: gfx as never, added };
}

/** The text of a `text`-typed element the action added, wherever it lands. */
function textAdded(added: Added[]): string | undefined {
  const label = added.find(el => el['type'] === 'text');
  return label?.['text'] as string | undefined;
}

describe('a Wardley node label resolves through the host catalogue', () => {
  it('writes the English default with no provider registered', () => {
    const { gfx, added } = fakeGfx();
    createWardleyNode(gfx, 'component');
    expect(textAdded(added)).toBe('Component');
  });

  it('writes the translated word when a provider is registered', () => {
    const { gfx, added } = fakeGfx(key =>
      key === 'com.labre.wardley.seed.component' ? 'Composant' : ''
    );
    createWardleyNode(gfx, 'component');
    expect(textAdded(added)).toBe('Composant');
  });
});

describe('a Wardley background’s axis titles resolve through the host catalogue', () => {
  it('writes the English defaults with no provider registered', () => {
    const { gfx, added } = fakeGfx();
    createWardleyBackground(gfx, 'opportunity');
    expect(added[0]?.['yAxisTitle']).toBe('Opportunity');
  });

  it('writes the translated words when a provider is registered', () => {
    const { gfx, added } = fakeGfx(key => {
      if (key === 'com.labre.wardley.seed.axis-benefit') return 'Bénéfice';
      if (key === 'com.labre.wardley.seed.axis-investment')
        return 'Investissement';
      return '';
    });
    createWardleyBackground(gfx, 'benefit');
    expect(added[0]?.['visibilityHigh']).toBe('Bénéfice');
    expect(added[0]?.['visibilityLow']).toBe('Investissement');
  });
});
