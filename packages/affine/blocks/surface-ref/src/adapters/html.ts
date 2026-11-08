import { SurfaceRefBlockSchema } from '@labre/affine-model';
import {
  BlockHtmlAdapterExtension,
  type BlockHtmlAdapterMatcher,
} from '@labre/affine-shared/adapters';
import type { BlockSnapshot, DeltaInsert, NodeProps } from '@labre/store';

const REFERENCE_TYPES: Record<string, string> = {
  'affine:frame': 'frame',
  group: 'group',
};

/**
 * The name of what the reference points at, read from the surface of the same
 * page: a frame block's `title`, or a group element's `title`. Nothing when the
 * block prints alone or the target is gone.
 */
const rootOf = (o: NodeProps<BlockSnapshot>): NodeProps<BlockSnapshot> =>
  o.parent ? rootOf(o.parent) : o;

function titleOf(o: NodeProps<BlockSnapshot>, reference: string): string {
  const surface = rootOf(o).node.children.find(
    child => child.flavour === 'affine:surface'
  );
  if (!surface) return '';
  const frame = surface.children.find(child => child.id === reference);
  if (frame) {
    const title = frame.props.title as { delta?: DeltaInsert[] } | undefined;
    return (title?.delta ?? []).map(delta => delta.insert).join('');
  }
  const elements = surface.props.elements as
    | Record<string, { title?: unknown }>
    | undefined;
  const title = elements?.[reference]?.title;
  return typeof title === 'string' ? title : '';
}

/**
 * The drawing lives on the canvas, which HTML does not paint: this prints the
 * place a host mounts a viewer on (`data-labre-surface-ref`, the attribute
 * ADR 0050 names, and `data-labre-surface-ref-type`), with the frame's or
 * group's title and the caption for a reader who gets no viewer.
 */
export const surfaceRefBlockHtmlAdapterMatcher: BlockHtmlAdapterMatcher = {
  flavour: SurfaceRefBlockSchema.model.flavour,
  toMatch: () => false,
  fromMatch: o => o.node.flavour === SurfaceRefBlockSchema.model.flavour,
  toBlockSnapshot: {},
  fromBlockSnapshot: {
    enter: (o, context) => {
      const { caption, reference, refFlavour } = o.node.props;
      const id = String(reference ?? '');
      const type =
        typeof refFlavour === 'string'
          ? REFERENCE_TYPES[refFlavour]
          : undefined;
      const texts: [string, string][] = [
        ['affine-surface-ref-title', titleOf(o, id)],
        [
          'affine-surface-ref-caption',
          typeof caption === 'string' ? caption : '',
        ],
      ];
      context.walkerContext
        .openNode(
          {
            type: 'element',
            tagName: 'div',
            properties: {
              className: ['affine-surface-ref'],
              dataLabreSurfaceRef: id,
              ...(type ? { dataLabreSurfaceRefType: type } : {}),
            },
            children: texts
              .filter(([, value]) => value)
              .map(([className, value]) => ({
                type: 'element',
                tagName: 'span',
                properties: { className: [className] },
                children: [{ type: 'text', value }],
              })),
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
