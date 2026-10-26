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
 *
 * And the page is one scroller with its heading on the view bar (ADR 0035
 * amendment of 2026-10-26). What it would have caught (labre recette,
 * 2026-10-26): the host wrapped the title and the page in a viewport of its
 * own around the page's, and a long table showed two vertical scrollbars;
 * the title's 38px bottom padding and the block's 8px top margin and padding
 * stood between the name and the view bar. Then the column header, put back
 * by script on each scroll of a table that scrolled sideways itself, jumped
 * while the page scrolled: the page now scrolls both ways and the header
 * sticks natively.
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

  test('renders its heading first in its own viewport, before the editor', async () => {
    if (!customElements.get('affine-database-page')) {
      customElements.define('affine-database-page', DatabasePageHost);
    }
    const page = document.createElement('affine-database-page');
    const heading = document.createElement('doc-title');
    page.heading = heading;
    document.body.append(page);
    await page.updateComplete;
    const viewport = page.querySelector(':scope > .affine-page-viewport');
    expect(viewport?.firstElementChild).toBe(heading);
    page.remove();
  });

  test('is its only scroller, its heading on the view bar', () => {
    const host = cssOf(DatabasePageHost.styles);
    expect(host).toMatch(
      /affine-database-page > \.affine-page-viewport \{ display: flex; flex-direction: column; height: 100%; overflow: auto;/
    );
    expect(host).toMatch(
      /affine-database-page > \.affine-page-viewport > editor-host \{ flex: 1 0 auto; height: auto; \}/
    );
    expect(host).toMatch(
      /affine-database-page > \.affine-page-viewport > doc-title \.doc-title-container, affine-database-page > \.affine-page-viewport > doc-title \.doc-title-band \{ padding-bottom: 0; \}/
    );
    expect(cssOf(DatabasePageRoot.styles)).toMatch(
      /affine-database-page-root affine-database\[data-block-id\] \{ margin-top: 0; padding-top: 0; \}/
    );
  });

  test('scrolls sideways as a page, its column header natively sticky', () => {
    const host = cssOf(DatabasePageHost.styles);
    const root = cssOf(DatabasePageRoot.styles);
    expect(host).toMatch(
      /affine-database-page > \.affine-page-viewport > doc-title \{ position: sticky; left: 0; width: 100cqw; \}/
    );
    expect(root).toMatch(
      /affine-database-page-root:has\(dv-table-view-ui\) \{ width: max-content; min-width: 100%; \}/
    );
    expect(root).toMatch(
      /affine-database-page-root \.dv-table-wrapper, affine-database-page-root \.dv-table-scroll-container \{ overflow: visible; \}/
    );
    expect(root).toMatch(
      /affine-database-page-root affine-database-column-header \{ position: sticky; top: 0; \}/
    );
    expect(root).toMatch(
      /affine-database-page-root div:has\(> div > affine-database-title\) \{ position: sticky; left: var\(--affine-editor-side-padding, 24px\);/
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
