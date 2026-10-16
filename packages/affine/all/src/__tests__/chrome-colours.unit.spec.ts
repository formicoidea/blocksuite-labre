import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  HERE,
  ROOT,
  sourceFiles,
  toRepoRelative,
} from './translations/source-files.js';

/**
 * The dark-chrome ratchet: the editor's chrome reaches its colours through
 * theme tokens, so `[data-theme="dark"]` repaints it (ADR 0039).
 *
 * **What it would have caught** (the P7 dark audit, 2026-10-16): the
 * data-view drag bars (`#efeff0`), the colour picker's caption (`#8e8d91`),
 * the menu input's focus ring (the light accent spelled `rgba(28,158,228,.3)`),
 * the scrollbar thumb, the `@` menu's input mask, the auto-connect navigator
 * (a light panel and borders) and the keyboard toolbar's pressed state: each
 * stayed light on a dark editor because no token stood in front of it.
 *
 * ## How it counts
 *
 * A raw colour literal (`#hex`, `rgb(`, `rgba(`) in a shipped file of the
 * library outside the notations (`gfx/*`, whose colours are content under the
 * Standard-Fidelity Rule, and `model`, the file format). A token's fallback
 * (`var(--x, #fff)`, `cssVarV2('x', '#fff')`) is not counted: the token wins
 * wherever the theme is loaded. Comments are not counted.
 *
 * Many of the remaining literals are right (a canvas painter, the HTML export,
 * the colour picker's own light/dark preview, a `color-mix` against black for
 * a hover) and the baseline keeps them per file. It only SHRINKS: a new
 * literal fails, a removed one asks for the baseline to be lowered
 * (`UPDATE_CHROME_COLOURS_BASELINE=1` rewrites it with the lower counts only).
 */

const BASELINE_PATH = join(HERE, '..', 'chrome-colours.baseline.json');

const SCOPE = /^packages\/affine\/(?!gfx\/|model\/)/;

const COMMENTS = /\/\*[\s\S]*?\*\/|(^|[^:'"`\w])\/\/.*$/gm;
const VAR_FALLBACK =
  /\bvar\(\s*--[\w-]+\s*,(?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g;
const V2_FALLBACK =
  /\b(?:unsafe)?[cC][sS][sS]Var(?:V2)?\(\s*(['"`])[^'"`]+\1\s*,\s*(['"`])[^'"`]*\2\s*\)/g;
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/g;

function countChromeColours(source: string): number {
  return (
    source
      .replace(COMMENTS, '$1')
      .replace(VAR_FALLBACK, 'var()')
      .replace(V2_FALLBACK, 'v2()')
      .match(COLOUR)?.length ?? 0
  );
}

function scan(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of sourceFiles(join(ROOT, 'packages/affine'))) {
    const relative = toRepoRelative(file);
    if (!SCOPE.test(relative)) continue;
    const count = countChromeColours(readFileSync(file, 'utf8'));
    if (count) counts[relative] = count;
  }
  return counts;
}

describe('dark chrome guard', () => {
  test('the counter skips token fallbacks and comments', () => {
    expect(countChromeColours(`color: #8e8d91;`)).toBe(1);
    expect(
      countChromeColours(`box-shadow: 0 0 0 2px rgba(28,158,228,.3);`)
    ).toBe(1);
    expect(
      countChromeColours(`color: var(--affine-icon-color, #77757d);`)
    ).toBe(0);
    expect(countChromeColours(`color: var(--a, rgba(0, 0, 0, 0.1));`)).toBe(0);
    expect(countChromeColours(`cssVarV2('icon/primary', '#77757d')`)).toBe(0);
    expect(countChromeColours(`/* was #efeff0 */ // and #c0bfc1`)).toBe(0);
    expect(countChromeColours(`const url = 'https://x.y/#abc';`)).toBe(1);
  });

  test('no new raw colour in the chrome, no stale baseline entry', () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<
      string,
      number
    >;
    const counts = scan();

    const grown = Object.entries(counts)
      .filter(([file, count]) => count > (baseline[file] ?? 0))
      .map(([file, count]) => `${file}: ${baseline[file] ?? 0} -> ${count}`);
    const stale = Object.entries(baseline)
      .filter(([file, allowed]) => (counts[file] ?? 0) < allowed)
      .map(([file, allowed]) => `${file}: ${allowed} -> ${counts[file] ?? 0}`);

    if (stale.length && process.env.UPDATE_CHROME_COLOURS_BASELINE) {
      const lowered = Object.fromEntries(
        Object.keys(baseline)
          .sort()
          .map(file => [file, Math.min(baseline[file]!, counts[file] ?? 0)])
          .filter(([, count]) => count)
      );
      writeFileSync(BASELINE_PATH, JSON.stringify(lowered, null, 2) + '\n');
    }

    expect(
      grown,
      'A raw colour was added to the chrome: it stays light on a dark editor. ' +
        'Use a theme token (`var(--affine-…)`, `cssVarV2(…)`) instead.'
    ).toEqual([]);
    expect(
      stale,
      'Fewer literals than the baseline allows: lower it with ' +
        '`UPDATE_CHROME_COLOURS_BASELINE=1`.'
    ).toEqual([]);
  }, 90_000);
});
