import type { IframeOptions } from '@labre/affine-shared/services';
import type { StyleInfo } from '@labre/global/lit';

/**
 * The provider's iframe style as one value per property, for `styleMap`.
 *
 * A `style` attribute whose text is built at runtime is dropped whole by a
 * host page without `style-src-attr` (the read-only viewer on Labre Sites,
 * #668): the rounded corners went with it. `styleMap` sets each property
 * through the CSSOM, which no policy refuses. A host config may still give a
 * string (`IframeOptions.style` only widened), so it is split into its
 * declarations here; a declaration without a name or a value is skipped.
 */
export function iframeStyleInfo(
  style: IframeOptions['style']
): Readonly<StyleInfo> {
  if (typeof style !== 'string') return style ?? {};
  return Object.fromEntries(
    style.split(';').flatMap(declaration => {
      const colon = declaration.indexOf(':');
      if (colon < 0) return [];
      const name = declaration.slice(0, colon).trim();
      const value = declaration.slice(colon + 1).trim();
      return name !== '' && value !== '' ? [[name, value] as const] : [];
    })
  );
}
