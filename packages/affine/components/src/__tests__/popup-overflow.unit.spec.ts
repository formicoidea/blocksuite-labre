/**
 * What this would have caught: #392 — a horizontal scrollbar flashing across
 * the colour picker for the length of the palette carousel's entry animation.
 *
 * Nobody ever asked a toolbar popup to scroll sideways. But CSS Overflow
 * computes a `visible` axis to `auto` as soon as the OTHER axis is not
 * `visible`, so the `overflow-y: auto` these two boxes need made both of them
 * horizontal scroll containers by accident. A transform contributes to the
 * scrollable overflow region, so the carousel's incoming page — which starts
 * at `translateX(14px)` — pushed the scrollable width 8px past the box for
 * ~240ms, and a scrollbar was painted for exactly that long. Coming the other
 * way (`translateX(-14px)`) it overflowed the START edge, which LTR clips
 * without ever scrolling: hence the one-sided symptom of the report.
 *
 * There is no layout engine here, so this reads the rule that applies to the
 * box rather than the geometry — the same trade as
 * `blocks/latex/src/__tests__/latex-block-styles.unit.spec.ts`. The geometry
 * (a real popup, a real animation, a real scroll offset that refuses to move)
 * is the integration spec's job: `framework-palette-carousel.spec.ts`.
 */
import type { CSSResult } from 'lit';
import { beforeAll, describe, expect, it } from 'vitest';

import { paletteCarouselStyles } from '../color-picker/palette-carousel.js';
import { EditorMenuContent } from '../toolbar/menu-button.js';

/** Every stylesheet under test, mounted once for the whole file. */
beforeAll(() => {
  const sheets = [EditorMenuContent.styles as CSSResult, paletteCarouselStyles];
  for (const sheet of sheets) {
    const style = document.createElement('style');
    style.textContent = sheet.cssText;
    document.head.append(style);
  }
});

/** The value `property` resolves to on an element carrying `className`. */
function styleOf(className: string, property: string) {
  const element = document.createElement('div');
  element.className = className;
  document.body.append(element);
  const value = getComputedStyle(element).getPropertyValue(property);
  element.remove();
  return value;
}

describe.each([
  ['the toolbar popup box', 'content-wrapper'],
  ["the palette carousel's page list", 'palette-carousel-list'],
])('%s', (_name, className) => {
  it('never becomes a horizontal scroll container', () => {
    // Not merely "not auto": the axis has to be shut explicitly, because the
    // value it would otherwise compute to is the bug.
    expect(styleOf(className, 'overflow-x')).toBe('hidden');
  });

  it('still scrolls vertically, which is what it was asking for', () => {
    expect(styleOf(className, 'overflow-y')).toBe('auto');
  });
});
