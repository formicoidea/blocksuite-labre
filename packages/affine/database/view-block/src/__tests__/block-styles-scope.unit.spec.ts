/**
 * GUARD — the data-view block styles its own tag, `affine-data-view`, and
 * paints no background.
 *
 * What it would have caught (product owner, playground in dark mode,
 * 2026-10-28): the block's static sheet, a light-DOM one, scoped its rules on
 * `affine-database` (an upstream copy-paste), so it was this block that
 * painted the database block's `--affine-background-primary-color` card, a
 * second black on a page whose background was another token. Neither block
 * paints a background: the page's shows through, as for a note.
 */
import { describe, expect, test } from 'vitest';

import { DataViewBlockComponent } from '../data-view-block.js';

const cssOf = (styles: unknown) =>
  [styles]
    .flat(Infinity)
    .map(s => (s as { cssText?: string }).cssText ?? '')
    .join('\n')
    .replace(/\s+/g, ' ');

describe('the data-view block sheet', () => {
  test('names its own tag, never the database block', () => {
    const css = cssOf(DataViewBlockComponent.styles);
    expect(css).toMatch(/affine-data-view\s*\{/);
    expect(css).not.toMatch(/affine-database\b/);
  });

  test('paints no background on its tag', () => {
    const css = cssOf(DataViewBlockComponent.styles);
    const own = css.match(/affine-data-view\s*\{([^}]*)\}/g) ?? [];
    expect(own.length).toBeGreaterThan(0);
    for (const rule of own) expect(rule).not.toMatch(/background/);
  });
});
