import { EdgelessTextBlockSchema } from '@labre/affine-model';
import {
  BlockHtmlAdapterExtension,
  type BlockHtmlAdapterMatcher,
} from '@labre/affine-shared/adapters';

export const edgelessTextBlockHtmlAdapterMatcher: BlockHtmlAdapterMatcher = {
  flavour: EdgelessTextBlockSchema.model.flavour,
  toMatch: () => false,
  fromMatch: o => o.node.flavour === EdgelessTextBlockSchema.model.flavour,
  toBlockSnapshot: {},
  fromBlockSnapshot: {
    enter: (_, context) => {
      context.walkerContext.openNode(
        {
          type: 'element',
          tagName: 'div',
          properties: { className: ['affine-edgeless-text'] },
          children: [],
        },
        'children'
      );
    },
    leave: (_, context) => {
      context.walkerContext.closeNode();
    },
  },
};

export const EdgelessTextBlockHtmlAdapterExtension = BlockHtmlAdapterExtension(
  edgelessTextBlockHtmlAdapterMatcher
);
