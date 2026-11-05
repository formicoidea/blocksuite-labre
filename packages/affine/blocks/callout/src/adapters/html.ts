import { CalloutBlockSchema } from '@labre/affine-model';
import {
  BlockHtmlAdapterExtension,
  type BlockHtmlAdapterMatcher,
} from '@labre/affine-shared/adapters';
import type { DeltaInsert } from '@labre/store';

export const calloutBlockHtmlAdapterMatcher: BlockHtmlAdapterMatcher = {
  flavour: CalloutBlockSchema.model.flavour,
  toMatch: () => false,
  fromMatch: o => o.node.flavour === CalloutBlockSchema.model.flavour,
  toBlockSnapshot: {},
  fromBlockSnapshot: {
    enter: (o, context) => {
      const { deltaConverter, walkerContext } = context;
      const text = o.node.props.text as { delta: DeltaInsert[] } | undefined;
      walkerContext.openNode(
        {
          type: 'element',
          tagName: 'aside',
          properties: { className: ['affine-callout'] },
          children: [
            {
              type: 'element',
              tagName: 'span',
              properties: { className: ['affine-callout-icon'] },
              children: [{ type: 'text', value: String(o.node.props.emoji) }],
            },
            ...deltaConverter.deltaToAST(text?.delta ?? []),
          ],
        },
        'children'
      );
    },
    leave: (_, context) => {
      context.walkerContext.closeNode();
    },
  },
};

export const CalloutBlockHtmlAdapterExtension = BlockHtmlAdapterExtension(
  calloutBlockHtmlAdapterMatcher
);
