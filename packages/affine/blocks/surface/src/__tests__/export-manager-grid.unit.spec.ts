/**
 * ADR 0031 §11 — the PNG export paints the grid only when this viewer sees
 * it. `_drawEdgelessBackground` draws an SVG built by `edgelessBackgroundSvg`;
 * with the grid off (`gridColor: null`) that SVG keeps the background colour
 * and drops the dotted `radial-gradient`, so an exported picture matches the
 * canvas it was taken from.
 */
import { describe, expect, test } from 'vitest';

import { edgelessBackgroundSvg } from '../extensions/export-manager/export-manager.js';

describe('the PNG export background', () => {
  const base = { size: 20, backgroundColor: '#ffffff' };

  test('grid on: background colour and the dotted grid', () => {
    const svg = edgelessBackgroundSvg(100, 50, { ...base, gridColor: '#ccc' });
    expect(svg).toContain('background-color:#ffffff');
    expect(svg).toContain('radial-gradient(#ccc 1px, #ffffff 1px)');
  });

  test('grid off: the background colour alone', () => {
    const svg = edgelessBackgroundSvg(100, 50, { ...base, gridColor: null });
    expect(svg).toContain('background-color:#ffffff');
    expect(svg).not.toContain('radial-gradient');
  });
});
