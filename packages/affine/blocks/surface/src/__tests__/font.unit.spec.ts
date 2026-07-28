import { describe, expect, test } from 'vitest';

import { isSameFontFamily, wrapFontFamily } from '../utils/font.js';

// Surface fonts are registered under a namespaced family name.
const FAMILY = 'blocksuite:surface:Inter';

const fontFace = (family: string) => ({ family }) as FontFace;

describe('isSameFontFamily', () => {
  // The registered `FontFace.family` keeps the quotes `wrapFontFamily` adds,
  // while models store the family unquoted. Matching used to branch on
  // `IS_FIREFOX`, so every other browser matched nothing and the font style
  // menu rendered empty.
  test('matches a quoted font face against the unquoted family stored on models', () => {
    expect(isSameFontFamily(FAMILY)(fontFace(wrapFontFamily(FAMILY)))).toBe(
      true
    );
  });

  test('matches regardless of which side carries the quotes', () => {
    expect(isSameFontFamily(FAMILY)(fontFace(FAMILY))).toBe(true);
    expect(isSameFontFamily(wrapFontFamily(FAMILY))(fontFace(FAMILY))).toBe(
      true
    );
    expect(
      isSameFontFamily(wrapFontFamily(FAMILY))(fontFace(wrapFontFamily(FAMILY)))
    ).toBe(true);
  });

  test('still discriminates different families', () => {
    expect(isSameFontFamily(FAMILY)(fontFace('"Inter"'))).toBe(false);
    expect(isSameFontFamily(FAMILY)(fontFace('Kalam'))).toBe(false);
  });
});
