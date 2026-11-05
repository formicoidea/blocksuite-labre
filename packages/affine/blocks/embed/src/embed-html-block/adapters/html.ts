import { EmbedHtmlBlockSchema } from '@labre/affine-model';
import {
  BlockHtmlAdapterExtension,
  type BlockHtmlAdapterMatcher,
} from '@labre/affine-shared/adapters';

/**
 * Prints the caption and nothing of the stored `html`, which is foreign markup:
 * never an iframe, never a raw node. The block stores no URL, so there is
 * nothing to link to.
 */
export const embedHtmlBlockHtmlAdapterMatcher: BlockHtmlAdapterMatcher = {
  flavour: EmbedHtmlBlockSchema.model.flavour,
  toMatch: () => false,
  fromMatch: o => o.node.flavour === EmbedHtmlBlockSchema.model.flavour,
  toBlockSnapshot: {},
  fromBlockSnapshot: {
    enter: (o, context) => {
      const { caption } = o.node.props;
      context.walkerContext
        .openNode(
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['affine-embed-html'] },
            children:
              typeof caption === 'string' && caption
                ? [{ type: 'text', value: caption }]
                : [],
          },
          'children'
        )
        .closeNode();
    },
  },
};

export const EmbedHtmlBlockHtmlAdapterExtension = BlockHtmlAdapterExtension(
  embedHtmlBlockHtmlAdapterMatcher
);
