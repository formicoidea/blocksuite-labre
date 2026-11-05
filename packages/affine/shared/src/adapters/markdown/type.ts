import type {
  Blockquote,
  FootnoteDefinition,
  Root,
  RootContentMap,
} from 'mdast';

export type Markdown = string;

type MdastUnionType<
  K extends keyof RootContentMap,
  V extends RootContentMap[K],
> = V;

export type MarkdownAST =
  | MdastUnionType<keyof RootContentMap, RootContentMap[keyof RootContentMap]>
  | Root;

export const isMarkdownAST = (node: unknown): node is MarkdownAST =>
  !Array.isArray(node) &&
  'type' in (node as object) &&
  (node as MarkdownAST).type !== undefined;

export const isFootnoteDefinitionNode = (
  node: MarkdownAST
): node is FootnoteDefinition => node.type === 'footnoteDefinition';

export const getFootnoteDefinitionText = (node: FootnoteDefinition) => {
  const childNode = node.children[0];
  if (childNode.type !== 'paragraph') return '';
  const paragraph = childNode.children[0];
  if (paragraph.type !== 'text') return '';
  return paragraph.value;
};

export const isCalloutNode = (node: MarkdownAST): node is Blockquote => {
  return node.type === 'blockquote' && !!node.data?.isCallout;
};

export const getCalloutEmoji = (node: Blockquote) => {
  return node.data?.calloutEmoji ?? '';
};

export const FOOTNOTE_DEFINITION_PREFIX = 'footnoteDefinition:';
export const IN_PARAGRAPH_NODE_CONTEXT_KEY = 'mdast:paragraph';

const isBlankText = (node: MarkdownAST) =>
  node.type === 'text' && node.value.trim() === '';

const isImageOrLinkedImage = (node: MarkdownAST) =>
  node.type === 'image' ||
  (node.type === 'link' &&
    node.children.length > 0 &&
    node.children.every(child => child.type === 'image'));

/**
 * A paragraph that holds nothing but images, the way mdast wraps a picture
 * standing on its own: images, images inside a link (`[![a](src)](href)`),
 * hard line breaks between them and blank text. The image matcher emits the
 * blocks; a matcher that opened a text block for it left an empty paragraph
 * above the image (#521), or skipped the image inside a list item.
 *
 * Shared by the paragraph and list matchers so both agree on what "only an
 * image" means.
 */
export const isImageOnlyParagraph = (node: MarkdownAST) =>
  node.type === 'paragraph' &&
  node.children.some(isImageOrLinkedImage) &&
  node.children.every(
    child =>
      isImageOrLinkedImage(child) ||
      child.type === 'break' ||
      isBlankText(child)
  );
