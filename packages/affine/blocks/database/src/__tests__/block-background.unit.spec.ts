/**
 * GUARD — the database block paints no background of its own: the page's
 * shows through, as for a note.
 *
 * What it would have caught (product owner, playground in dark mode,
 * 2026-10-28): the block and its content wrapper painted
 * `--affine-background-primary-color`, a card of another black on a page
 * whose background was another token. A host sets the page background; the
 * only opaque surface the block needs is the sticky column header, which
 * data-view paints with the page token.
 */
import { cache } from '@emotion/css';
import { describe, expect, test } from 'vitest';

import {
  databaseBlockStyles,
  databaseContentStyles,
} from '../database-block-styles.js';

const registered = (className: string) => cache.registered[className] ?? '';

describe('the database block styles', () => {
  test('paint no background on the block', () => {
    const css = registered(databaseBlockStyles);
    expect(css).toContain('display:block');
    expect(css).not.toMatch(/background/);
  });

  test('paint no background on the content wrapper', () => {
    const css = registered(databaseContentStyles);
    expect(css).toContain('position:relative');
    expect(css).not.toMatch(/background/);
  });
});
