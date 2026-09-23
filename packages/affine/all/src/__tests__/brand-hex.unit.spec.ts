import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { allSourceFiles, toRepoRelative } from './translations/source-files.js';

/**
 * The brand-hex ratchet: no module of the library may spell the chrome accent
 * out as a literal.
 *
 * `DESIGN.md`'s **Borrowed Blue Rule** says the accent `#1E96EB` is AFFiNE's,
 * not Labre's, and is due to be replaced — so it has to be reached through a
 * token (`var(--affine-primary-color)`, `cssVarV2(…)`) or, on the canvas,
 * resolved through `ThemeService` (`getChromeAccentColor`). A literal breaks
 * that: a host that redefines `--affine-primary-color` repaints the DOM and
 * leaves every literal behind, and the re-skin stops being a token change.
 *
 * **This spec would have caught the 42 literals of the J audit** (2026-09-23):
 * 51 lines / 61 occurrences across 24 packages, of which 42 had no token in
 * front of them — the two canvas `ctx.strokeStyle` sites (the selection
 * marquee and the frame outline), ~10 focus rings, ~8 inline SVG icons, five
 * tooltip illustrations, the direction chip's `EDGE_DIRECTION_COLOR`, the
 * mindmap drag indicator, the template spinner, and the HTML export
 * stylesheet. It would also have caught the two variable-name bugs the same
 * audit found, because both left the hex as the value that actually won:
 * `var(--affine—primary—color, …)` (em dashes) and
 * `var(--light-brand-color, …)` (a variable that exists nowhere).
 *
 * ## Scope
 *
 * Every shipped `.ts` file under `packages/affine` and `packages/framework`,
 * via the same walker the i18n guards use (`translations/source-files.ts`) —
 * so tests, benches, stories, declarations, `dist` and `node_modules` are out,
 * and this spec cannot match itself. Nothing here needs the theme package:
 * the library declares only variable NAMES, never colour values, so there is
 * no theme-definition file to exclude.
 *
 * Non-chrome blues are deliberately NOT matched: the canvas palette's medium
 * blue (`#84CFFF`), the C4 ladder, the EDGY hues and every other notation
 * colour are content under The Standard-Fidelity Rule and must stay literal.
 */

/**
 * The AFFiNE accent in every spelling the audit found, plus the dark-theme
 * variant of `--affine-primary-color` (`#1C9EE4`) — a literal copy of that one
 * would be the same mistake wearing a different hex. Case-insensitive.
 *
 * The optional `[0-9a-f]{2}` tail catches the 8-digit alpha form (`#1E96EB14`,
 * the selection marquee's fill), and the trailing `\b` keeps a LONGER hex that
 * merely starts with the same digits out. The `rgb`/`rgba` forms tolerate the
 * optional space after each comma that `prettier` and hand-written CSS
 * disagree about.
 */
const BRAND_HEX =
  /#1e96eb(?:[0-9a-f]{2})?\b|#1c9ee4(?:[0-9a-f]{2})?\b|rgba?\(\s*30\s*,\s*150\s*,\s*235\s*[,)]/gi;

/**
 * The one place the literal is still correct, and why.
 *
 * `blocks/root/src/adapters/html.ts` builds a STANDALONE HTML document
 * (`<html><head><style>…`) for the "export as HTML" action. Nothing in that
 * file loads `@toeverything/theme/style.css`, so `--affine-primary-color` is
 * undefined wherever the export is opened; the hex is the CSS fallback of the
 * token (`var(--affine-primary-color, rgb(30, 150, 235))`) and is what the
 * checkbox actually paints with. Dropping it would ship a colourless export.
 *
 * This is the "recognising, not styling" shape of rule R33 (The Untouched Data
 * Rule): the value has to survive outside the editor, so it cannot be a
 * reference. Each entry is a repo-relative path plus the exact number of
 * occurrences allowed, so a NEW literal in an allowed file still fails.
 */
const ALLOWED: ReadonlyMap<string, number> = new Map([
  ['packages/affine/blocks/root/src/adapters/html.ts', 2],
]);

describe('brand hex guard', () => {
  test('the detector matches every spelling of the accent, and no notation hue', () => {
    const match = (src: string) => src.match(BRAND_HEX) ?? [];

    expect(match(`color: '#1e96eb'`)).toHaveLength(1);
    expect(match(`fill="#1E96EB"`)).toHaveLength(1);
    expect(match(`'#1E96EB14'`)).toHaveLength(1);
    expect(match(`'#1C9EE4'`)).toHaveLength(1);
    expect(match(`background: rgb(30, 150, 235);`)).toHaveLength(1);
    expect(match(`rgba(30,150,235,0.3)`)).toHaveLength(1);
    expect(match(`rgba(30, 150, 235, 0.35)`)).toHaveLength(1);
    // The two bugs the J audit found: the hex is what actually painted.
    expect(match(`var(--affine—primary—color, #1e96eb)`)).toHaveLength(1);
    expect(match(`var(--light-brand-color, #1e96eb)`)).toHaveLength(1);

    // Notation content, which must stay literal.
    expect(match(`'#84CFFF'`)).toHaveLength(0);
    expect(match(`'#438DD5'`)).toHaveLength(0);
    expect(match(`'#1168BD'`)).toHaveLength(0);
    expect(match(`'#1E67AF'`)).toHaveLength(0);
    // A longer hex that merely starts with the accent's digits.
    expect(match(`'#1e96ebff00'`)).toHaveLength(0);
    // Another colour that happens to share two of the three channels.
    expect(match(`rgb(30, 150, 200)`)).toHaveLength(0);
  });

  test('no module spells the chrome accent out as a literal', () => {
    const files = allSourceFiles();
    expect(files.length).toBeGreaterThan(100);

    const offenders: string[] = [];
    for (const file of files) {
      const relative = toRepoRelative(file);
      const hits = readFileSync(file, 'utf8').match(BRAND_HEX) ?? [];
      const allowed = ALLOWED.get(relative) ?? 0;
      for (let i = allowed; i < hits.length; i++) {
        offenders.push(`${relative}: ${hits[i]}`);
      }
    }

    expect(
      offenders.sort(),
      'The chrome accent was written out as a literal. Reach it through a ' +
        'token instead — `var(--affine-primary-color)` / `cssVarV2(…)` in ' +
        'CSS and inline SVG, `getChromeAccentColor(std)` on the canvas — so ' +
        'a host re-skin stays a token change (DESIGN.md, The Borrowed Blue ' +
        'Rule). A literal is only ever right where the value has to survive ' +
        'outside the editor; see `ALLOWED` in this spec.'
    ).toEqual([]);
    // The 90s ceiling below is the one `literals.unit.spec.ts` uses, for the
    // same reason: this walks the whole library source, and in the
    // workspace-wide run every other package's workers compete for the disk
    // (2.9s on its own, over 30s under `yarn test:unit`).
  }, 90_000);
});
