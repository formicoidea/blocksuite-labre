import { SurfaceRefBlockSchema } from '@labre/affine-model';
import {
  BlockHtmlAdapterExtension,
  type BlockHtmlAdapterMatcher,
} from '@labre/affine-shared/adapters';

/**
 * The drawing lives on the canvas, which HTML does not paint: this prints the
 * place a host mounts a viewer on, found by `data-labre-surface-ref`, and the
 * caption for a reader who gets no viewer.
 */
export const surfaceRefBlockHtmlAdapterMatcher: BlockHtmlAdapterMatcher = {
  flavour: SurfaceRefBlockSchema.model.flavour,
  toMatch: () => false,
  fromMatch: o => o.node.flavour === SurfaceRefBlockSchema.model.flavour,
  toBlockSnapshot: {},
  fromBlockSnapshot: {
    enter: (o, context) => {
      const { caption, reference } = o.node.props;
      context.walkerContext
        .openNode(
          {
            type: 'element',
            tagName: 'div',
            properties: {
              className: ['affine-surface-ref'],
              dataLabreSurfaceRef: String(reference ?? ''),
            },
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

export const SurfaceRefBlockHtmlAdapterExtension = BlockHtmlAdapterExtension(
  surfaceRefBlockHtmlAdapterMatcher
);
