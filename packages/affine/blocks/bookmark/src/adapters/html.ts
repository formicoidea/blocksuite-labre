import { BookmarkBlockSchema } from '@labre/affine-model';
import {
  BlockHtmlAdapterExtension,
  type BlockHtmlAdapterMatcher,
} from '@labre/affine-shared/adapters';
import { isSafeLinkUrl } from '@labre/affine-shared/utils';

const span = (className: string, value: string) => ({
  type: 'element' as const,
  tagName: 'span',
  properties: { className: [className] },
  children: [{ type: 'text' as const, value }],
});

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

/**
 * A bookmark prints as a link card from what the document stores: the title,
 * the description and the favicon the editor fetched when the link was added.
 * Nothing is fetched at print time. A refused scheme keeps the card and loses
 * the `href`, as every other link does.
 */
export const bookmarkBlockHtmlAdapterMatcher: BlockHtmlAdapterMatcher = {
  flavour: BookmarkBlockSchema.model.flavour,
  toMatch: () => false,
  fromMatch: o => o.node.flavour === BookmarkBlockSchema.model.flavour,
  toBlockSnapshot: {},
  fromBlockSnapshot: {
    enter: (o, context) => {
      const { url, title, description } = o.node.props;
      const icon = o.node.props.icon as string | null | undefined;
      const href = typeof url === 'string' ? url : '';
      const children: ReturnType<typeof span>[] = [
        span(
          'affine-bookmark-title',
          typeof title === 'string' && title ? title : href
        ),
      ];
      if (typeof description === 'string' && description) {
        children.push(span('affine-bookmark-description', description));
      }
      const host = hostOf(href);
      if (host) children.push(span('affine-bookmark-host', host));

      context.walkerContext
        .openNode(
          {
            type: 'element',
            tagName: 'a',
            properties: {
              className: ['affine-bookmark'],
              rel: ['noopener'],
              ...(isSafeLinkUrl(href) ? { href } : {}),
              ...(isSafeLinkUrl(icon) ? { dataIcon: icon } : {}),
            },
            children,
          },
          'children'
        )
        .closeNode();
    },
  },
};

export const BookmarkBlockHtmlAdapterExtension = BlockHtmlAdapterExtension(
  bookmarkBlockHtmlAdapterMatcher
);
