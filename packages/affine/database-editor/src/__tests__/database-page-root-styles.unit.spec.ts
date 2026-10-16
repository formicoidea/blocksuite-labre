/**
 * GUARD — on a database's full page, the database's own title row stays
 * hidden: the page title above it is the database's name (ADR 0035 B13).
 *
 * What it would have caught (P7, 2026-10-16): the hiding rule
 * `affine-database-page-root div:has(> affine-database-title)` has a
 * specificity of three type selectors, and the row it targets carries an
 * emotion class (`display: flex`), which outweighs it. The row « Untitled ⋯ »
 * showed under the page title. The rule is `!important` for that reason.
 * The page also keeps the page root's narrow side padding on a phone.
 */
import { describe, expect, test } from 'vitest';

import { DatabasePageRoot } from '../database-page/database-page-root.js';
import { DatabasePageHost } from '../database-page/database-page.js';

const cssOf = (styles: unknown) =>
  [styles]
    .flat(Infinity)
    .map(s => (s as { cssText?: string }).cssText ?? '')
    .join('\n')
    .replace(/\s+/g, ' ');

describe('the full page of a database', () => {
  test('hides the database title row over its emotion class', () => {
    expect(cssOf(DatabasePageRoot.styles)).toMatch(
      /affine-database-page-root div:has\(> affine-database-title\) \{ display: none !important; \}/
    );
  });

  test('narrows its side padding in a narrow viewport container', () => {
    expect(cssOf(DatabasePageRoot.styles)).toMatch(
      /@container viewport \(width <= 640px\) \{ affine-database-page-root \{ padding-left: 24px; padding-right: 24px; \} \}/
    );
    expect(cssOf(DatabasePageHost.styles)).toContain(
      'container-name: viewport'
    );
  });
});
