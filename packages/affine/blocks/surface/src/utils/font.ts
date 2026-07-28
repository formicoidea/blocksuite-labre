import type { FontFamily } from '@labre/affine-model';
import { IS_FIREFOX } from '@labre/global/env';

export function wrapFontFamily(fontFamily: FontFamily | string): string {
  return `"${fontFamily}"`;
}

export const getFontFaces = IS_FIREFOX
  ? () => {
      const keys = document.fonts.keys();
      const fonts = [];
      let done = false;
      while (!done) {
        const item = keys.next();
        done = !!item.done;
        if (item.value) {
          fonts.push(item.value);
        }
      }
      return fonts;
    }
  : () => [...document.fonts.keys()];

/**
 * Surface fonts are registered with quoted family names (see `wrapFontFamily`),
 * while models store them unquoted (`blocksuite:surface:Inter`). Browsers do not
 * agree on whether `FontFace.family` echoes those quotes back, so compare
 * unquoted on both sides instead of branching on the engine — a mismatch makes
 * `getFontFacesByFontFamily` return nothing and renders an empty font style menu.
 */
const unquoteFontFamily = (fontFamily: string) =>
  fontFamily.replace(/^\s*["']|["']\s*$/g, '');

export const isSameFontFamily =
  (fontFamily: FontFamily | string) => (fontFace: FontFace) =>
    unquoteFontFamily(fontFace.family) === unquoteFontFamily(fontFamily);

export function getFontFacesByFontFamily(
  fontFamily: FontFamily | string
): FontFace[] {
  return (
    getFontFaces()
      .filter(isSameFontFamily(fontFamily))
      // remove duplicate font faces
      .filter(
        (item, index, arr) =>
          arr.findIndex(
            fontFace =>
              fontFace.family === item.family &&
              fontFace.weight === item.weight &&
              fontFace.style === item.style
          ) === index
      )
  );
}
