/**
 * A colour panel swatch paints a CSS variable string as well as a plain
 * colour. The database options' chip colours are `var(--affine-v2-chip-…)`
 * strings, picked from the canvas swatch grid since ADR 0036's amendment of
 * 2026-10-14, and `var(...)` in an SVG `fill` attribute is only an engine's
 * courtesy: the swatch also paints through an inline `fill` declaration.
 *
 * What it would have caught:
 * - a chip colour swatch painted through the attribute alone, black or
 *   empty where an engine does not resolve the variable;
 * - a canvas swatch (a plain colour) painted any differently than before:
 *   its attribute is unchanged and the declaration says the same colour.
 */
import { ColorScheme } from '@labre/affine-model';
import { beforeAll, describe, expect, test } from 'vitest';

import { effects, type EdgelessColorButton } from '../color-picker/index.js';

beforeAll(() => {
  if (!customElements.get('edgeless-color-button')) effects();
});

async function paintOf(color: string, hollowCircle = false) {
  const button = document.createElement(
    'edgeless-color-button'
  ) as EdgelessColorButton;
  button.color = color;
  button.theme = ColorScheme.Light;
  button.hollowCircle = hollowCircle;
  document.body.append(button);
  await button.updateComplete;
  const svg = button.shadowRoot?.querySelector('svg');
  expect(svg).toBeTruthy();
  const paint = {
    attribute: svg!.getAttribute('fill'),
    style: svg!.style.getPropertyValue('fill'),
  };
  button.remove();
  return paint;
}

describe('a colour panel swatch', () => {
  const chip = 'var(--affine-v2-chip-label-red)';

  test('paints a CSS variable string through its style', async () => {
    expect(await paintOf(chip)).toEqual({ attribute: chip, style: chip });
    expect(await paintOf(chip, true)).toEqual({ attribute: chip, style: chip });
  });

  test('paints a plain colour as before, attribute and style alike', async () => {
    expect(await paintOf('#ff0000')).toEqual({
      attribute: '#ff0000',
      style: '#ff0000',
    });
  });
});
