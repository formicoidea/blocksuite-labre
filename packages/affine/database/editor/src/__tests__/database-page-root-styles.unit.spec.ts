/**
 * GUARD — a database's full page is one scroller with its heading on the
 * view bar (ADR 0035 amendment of 2026-10-26), and the database's own look
 * on that page is the block's, not this root's (amendment of 2026-10-28).
 *
 * What it would have caught (labre recette, 2026-10-26): the host wrapped
 * the title and the page in a viewport of its own around the page's, and a
 * long table showed two vertical scrollbars; the title's 38px bottom padding
 * stood between the name and the view bar. The page also keeps the page
 * root's narrow side padding on a phone.
 *
 * And the root reaching into the block again (2026-10-28): the hidden title
 * row (an `!important` rule fighting the row's emotion class, P7,
 * 2026-10-16), the block's top margin, the table's wrappers and its sticky
 * column header were rules of this root, so a page mounted without a
 * heading lost the database's name and a board inherited a table's rules.
 * The block now derives them from where it is drawn (`data-standalone`,
 * `data-page-layout`); this root only widens with such a table.
 *
 * And its gutters (labre recette of 2.0): a widened root sized in the content
 * box overflowed by both paddings, so every page showed a sideways
 * scrollbar; a phone's fixed 24px left the sticky view bar at the host's
 * wider gutter; a wide table was cut at the page's edges.
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
  });

  test('keeps its heading in view sideways, and widens with a page table', () => {
    expect(cssOf(DatabasePageHost.styles)).toMatch(
      /affine-database-page > \.affine-page-viewport > doc-title \{ position: sticky; left: 0; width: 100cqw; \}/
    );
    expect(cssOf(DatabasePageRoot.styles)).toMatch(
      /affine-database-page-root:has\(dv-table-view-ui\[data-page-layout\]\) \{ width: max-content; min-width: 100%; [^}]*box-sizing: border-box;/
    );
  });

  // Widened, the root lost its centring and the view bar and the rows
  // started left of the centred heading: it now pads by the heading's
  // centring inset, which the block's sticky view bar reads too (labre
  // recette of 1.1; held in a browser by database-view-bar-alignment.spec).
  test('keeps a widened page under its centred heading', () => {
    const root = cssOf(DatabasePageRoot.styles);
    expect(root).toContain(
      '--affine-database-page-inset: max( 0px, calc((100cqw - var(--affine-editor-width, 100cqw)) / 2) );'
    );
    expect(root).toContain(
      'padding-left: calc( var(--affine-database-page-inset) + var(--affine-editor-side-padding, 24px) );'
    );
  });

  test('leaves the database block and its table to themselves', () => {
    const root = cssOf(DatabasePageRoot.styles);
    expect(root).not.toContain('affine-database-title');
    // The table's classes (`.dv-table-wrapper`, `.dv-table-scroll-container`);
    // `dv-table-view-ui[data-page-layout]` above is the one read it keeps.
    expect(root).not.toContain('.dv-table-');
    expect(root).not.toContain('affine-database[');
    expect(root).not.toContain('affine-database-column-header');
    expect(root).not.toContain('!important');
  });

  test('narrows its side padding in a narrow viewport container', () => {
    expect(cssOf(DatabasePageRoot.styles)).toMatch(
      /@container viewport \(width <= 640px\) \{ affine-database-page-root \{ --affine-editor-side-padding: 24px; \} \}/
    );
    expect(cssOf(DatabasePageHost.styles)).toContain(
      'container-name: viewport'
    );
  });

  test('fades a wide table into its gutters, its scrollbars kept', () => {
    const host = cssOf(DatabasePageHost.styles);
    expect(host).toContain(
      '--affine-database-page-fade: min( var(--affine-editor-side-padding, 24px), 24px );'
    );
    expect(host).toMatch(
      /mask: linear-gradient\( to right, transparent, #000 var\(--affine-database-page-fade\), #000 calc\(100% - var\(--affine-database-page-fade\)\), transparent \) padding-box add, linear-gradient\(#000 0 0\) border-box exclude, linear-gradient\(#000 0 0\) padding-box;/
    );
  });
});
