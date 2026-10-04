import { describe, expect, it, vi } from 'vitest';

import {
  normalizeCanvasExportColors,
  toLegacyColors,
} from '../../utils/canvas-export-colors.js';

/**
 * html2canvas 1.4.1 throws on any colour function but rgb(a)/hsl(a), so the
 * three `onclone` hooks of the PNG/PDF export and of "copy as image" rewrite
 * modern colours on the clone first. happy-dom computes no colour, so the
 * rewriting is tested here with an injected resolver; the real conversion and
 * the real html2canvas run live in the surface suite, under Chromium
 * (`export-manager-modern-colors.unit.spec.ts`).
 */
const fake = (color: string) => `rgb(<${color}>)`;

describe('toLegacyColors', () => {
  it('leaves a legacy value as the very same string', () => {
    const resolve = vi.fn(fake);
    for (const value of [
      'rgb(1, 2, 3)',
      'rgba(0, 0, 0, 0)',
      'hsl(10 20% 30%)',
      'none',
      '',
      'rgb(0, 0, 0) 0px 1px 2px 0px',
    ]) {
      expect(toLegacyColors(value, resolve)).toBe(value);
    }
    expect(resolve).not.toHaveBeenCalled();
  });

  it('replaces a modern colour function whole', () => {
    expect(toLegacyColors('oklch(0.7 0.1 200)', fake)).toBe(
      'rgb(<oklch(0.7 0.1 200)>)'
    );
    expect(toLegacyColors('color(srgb 0.1 0.2 0.3 / 0.5)', fake)).toBe(
      'rgb(<color(srgb 0.1 0.2 0.3 / 0.5)>)'
    );
  });

  it('replaces each colour of a list and keeps the rest', () => {
    expect(
      toLegacyColors(
        'oklch(0 0 0 / 0.2) 0px 1px 2px 0px, rgb(1, 2, 3) 0px 0px 1px 0px, lab(50 10 10) 1px 1px',
        fake
      )
    ).toBe(
      'rgb(<oklch(0 0 0 / 0.2)>) 0px 1px 2px 0px, rgb(1, 2, 3) 0px 0px 1px 0px, rgb(<lab(50 10 10)>) 1px 1px'
    );
  });

  it('takes a nested colour-mix whole, parentheses balanced', () => {
    expect(
      toLegacyColors(
        'linear-gradient(color-mix(in srgb, oklch(0.5 0.1 20) 30%, transparent), red)',
        fake
      )
    ).toBe(
      'linear-gradient(rgb(<color-mix(in srgb, oklch(0.5 0.1 20) 30%, transparent)>), red)'
    );
  });

  it('does not read `oklab(` as `lab(`', () => {
    const resolve = vi.fn(fake);
    toLegacyColors('oklab(0.5 0.1 0.1)', resolve);
    expect(resolve.mock.calls).toEqual([['oklab(0.5 0.1 0.1)']]);
  });
});

describe('normalizeCanvasExportColors', () => {
  const computed =
    (values: Map<Element, Record<string, string>>) => (node: Element) =>
      ({
        getPropertyValue: (property: string) =>
          values.get(node)?.[property] ?? '',
      }) as CSSStyleDeclaration;

  it('rewrites the subtree, <html> and <body>, inline and important', () => {
    const doc = document.implementation.createHTMLDocument('clone');
    const root = doc.createElement('div');
    const child = doc.createElement('span');
    const legacy = doc.createElement('em');
    root.append(child, legacy);
    doc.body.append(root);

    const values = new Map<Element, Record<string, string>>([
      [doc.documentElement, { 'background-color': 'oklch(1 0 0)' }],
      [doc.body, { 'background-color': 'oklch(0.7 0.1 200)' }],
      [root, { color: 'color(srgb 1 0 0)' }],
      [child, { 'box-shadow': 'oklch(0 0 0 / 0.1) 0px 1px 2px 0px' }],
      [legacy, { color: 'rgb(1, 2, 3)' }],
    ]);
    vi.spyOn(doc.defaultView ?? window, 'getComputedStyle').mockImplementation(
      computed(values)
    );

    normalizeCanvasExportColors(doc, root, fake);

    expect(doc.documentElement.style.getPropertyValue('background-color')).toBe(
      'rgb(<oklch(1 0 0)>)'
    );
    expect(doc.body.style.getPropertyValue('background-color')).toBe(
      'rgb(<oklch(0.7 0.1 200)>)'
    );
    expect(root.style.getPropertyValue('color')).toBe(
      'rgb(<color(srgb 1 0 0)>)'
    );
    expect(root.style.getPropertyPriority('color')).toBe('important');
    expect(child.style.getPropertyValue('box-shadow')).toBe(
      'rgb(<oklch(0 0 0 / 0.1)>) 0px 1px 2px 0px'
    );
    // Already legacy: not touched at all.
    expect(legacy.getAttribute('style')).toBeNull();

    vi.restoreAllMocks();
  });
});
