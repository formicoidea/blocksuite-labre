import { createEmbedBlockMarkdownAdapterMatcher } from '@labre/affine-block-embed';
import {
  BookmarkBlockSchema,
  FootNoteReferenceParamsSchema,
} from '@labre/affine-model';
import {
  BlockMarkdownAdapterExtension,
  FOOTNOTE_DEFINITION_PREFIX,
  getFootnoteDefinitionText,
  isFootnoteDefinitionNode,
  type MarkdownAST,
} from '@labre/affine-shared/adapters';
import { isSafeLinkUrl } from '@labre/affine-shared/utils';
import { nanoid } from '@labre/store';

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const isUrlFootnoteDefinitionNode = (node: MarkdownAST) => {
  if (!isFootnoteDefinitionNode(node)) return false;
  const footnoteDefinition = getFootnoteDefinitionText(node);
  try {
    const footnoteDefinitionJson = FootNoteReferenceParamsSchema.parse(
      JSON.parse(footnoteDefinition)
    );
    // A refused scheme makes no bookmark: the definition is left to the
    // reader's default, and no `javascript:` is stored as a bookmark `url`.
    return (
      footnoteDefinitionJson.type === 'url' &&
      !!footnoteDefinitionJson.url &&
      isSafeLinkUrl(safeDecode(footnoteDefinitionJson.url))
    );
  } catch {
    return false;
  }
};

export const bookmarkBlockMarkdownAdapterMatcher =
  createEmbedBlockMarkdownAdapterMatcher(BookmarkBlockSchema.model.flavour, {
    toMatch: o => isUrlFootnoteDefinitionNode(o.node),
    toBlockSnapshot: {
      enter: (o, context) => {
        if (!isFootnoteDefinitionNode(o.node)) {
          return;
        }

        const { walkerContext, configs } = context;
        const footnoteIdentifier = o.node.identifier;
        const footnoteDefinitionKey = `${FOOTNOTE_DEFINITION_PREFIX}${footnoteIdentifier}`;
        const footnoteDefinition = configs.get(footnoteDefinitionKey);
        if (!footnoteDefinition) {
          return;
        }
        let footnoteDefinitionJson;
        try {
          footnoteDefinitionJson = FootNoteReferenceParamsSchema.parse(
            JSON.parse(footnoteDefinition)
          );
          // If the footnote definition contains url, decode it
          if (footnoteDefinitionJson.url) {
            footnoteDefinitionJson.url = decodeURIComponent(
              footnoteDefinitionJson.url
            );
          }
          if (footnoteDefinitionJson.favicon) {
            footnoteDefinitionJson.favicon = decodeURIComponent(
              footnoteDefinitionJson.favicon
            );
          }
        } catch (err) {
          console.warn('Failed to parse or decode footnote definition:', err);
          return;
        }

        const { url, favicon, title, description } = footnoteDefinitionJson;
        walkerContext
          .openNode(
            {
              type: 'block',
              id: nanoid(),
              flavour: BookmarkBlockSchema.model.flavour,
              props: {
                url,
                footnoteIdentifier,
                icon: favicon,
                title,
                description,
                style: 'citation',
              },
              children: [],
            },
            'children'
          )
          .closeNode();
        walkerContext.skipAllChildren();
      },
    },
  });

export const BookmarkBlockMarkdownAdapterExtension =
  BlockMarkdownAdapterExtension(bookmarkBlockMarkdownAdapterMatcher);
