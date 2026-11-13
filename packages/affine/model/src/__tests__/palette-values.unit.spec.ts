/// <reference types="vite/client" />
import {
  type AffineThemeKeyV2,
  darkThemeV2,
  lightThemeV2,
} from '@toeverything/theme/v2';
import { describe, expect, test } from 'vitest';

import { DefaultTheme } from '../themes/default.js';
import { PALETTE_VALUES } from '../themes/palette-values.js';
import { getColorByKey, pureBlack, pureWhite } from '../themes/utils.js';

/**
 * PARITY — the library's copy of the AFFiNE palette is the palette
 * `@toeverything/theme/v2` ships (ADR 0045, amendment of 2026-11-12).
 *
 * Why the copy exists: `themes/default.ts` is in the graph of every
 * editor-free entry (`@labre/affine-model/headless`, the `./interchange`
 * builders, the mind map's among them), and those entries load `zod` and
 * `@labre/global` only (`interchange-headless.unit.spec.ts`). So the theme
 * reads its colours from `palette-values.ts`, not from the package.
 *
 * What this spec catches: a bump of `@toeverything/theme` that changes one of
 * these colours. They are written into documents (a shape's fill, a note's
 * background, a mind map node's stroke), so a silent change would make the
 * editor write a colour the copy no longer agrees with. Decide then whether
 * the stored colour moves (update the copy) or stays (keep it); either way,
 * this spec makes it a decision. It also catches a key `default.ts` starts
 * reading without a value here, and a value nobody reads any more.
 */
const fromPackage = (key: AffineThemeKeyV2) => {
  const dark = darkThemeV2[key];
  const light = lightThemeV2[key];
  return dark === light ? dark : { dark, light };
};

const keys = Object.keys(PALETTE_VALUES) as (keyof typeof PALETTE_VALUES)[];

describe('the palette copy', () => {
  test.each(keys)('%s is the package’s value', key => {
    expect(PALETTE_VALUES[key]).toEqual(fromPackage(key));
    expect(getColorByKey(key)).toEqual(fromPackage(key));
  });

  test('pure black and white are the light palette’s', () => {
    expect(pureBlack).toBe(lightThemeV2['edgeless/palette/black']);
    expect(pureWhite).toBe(lightThemeV2['edgeless/palette/white']);
  });

  test('holds exactly the keys the theme reads', () => {
    // Read as text (table-writing-width.unit.spec.ts does the same).
    const source =
      Object.values(
        import.meta.glob<string>('../themes/default.ts', {
          query: '?raw',
          import: 'default',
          eager: true,
        })
      )[0] ?? '';
    expect(source).not.toBe('');
    // A literal key passed to getColorByKey: matches
    // `getColorByKey('edgeless/note/red')`, not `getColorByKey(key)`.
    const read = new Set(
      [...source.matchAll(/getColorByKey\('([^']+)'\)/g)].map(m => m[1])
    );
    // `pureBlack` and `pureWhite` read these two (`utils.ts`).
    read.add('edgeless/palette/black');
    read.add('edgeless/palette/white');
    expect([...read].sort()).toEqual([...keys].sort());
  });

  test('the default theme reads its colours from the copy', () => {
    expect(DefaultTheme.black).toEqual(fromPackage('edgeless/palette/black'));
    expect(DefaultTheme.white).toEqual(fromPackage('edgeless/palette/white'));
    expect(DefaultTheme.NoteBackgroundColorMap.Yellow).toEqual(
      fromPackage('edgeless/note/yellow')
    );
  });
});
