import {
  combinedDarkCssVariables,
  combinedLightCssVariables,
} from '@toeverything/theme';
import { describe, expect, test } from 'vitest';

import { LABRE_ACCENT } from '../../consts/accent.js';
import {
  accentStyleSheetText,
  accentVariables,
  withAccent,
} from '../../theme/accent.js';

/**
 * The re-pointing that makes Labre's accent the editor's accent (ADR 0029).
 *
 * These are the pure halves of the mechanism — the rewrite and the generated
 * stylesheet. What the browser actually paints is pinned by the integration
 * spec `labre-accent.spec.ts`, which mounts an editor and reads
 * `getComputedStyle`; this file is what tells you WHY it paints that, and it
 * runs without a DOM.
 *
 * The upstream accent is never spelled out here either: every expectation is
 * built from the theme package, exactly as the implementation is, so a bump of
 * `@toeverything/theme` that moves the accent moves this spec with it.
 */

/** The upstream tables, indexable by any variable name. */
const LIGHT = combinedLightCssVariables as unknown as Record<string, string>;
const DARK = combinedDarkCssVariables as unknown as Record<string, string>;

const BORROWED_LIGHT = combinedLightCssVariables['--affine-primary-color'];
const BORROWED_DARK = combinedDarkCssVariables['--affine-primary-color'];

