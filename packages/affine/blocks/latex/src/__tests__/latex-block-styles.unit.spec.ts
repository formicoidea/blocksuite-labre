/**
 * The equation preview stretches — upstream #14857.
 *
 * `.latex-block-container` is a column flex box that scrolls horizontally. It
 * used to centre its cross axis, which shrank the rendered formula to its own
 * width and put the overflowing part of a wide equation out of the scroll's
 * reach. Stretching hands the full width to the katex output instead, which
 * centres short formulas on its own.
 *
 * There is no layout engine here, so this reads the rule that applies to the
 * container rather than the resulting geometry; the scrolling itself is left
 * to integration coverage.
 */
import { describe, expect, it } from 'vitest';

import { latexBlockStyles } from '../styles.js';

/** The value `property` resolves to on a `.latex-block-container` element. */
function containerStyle(property: string) {
  const style = document.createElement('style');
  style.textContent = latexBlockStyles.cssText;
  document.head.append(style);

  const container = document.createElement('div');
  container.className = 'latex-block-container';
  document.body.append(container);

  const value = getComputedStyle(container).getPropertyValue(property);

  container.remove();
  style.remove();
  return value;
}

describe('latexBlockStyles', () => {
  it('lets the rendered equation take the container width', () => {
    expect(containerStyle('align-items')).toBe('stretch');
  });

  it('keeps the container horizontally scrollable', () => {
    expect(containerStyle('overflow-x')).toBe('auto');
  });
});
