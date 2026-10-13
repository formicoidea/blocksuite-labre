import { describe, expect, it } from 'vitest';

import { DocTitle } from '../doc-title';

/**
 * The page title's family is a host's to set, and only the title's (labre
 * ADR-0049 §5: the Labre app sets Cabinet Grotesk, headings stay in Inter).
 *
 * The title used to read `--affine-font-family` directly, so a host could
 * only change it by overriding the body family of the whole editor, or by
 * reaching into the editor's chrome with its own CSS. The variable keeps
 * DESIGN.md's One Family Rule for every host that does not set it: unset, it
 * falls back to the body family.
 */
describe('the page title font', () => {
  it('reads --labre-doc-title-font-family, falling back to the body family', () => {
    const css = [DocTitle.styles]
      .flat()
      .map(style => ('cssText' in style ? style.cssText : ''))
      .join('\n')
      .replace(/\s+/g, '');
    expect(css).toContain(
      'font-family:var(--labre-doc-title-font-family,var(--affine-font-family))'
    );
  });
});