/** `#1E96EB` → `30, 150, 235`, without writing either down. */
const channels = (hex: string) =>
  [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

describe('the Labre accent', () => {
  test('is the value the product owner settled on', () => {
    expect(LABRE_ACCENT).toBe('#2563eb');
  });

  test('carries white text at AA, which the accent it replaces did not', () => {
    // WCAG 2.1 relative luminance, then the contrast ratio against white.
    const luminance = (hex: string) =>
      channels(hex)
        .map(c => c / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    const againstWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

    expect(againstWhite(LABRE_ACCENT)).toBeGreaterThanOrEqual(4.5);
    expect(againstWhite(BORROWED_LIGHT)).toBeLessThan(4.5);
  });
});

describe('withAccent', () => {
  test('rewrites a plain hex, in either case', () => {
    expect(withAccent(BORROWED_LIGHT)).toBe(LABRE_ACCENT);
    expect(withAccent(BORROWED_LIGHT.toLowerCase())).toBe(LABRE_ACCENT);
    expect(withAccent(BORROWED_DARK)).toBe(LABRE_ACCENT);
  });

  test('keeps the alpha byte of an eight-digit hex', () => {
    const marquee =
      LIGHT['--affine-v2-edgeless-selection-selectionMarqueeBackground']!;
    const alpha = marquee.slice(7);
    expect(alpha).toHaveLength(2);
    expect(withAccent(marquee)).toBe(`${LABRE_ACCENT}${alpha}`);
  });

  test('keeps the function and the alpha argument of an rgb()/rgba()', () => {
    const [r, g, b] = channels(BORROWED_LIGHT);
    const [ar, ag, ab] = channels(LABRE_ACCENT);
    expect(withAccent(`rgba(${r}, ${g}, ${b}, 0.30)`)).toBe(
      `rgba(${ar}, ${ag}, ${ab}, 0.30)`
    );
    expect(withAccent(`rgb(${r},${g},${b})`)).toBe(`rgb(${ar}, ${ag}, ${ab})`);
  });

  test('rewrites the colour inside a compound value, leaving the rest alone', () => {
    const ring = combinedLightCssVariables['--affine-active-shadow'];
    const [r, g, b] = channels(BORROWED_LIGHT);
    expect(ring).toContain(`${r}, ${g}, ${b}`);
    const rewritten = withAccent(ring);
    expect(rewritten.startsWith('0px 0px 0px 2px')).toBe(true);
    expect(rewritten).toContain(channels(LABRE_ACCENT).join(', '));
  });

  test('leaves every other colour untouched, notation hues included', () => {
    // C4's container blue and the canvas palette's medium blue: content under
    // The Standard-Fidelity Rule, and near enough in hue to catch a sloppy
    // matcher.
    for (const other of ['#438DD5', '#1168BD', '#84CFFF', '#1E67AF', '#fff']) {
      expect(withAccent(other)).toBe(other);
    }
    // A longer hex that merely starts with the accent's digits.
    expect(withAccent(`${BORROWED_LIGHT}ff00`)).toBe(`${BORROWED_LIGHT}ff00`);
    // A colour sharing two of the three channels.
    const [r, g] = channels(BORROWED_LIGHT);
    expect(withAccent(`rgb(${r}, ${g}, 200)`)).toBe(`rgb(${r}, ${g}, 200)`);
  });

  test('honours an accent other than ours, which is the host seam', () => {
    expect(withAccent(BORROWED_LIGHT, '#7c3aed')).toBe('#7c3aed');
  });
});

describe('accentVariables', () => {
  test('re-points the tokens the chrome reads for its accent', () => {
    const light = accentVariables(false);
    const dark = accentVariables(true);

    for (const name of [
      '--affine-primary-color',
      '--affine-brand-color',
      '--affine-v2-button-primary',
      '--affine-v2-button-checkBox',
      '--affine-v2-icon-activated',
      '--affine-v2-layer-insideBorder-primaryBorder',
      '--affine-v2-edgeless-selection-selectionMarqueeBorder',
      '--affine-v2-edgeless-frame-border-active',
      '--affine-v2-input-border-active',
      '--affine-text-emphasis-color',
    ]) {
      expect(light[name], `light ${name}`).toBeDefined();
      expect(dark[name], `dark ${name}`).toBeDefined();
    }
    // Light-only tokens (upstream does not restate them in the dark block).
    expect(light['--affine-active-shadow']).toBeDefined();
    expect(light['--affine-blue']).toBeDefined();
  });

  test('touches nothing that a document can store', () => {
    // The Untouched Data Rule: element colours are stored on the model and
    // resolved through `model/themes/utils.ts`, not through here — but the
    // palette variables share the `--affine-*` namespace, so pin that none of
    // them is in range of the rewrite.
    for (const vars of [accentVariables(false), accentVariables(true)]) {
      const palette = Object.keys(vars).filter(name =>
        name.startsWith('--affine-palette')
      );
      expect(palette).toEqual([]);
    }
  });

  test('is derived, not hand-listed: every entry really carried the accent', () => {
    const [r, g, b] = channels(BORROWED_LIGHT);
    const [dr, dg, db] = channels(BORROWED_DARK);
    const carries = (value: string) =>
      value.toLowerCase().includes(BORROWED_LIGHT.toLowerCase()) ||
      value.toLowerCase().includes(BORROWED_DARK.toLowerCase()) ||
      value.includes(`${r}, ${g}, ${b}`) ||
      value.includes(`${dr}, ${dg}, ${db}`);

    for (const dark of [false, true]) {
      const source = dark ? DARK : LIGHT;
      for (const name of Object.keys(accentVariables(dark))) {
        expect(carries(source[name]!), `${name} = ${source[name]}`).toBe(true);
      }
    }
  });
});

describe('accentStyleSheetText', () => {
  const css = accentStyleSheetText();

  test('mirrors the selectors upstream uses for the same variables', () => {
    // `[data-theme]` as well as `:root`: the playground, and any host that
    // scopes the theme per editor, puts `data-theme` on a DIV below <html>,
    // where upstream re-declares the whole set.
    expect(css).toContain(":root,\n[data-theme='light'] {");
    expect(css).toContain("[data-theme='dark'] {");
  });

  test('states the accent and never the one it replaces', () => {
    expect(css).toContain(`--affine-primary-color: ${LABRE_ACCENT};`);
    expect(css.toLowerCase()).not.toContain(BORROWED_LIGHT.toLowerCase());
    expect(css.toLowerCase()).not.toContain(BORROWED_DARK.toLowerCase());
    expect(css).not.toContain(channels(BORROWED_LIGHT).join(', '));
    expect(css).not.toContain(channels(BORROWED_DARK).join(', '));
  });

  test('a host accent produces a sheet stating that accent instead', () => {
    const host = accentStyleSheetText('#7c3aed');
    expect(host).toContain('--affine-primary-color: #7c3aed;');
    expect(host).not.toContain(LABRE_ACCENT);
  });
});
