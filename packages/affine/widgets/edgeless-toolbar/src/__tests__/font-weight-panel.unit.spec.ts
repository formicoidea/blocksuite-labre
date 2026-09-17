import { FontFamily, FontStyle, FontWeight } from '@labre/affine-model';
import { render } from 'lit';
import { afterEach, describe, expect, test } from 'vitest';

import { EdgelessFontWeightAndStylePanel } from '../panel/font-weight-and-style-panel.js';

/**
 * The panel offers the faces the browser has loaded for the current family,
 * not a hard-coded list of weights — so the whole behaviour is decided by what
 * `document.fonts` holds. Stubbing that set is enough to drive it, and keeps
 * the test free of an editor and of the network.
 */
type FaceLike = Pick<FontFace, 'family' | 'weight' | 'style'>;

const face = (
  weight: FontWeight,
  style: FontStyle = FontStyle.Normal
): FaceLike => ({ family: FontFamily.Inter, weight, style });

const ownFonts = Object.getOwnPropertyDescriptor(document, 'fonts');

const stubLoadedFaces = (faces: FaceLike[]) => {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { keys: () => faces[Symbol.iterator]() },
  });
};

if (!customElements.get('edgeless-font-weight-and-style-panel')) {
  customElements.define(
    'edgeless-font-weight-and-style-panel',
    EdgelessFontWeightAndStylePanel
  );
}

/** The rows the panel draws, as `data-weight` reports them. */
const renderedRows = () => {
  const panel = document.createElement(
    'edgeless-font-weight-and-style-panel'
  ) as EdgelessFontWeightAndStylePanel;
  panel.fontFamily = FontFamily.Inter;

  const container = document.createElement('div');
  render(panel.render(), container);

  return [...container.querySelectorAll('[data-weight]')].map(row => ({
    weight: row.getAttribute('data-weight'),
    label: (row.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
};

afterEach(() => {
  if (ownFonts) {
    Object.defineProperty(document, 'fonts', ownFonts);
    return;
  }
  Reflect.deleteProperty(document, 'fonts');
});

describe('edgeless font weight panel', () => {
  test('offers Bold and Bold Italic when the family ships a 700 face', () => {
    stubLoadedFaces([
      face(FontWeight.Regular),
      face(FontWeight.SemiBold),
      face(FontWeight.Bold),
      face(FontWeight.Regular, FontStyle.Italic),
      face(FontWeight.Bold, FontStyle.Italic),
    ]);

    const rows = renderedRows();

    expect(rows.map(row => row.weight)).toContain('700');
    expect(rows.map(row => row.weight)).toContain('700 italic');
    expect(rows.find(row => row.weight === '700')?.label).toBe('Bold');
    expect(rows.find(row => row.weight === '700 italic')?.label).toBe(
      'Bold Italic'
    );
  });

  test('offers no Bold when the family ships no 700 face', () => {
    stubLoadedFaces([face(FontWeight.Regular), face(FontWeight.SemiBold)]);

    const rows = renderedRows();

    expect(rows.map(row => row.weight)).toEqual(['400', '600']);
    expect(rows.map(row => row.label)).toEqual(['Regular', 'Semibold']);
  });
});
