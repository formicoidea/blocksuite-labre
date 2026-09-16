import { describe, expect, it, vi } from 'vitest';

import { DOMAINS, REF_H, REF_W } from '../cynefin/consts';
import { cynefin } from '../cynefin/element-renderer';

/**
 * `Path2D` does not exist under Node, and the Cynefin renderer builds several —
 * at PAINT time, inside the render function, so stubbing it here at module
 * scope is early enough. Same stand-in, same reason as
 * `estuarine-ghost.unit.spec.ts`.
 */
class FakePath2D {
  constructor(readonly d: string) {}
}

vi.stubGlobal('Path2D', FakePath2D);

/** A 2D context stand-in recording the words the renderer asked for. */
function fakeCtx() {
  const texts: string[] = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    setTransform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    measureText: () => ({ width: 10 }),
    fillText: (text: string) => void texts.push(text),
  };
  return { ctx, texts };
}

function fakeMatrix() {
  const matrix = {
    translateSelf: () => matrix,
    rotateSelf: () => matrix,
  };
  return matrix;
}

function render(overrides: Record<string, unknown> = {}) {
  const harness = fakeCtx();
  cynefin(
    {
      deserializedXYWH: [0, 0, REF_W, REF_H],
      rotate: 0,
      showTitles: true,
      showDescriptions: false,
      showLiminalLine: false,
      ...overrides,
    } as never,
    harness.ctx as never,
    fakeMatrix() as never,
    // The renderer takes a renderer, a rough canvas and a viewport bound too,
    // and touches none of the three — with no renderer, every wording reads
    // its English fallback.
    undefined as never,
    undefined as never,
    undefined as never
  );
  return harness.texts;
}

/**
 * A renamed domain heading is PAINTED, which is the half of issue #355 that no
 * hit test can prove.
 *
 * Everything downstream of the canvas — the reading panel, the SVG export —
 * reads the same `cynefinHeadingText`, so a word that reaches `fillText`
 * reaches them too.
 */
describe('what a Cynefin diagram writes on itself', () => {
  it('paints the vocabulary while nobody has renamed anything', () => {
    const said = render();
    expect(said).toContain('Complex');
    expect(said).toContain('Clear');
  });

  it("paints the user's own word once a domain has been renamed", () => {
    const said = render({ complexTitle: 'Complexe' });
    expect(said).toContain('Complexe');
    expect(said).not.toContain('Complex');
    // The other three are untouched: one prop per heading.
    expect(said).toContain('Complicated');
  });

  it('binds every renamable heading to a distinct prop', () => {
    const props = DOMAINS.map(domain => domain.prop);
    expect(props).toEqual([
      'complexTitle',
      'complicatedTitle',
      'chaoticTitle',
      'clearTitle',
    ]);
  });
});
