import { CalloutBlockSchema } from '@labre/affine-model';
import {
  BlockHtmlAdapterExtension,
  type BlockHtmlAdapterMatcher,
} from '@labre/affine-shared/adapters';
import type { DeltaInsert } from '@labre/store';

/**
 * A callout prints as a box a stylesheet can set apart: the emoji in its own
 * span (and on `data-emoji`, for a host that draws it otherwise; neither when
 * there is no emoji), the callout's own line and its child blocks together in
 * a body. A reader with no stylesheet still sees the emoji, then the text.
 */
export const calloutBlockHtmlAdapterMatcher: BlockHtmlAdapterMatcher = {
  flavour: CalloutBlockSchema.model.flavour,
  toMatch: () => false,
  fromMatch: o => o.node.flavour === CalloutBlockSchema.model.flavour,
  toBlockSnapshot: {},
  fromBlockSnapshot: {
    enter: (o, context) => {
      const { deltaConverter, walkerContext } = context;
      const emoji = String(o.node.props.emoji ?? '');
      const text = o.node.props.text as { delta: DeltaInsert[] } | undefined;
      const line = deltaConverter.deltaToAST(text?.delta ?? []);
      walkerContext
        .openNode(
          {
            type: 'element',
            tagName: 'div',
            properties: {
              className: ['affine-callout'],
              ...(emoji ? { dataEmoji: emoji } : {}),
            },
            children: emoji
              ? [
                  {
                    type: 'element',
                    tagName: 'span',
                    properties: { className: ['affine-callout-emoji'] },
                    children: [{ type: 'text', value: emoji }],
                  },
                ]
              : [],
          },
          'children'
        )
        .openNode(
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['affine-callout-body'] },
            children: line.length
              ? [
                  {
                    type: 'element',
                    tagName: 'p',
                    properties: {},
                    children: line,
                  },
                ]
              : [],
          },
          'children'
        );
    },
    leave: (_, context) => {
      context.walkerContext.closeNode().closeNode();
    },
  },
};

export const CalloutBlockHtmlAdapterExtension = BlockHtmlAdapterExtension(
  calloutBlockHtmlAdapterMatcher
);
