import { InlineDeltaToMarkdownAdapterExtension } from '@labre/affine-shared/adapters';
import { isSafeLinkUrl } from '@labre/affine-shared/utils';
import type { PhrasingContent } from 'mdast';

export const linkDeltaToMarkdownAdapterMatcher =
  InlineDeltaToMarkdownAdapterExtension({
    name: 'link',
    match: delta => !!delta.attributes?.link,
    toAST: (delta, context) => {
      const mdast: PhrasingContent = {
        type: 'text',
        value: delta.insert,
      };
      const link = delta.attributes?.link;
      // A stored link with a refused scheme (an older document, a paste) is
      // written as its text alone, never re-emitted as a link.
      if (!link || !isSafeLinkUrl(link)) {
        return mdast;
      }

      const { current: currentMdast } = context;
      if ('value' in currentMdast) {
        if (currentMdast.value === '') {
          return {
            type: 'text',
            value: link,
          };
        }
        if (mdast.value !== link) {
          return {
            type: 'link',
            url: link,
            children: [currentMdast],
          };
        }
      }
      return mdast;
    },
  });
