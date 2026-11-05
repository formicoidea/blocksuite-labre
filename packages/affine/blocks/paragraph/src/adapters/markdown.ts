import { ParagraphBlockSchema } from '@labre/affine-model';
import {
  BlockMarkdownAdapterExtension,
  type BlockMarkdownAdapterMatcher,
  IN_PARAGRAPH_NODE_CONTEXT_KEY,
  isCalloutNode,
  isImageOnlyParagraph,
  type MarkdownAST,
} from '@labre/affine-shared/adapters';
import type { DeltaInsert } from '@labre/store';
import { nanoid } from '@labre/store';
import type { Heading } from 'mdast';

/**
 * Extend the HeadingData type to include the collapsed property
 */
declare module 'mdast' {
  interface HeadingData {
    collapsed?: boolean;
  }
}

const PARAGRAPH_MDAST_TYPE = new Set(['paragraph', 'heading', 'blockquote']);

const isParagraphMDASTType = (node: MarkdownAST) =>
  PARAGRAPH_MDAST_TYPE.has(node.type);

/**
 * Set while the children of a quote that carries images are walked: the
 * quote paragraph already holds their text, so those paragraphs open no block
 * and only the image matcher writes, after the quote (a quote block cannot
 * hold children).
 */
const IN_IMAGE_QUOTE_CONTEXT_KEY = 'mdast:blockquote:images';

const hasImage = (node: MarkdownAST): boolean =>
  node.type === 'image' ||
  ('children' in node &&
    (node.children as MarkdownAST[]).some(child => hasImage(child)));

/**
 * A quote whose images can be lifted out: paragraphs only (a list or a code
 * block inside the quote is flattened into its text and would be emitted
 * twice if its children were walked), at least one image.
 */
const isQuoteWithImages = (node: MarkdownAST) =>
  node.type === 'blockquote' &&
  node.children.every(child => child.type === 'paragraph') &&
  node.children.some(hasImage);

export const paragraphBlockMarkdownAdapterMatcher: BlockMarkdownAdapterMatcher =
  {
    flavour: ParagraphBlockSchema.model.flavour,
    toMatch: o => isParagraphMDASTType(o.node) && !isCalloutNode(o.node),
    fromMatch: o => o.node.flavour === ParagraphBlockSchema.model.flavour,
    toBlockSnapshot: {
      enter: (o, context) => {
        const { walkerContext, deltaConverter } = context;
        switch (o.node.type) {
          case 'paragraph': {
            // mdast wraps a standalone image (or images split by a line
            // break) in a paragraph; the image matcher emits the block itself,
            // so opening a paragraph here left an empty one above it (#521).
            // Markdown cannot express an empty paragraph: none is lost.
            // ponytail: an image wrapped in a link (`[![a](src)](href)`) keeps
            // the image and drops the href, as it always did: the image block
            // has no link prop. Upgrade: an optional `link` prop on the image
            // model (red zone, ADR first), written here.
            walkerContext.setGlobalContext(IN_PARAGRAPH_NODE_CONTEXT_KEY, true);
            if (
              isImageOnlyParagraph(o.node) ||
              walkerContext.getGlobalContext(IN_IMAGE_QUOTE_CONTEXT_KEY)
            ) {
              return;
            }
            walkerContext
              .openNode(
                {
                  type: 'block',
                  id: nanoid(),
                  flavour: 'affine:paragraph',
                  props: {
                    type: 'text',
                    text: {
                      '$blocksuite:internal:text$': true,
                      delta: deltaConverter.astToDelta(o.node),
                    },
                  },
                  children: [],
                },
                'children'
              )
              .closeNode();
            break;
          }
          case 'heading': {
            const isCollapsed = !!o.node.data?.collapsed;
            walkerContext
              .openNode(
                {
                  type: 'block',
                  id: nanoid(),
                  flavour: 'affine:paragraph',
                  props: {
                    type: `h${o.node.depth}`,
                    collapsed: isCollapsed,
                    text: {
                      '$blocksuite:internal:text$': true,
                      delta: deltaConverter.astToDelta(o.node),
                    },
                  },
                  children: [],
                },
                'children'
              )
              .closeNode();
            break;
          }
          case 'blockquote': {
            if (isCalloutNode(o.node)) {
              return;
            }

            walkerContext
              .openNode(
                {
                  type: 'block',
                  id: nanoid(),
                  flavour: 'affine:paragraph',
                  props: {
                    type: 'quote',
                    text: {
                      '$blocksuite:internal:text$': true,
                      delta: deltaConverter.astToDelta(o.node),
                    },
                  },
                  children: [],
                },
                'children'
              )
              .closeNode();
            // The quote text is flattened above, so its children are skipped,
            // except the images: a quote block holds no children, so they land
            // right after it as siblings instead of being lost.
            // ponytail: a quote mixing images with a list or a code block
            // still drops its images; upgrade: walk such a quote too and teach
            // the list and code matchers the same context key.
            if (isQuoteWithImages(o.node)) {
              walkerContext.setGlobalContext(IN_IMAGE_QUOTE_CONTEXT_KEY, true);
            } else {
              walkerContext.skipAllChildren();
            }
            break;
          }
        }
      },
      leave: (o, context) => {
        const { walkerContext } = context;
        if (o.node.type === 'paragraph') {
          walkerContext.setGlobalContext(IN_PARAGRAPH_NODE_CONTEXT_KEY, false);
        }
        if (o.node.type === 'blockquote') {
          walkerContext.setGlobalContext(IN_IMAGE_QUOTE_CONTEXT_KEY, false);
        }
      },
    },
    fromBlockSnapshot: {
      enter: (o, context) => {
        const { walkerContext, deltaConverter } = context;
        const paragraphDepth = (walkerContext.getGlobalContext(
          'affine:paragraph:depth'
        ) ?? 0) as number;
        const text = (o.node.props.text ?? { delta: [] }) as {
          delta: DeltaInsert[];
        };
        switch (o.node.props.type) {
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6': {
            walkerContext
              .openNode(
                {
                  type: 'heading',
                  depth: parseInt(o.node.props.type[1]) as Heading['depth'],
                  children: deltaConverter.deltaToAST(
                    text.delta,
                    paragraphDepth
                  ),
                },
                'children'
              )
              .closeNode();
            break;
          }
          case 'text': {
            walkerContext
              .openNode(
                {
                  type: 'paragraph',
                  children: deltaConverter.deltaToAST(
                    text.delta,
                    paragraphDepth
                  ),
                },
                'children'
              )
              .closeNode();
            break;
          }
          case 'quote': {
            walkerContext
              .openNode(
                {
                  type: 'blockquote',
                  children: [],
                },
                'children'
              )
              .openNode(
                {
                  type: 'paragraph',
                  children: deltaConverter.deltaToAST(text.delta),
                },
                'children'
              )
              .closeNode()
              .closeNode();
            break;
          }
        }
        walkerContext.setGlobalContext(
          'affine:paragraph:depth',
          paragraphDepth + 1
        );
      },
      leave: (_, context) => {
        const { walkerContext } = context;
        walkerContext.setGlobalContext(
          'affine:paragraph:depth',
          (walkerContext.getGlobalContext('affine:paragraph:depth') as number) -
            1
        );
      },
    },
  };

export const ParagraphBlockMarkdownAdapterExtension =
  BlockMarkdownAdapterExtension(paragraphBlockMarkdownAdapterMatcher);
