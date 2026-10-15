import type { InlineHtmlAST } from '@labre/affine-shared/adapters';
import { InlineDeltaToHtmlAdapterExtension } from '@labre/affine-shared/adapters';
import { isSafeLinkUrl } from '@labre/affine-shared/utils';

export const linkDeltaToHtmlAdapterMatcher = InlineDeltaToHtmlAdapterExtension({
  name: 'link',
  match: delta => !!delta.attributes?.link,
  toAST: (delta, _) => {
    const hast: InlineHtmlAST = {
      type: 'text',
      value: delta.insert,
    };
    const link = delta.attributes?.link;
    // A stored link with a refused scheme is written as its text alone.
    if (!link || !isSafeLinkUrl(link)) {
      return hast;
    }
    return {
      type: 'element',
      tagName: 'a',
      properties: {
        href: link,
      },
      children: [hast],
    };
  },
});
