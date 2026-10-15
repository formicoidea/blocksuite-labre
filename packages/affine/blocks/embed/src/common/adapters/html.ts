import type { BlockHtmlAdapterMatcher } from '@labre/affine-shared/adapters';
import { isSafeLinkUrl } from '@labre/affine-shared/utils';

export function createEmbedBlockHtmlAdapterMatcher(
  flavour: string,
  {
    toMatch = () => false,
    fromMatch = o => o.node.flavour === flavour,
    toBlockSnapshot = {},
    fromBlockSnapshot = {
      enter: (o, context) => {
        const { walkerContext } = context;
        // Parse as link
        if (
          typeof o.node.props.title !== 'string' ||
          typeof o.node.props.url !== 'string'
        ) {
          return;
        }

        walkerContext
          .openNode(
            {
              type: 'element',
              tagName: 'div',
              properties: {
                className: ['affine-paragraph-block-container'],
              },
              children: [],
            },
            'children'
          )
          .openNode(
            {
              type: 'element',
              tagName: 'a',
              // A refused scheme keeps the title and loses the href.
              properties: isSafeLinkUrl(o.node.props.url)
                ? { href: o.node.props.url }
                : {},
              children: [
                {
                  type: 'text',
                  value: o.node.props.title,
                },
              ],
            },
            'children'
          )
          .closeNode()
          .closeNode();
      },
    },
  }: {
    toMatch?: BlockHtmlAdapterMatcher['toMatch'];
    fromMatch?: BlockHtmlAdapterMatcher['fromMatch'];
    toBlockSnapshot?: BlockHtmlAdapterMatcher['toBlockSnapshot'];
    fromBlockSnapshot?: BlockHtmlAdapterMatcher['fromBlockSnapshot'];
  } = Object.create(null)
): BlockHtmlAdapterMatcher {
  return {
    flavour,
    toMatch,
    fromMatch,
    toBlockSnapshot,
    fromBlockSnapshot,
  };
}
