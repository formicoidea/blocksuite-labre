import { ListBlockSchema } from '@labre/affine-model';
import {
  AdapterTextUtils,
  BlockMarkdownAdapterExtension,
  type BlockMarkdownAdapterMatcher,
  isImageOnlyParagraph,
  type MarkdownAST,
} from '@labre/affine-shared/adapters';
import type { DeltaInsert } from '@labre/store';
import { nanoid } from '@labre/store';
import type { List } from 'mdast';

import { listStartNumber } from './start-number.js';

const LIST_MDAST_TYPE = new Set(['list', 'listItem']);
const isListMDASTType = (node: MarkdownAST) => LIST_MDAST_TYPE.has(node.type);

export const listBlockMarkdownAdapterMatcher: BlockMarkdownAdapterMatcher = {
  flavour: ListBlockSchema.model.flavour,
  toMatch: o => isListMDASTType(o.node),
  fromMatch: o => o.node.flavour === ListBlockSchema.model.flavour,
  toBlockSnapshot: {
    enter: (o, context) => {
      const { walkerContext, deltaConverter } = context;
      if (o.node.type === 'listItem') {
        const parentList = o.parent?.node as List;
        const listNumber = parentList.start
          ? parentList.start + parentList.children.indexOf(o.node)
          : null;
        // The first paragraph is the item's text and is skipped below. One
        // holding only an image has no text to give: it is walked instead,
        // so the image matcher writes the image as a child of the list block
        // rather than the image being dropped with the skipped paragraph.
        const first = o.node.children[0];
        const textParagraph =
          first && first.type === 'paragraph' && !isImageOnlyParagraph(first)
            ? first
            : null;
        walkerContext.openNode(
          {
            type: 'block',
            id: nanoid(),
            flavour: 'affine:list',
            props: {
              type:
                o.node.checked !== null
                  ? 'todo'
                  : parentList.ordered
                    ? 'numbered'
                    : 'bulleted',
              text: {
                '$blocksuite:internal:text$': true,
                delta: textParagraph
                  ? deltaConverter.astToDelta(textParagraph)
                  : [],
              },
              checked: o.node.checked ?? false,
              collapsed: false,
              order: listNumber,
            },
            children: [],
          },
          'children'
        );
        if (textParagraph) {
          walkerContext.skipChildren(1);
        }
      }
    },
    leave: (o, context) => {
      const { walkerContext } = context;
      if (o.node.type === 'listItem') {
        walkerContext.closeNode();
      }
    },
  },
  fromBlockSnapshot: {
    enter: (o, context) => {
      const { walkerContext, deltaConverter } = context;
      const text = (o.node.props.text ?? { delta: [] }) as {
        delta: DeltaInsert[];
      };
      const currentTNode = walkerContext.currentNode();
      // check if the list is of the same type
      if (
        walkerContext.getNodeContext('affine:list:parent') === o.parent &&
        currentTNode.type === 'list' &&
        currentTNode.ordered === (o.node.props.type === 'numbered') &&
        AdapterTextUtils.isNullish(currentTNode.children[0].checked) ===
          AdapterTextUtils.isNullish(
            o.node.props.type === 'todo'
              ? (o.node.props.checked as boolean)
              : undefined
          )
      ) {
        // if true, add the list item to the list
      } else {
        // if false, create a new list
        const start = listStartNumber(o.node.props);
        walkerContext
          .openNode(
            {
              type: 'list',
              ordered: o.node.props.type === 'numbered',
              spread: false,
              children: [],
              ...(start === undefined ? {} : { start }),
            },
            'children'
          )
          .setNodeContext('affine:list:parent', o.parent);
      }
      walkerContext
        .openNode(
          {
            type: 'listItem',
            checked:
              o.node.props.type === 'todo'
                ? (o.node.props.checked as boolean)
                : undefined,
            spread: false,
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
        .closeNode();
    },
    leave: (o, context) => {
      const { walkerContext } = context;
      const currentTNode = walkerContext.currentNode();
      const previousTNode = walkerContext.previousNode();
      if (
        walkerContext.getPreviousNodeContext('affine:list:parent') ===
          o.parent &&
        currentTNode.type === 'listItem' &&
        previousTNode?.type === 'list' &&
        previousTNode.ordered === (o.node.props.type === 'numbered') &&
        AdapterTextUtils.isNullish(currentTNode.checked) ===
          AdapterTextUtils.isNullish(
            o.node.props.type === 'todo'
              ? (o.node.props.checked as boolean)
              : undefined
          )
      ) {
        walkerContext.closeNode();
        if (
          o.next?.flavour !== 'affine:list' ||
          o.next.props.type !== o.node.props.type
        ) {
          // If the next node is not a list or different type of list, close the list
          walkerContext.closeNode();
        }
      } else {
        walkerContext.closeNode().closeNode();
      }
    },
  },
};

export const ListBlockMarkdownAdapterExtension = BlockMarkdownAdapterExtension(
  listBlockMarkdownAdapterMatcher
);
