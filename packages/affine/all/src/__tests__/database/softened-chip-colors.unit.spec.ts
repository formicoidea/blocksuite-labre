import { FrameworkPaletteIdentifier } from '@labre/affine-components/color-picker';
import { ViewExtensionManager } from '@labre/affine-ext-loader';
import {
  isSoftenedChipColor,
  SOFTENED_BACKGROUND_TOKEN,
  softenedChipColor,
  softenedFrameworkPalettes,
} from '@labre/data-view';
import { Container } from '@labre/global/di';
import { darkCssVariables, lightCssVariables } from '@toeverything/theme';
import {
  darkCssVariablesV2,
  darkThemeV2,
  lightCssVariablesV2,
  lightThemeV2,
} from '@toeverything/theme/v2';
import { describe, expect, test } from 'vitest';

import { getInternalViewExtensions } from '../../extensions/view.js';

/**
 * Every swatch the database colour grid offers on a framework page (ADR 0036
 * amendment of 2026-10-14, "framework pages") carries the chip's text in
 * BOTH themes: a softened framework colour is one stored string,
 * `color-mix(in srgb, #rrggbb NN%, var(--affine-v2-layer-background-primary))`,
 * so its light look and its dark look are fixed by the theme's own tokens,
 * read here from the theme the library ships.
 *
 * What it would have caught:
 * - a share, a pastel limit or a framework colour (a new palette, a new
 *   swatch) that leaves a chip's primary text under WCAG AA (4.5:1) in
 *   either theme;
 * - a background token that the theme does not define in both schemes, so
 *   the mix would read nothing;
 * - a pastel framework colour that changes its light-theme look;
 * - a generated swatch the stored-value check refuses, or two swatches of
 *   one page painting the same string.
 */

const AA = 4.5;

type Rgb = [number, number, number];

function parse(color: string): Rgb {
  const hex = /^#([0-9a-f]{6})/i.exec(color);
  if (hex?.[1]) {
    const value = Number.parseInt(hex[1], 16);
    return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
  }
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  throw new Error(`not an opaque colour: ${color}`);
}

const linear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]: Rgb) =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

function contrast(a: Rgb, b: Rgb): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

/** What the browser paints for `color-mix(in srgb, source share%, background)`. */
function painted(softened: string, background: Rgb): Rgb {
  const match = /#([0-9a-f]{6}) (\d+)%/.exec(softened);
  if (!match?.[1]) throw new Error(softened);
  const share = Number(match[2]) / 100;
  const source = parse(`#${match[1]}`);
  return source.map((value, index) =>
    Math.round(value * share + background[index]! * (1 - share))
  ) as Rgb;
}

const THEMES = {
  light: {
    background: parse(lightThemeV2['layer/background/primary']),
    // The chip text: the v2 primary and the v1 one a cell inherits.
    texts: [
      parse(lightThemeV2['text/primary']),
      parse(lightCssVariables['--affine-text-primary-color']),
    ],
  },
  dark: {
    background: parse(darkThemeV2['layer/background/primary']),
    texts: [
      parse(darkThemeV2['text/primary']),
      parse(darkCssVariables['--affine-text-primary-color']),
    ],
  },
};

const english = ([, fallback]: readonly [string, string]) => fallback;

function frameworkPalettes(scope: 'page' | 'edgeless') {
  const manager = new ViewExtensionManager(getInternalViewExtensions({}));
  const container = new Container();
  manager.get(scope).forEach(ext => ext.setup(container));
  return [...container.provider().getAll(FrameworkPaletteIdentifier).values()];
}

const pages = frameworkPalettes('page').map(framework => ({
  framework,
  swatches: softenedFrameworkPalettes(framework, english),
}));

describe('the softened chip colours of every framework page', () => {
  test('there is a page for each registered framework, in a page as on the canvas', () => {
    expect(pages.map(page => page.framework.framework).sort()).toEqual(
      frameworkPalettes('edgeless')
        .map(framework => framework.framework)
        .sort()
    );
    expect(pages.length).toBe(8);
    for (const { swatches } of pages)
      expect(swatches.length).toBeGreaterThan(1);
  });

  test('the background token is defined, as the table says, in both schemes', () => {
    expect(lightCssVariablesV2[SOFTENED_BACKGROUND_TOKEN]).toBe(
      lightThemeV2['layer/background/primary']
    );
    expect(darkCssVariablesV2[SOFTENED_BACKGROUND_TOKEN]).toBe(
      darkThemeV2['layer/background/primary']
    );
    // The pastel rule reproduces a colour on white.
    expect(THEMES.light.background).toEqual([255, 255, 255]);
  });

  test.each(pages.map(page => [page.framework.framework, page] as const))(
    '%s: every swatch carries primary text at AA in both themes',
    (_, { swatches }) => {
      for (const swatch of swatches) {
        const value = swatch.value as string;
        expect(isSoftenedChipColor(value)).toBe(true);
        for (const theme of Object.values(THEMES)) {
          const chip = painted(value, theme.background);
          for (const text of theme.texts) {
            expect(
              contrast(chip, text),
              `${swatch.key} ${value}`
            ).toBeGreaterThanOrEqual(AA);
          }
        }
      }
    }
  );

  test.each(pages.map(page => [page.framework.framework, page] as const))(
    '%s: no two swatches paint the same string',
    (_, { swatches }) => {
      const values = swatches.map(swatch => swatch.value);
      expect(new Set(values).size).toBe(values.length);
    }
  );

  test('a pastel framework colour keeps its light look', () => {
    let pastels = 0;
    for (const { framework } of pages) {
      for (const palette of framework.palettes) {
        const value =
          typeof palette.value === 'string'
            ? palette.value
            : 'light' in palette.value
              ? palette.value.light
              : palette.value.normal;
        const softened = softenedChipColor(palette.value);
        if (!softened || !/^#[0-9a-f]{6}$/i.test(value)) continue;
        const source = parse(value);
        // Already a mix of at most 35% of a colour with white.
        if (Math.min(...source) < 255 * 0.65) continue;
        pastels++;
        expect(painted(softened, THEMES.light.background)).toEqual(source);
      }
    }
    expect(pastels).toBeGreaterThan(5);
  });
});
