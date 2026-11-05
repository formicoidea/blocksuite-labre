import type { Root as HastRoot, RootContent as HastContent } from 'hast';
import type { Root as MdastRoot, RootContent as MdastContent } from 'mdast';
import rehypeParse from 'rehype-parse';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { remarkGfm } from '../markdown/gfm.js';

/**
 * Elements that carry no structure of their own: the document shell, line
 * boxes and presentational spans. Editors and chat apps (VS Code, browsers,
 * Teams, Slack) wrap a plain-text copy in exactly these, one `<div>` or `<p>`
 * per line, the spans carrying syntax colours. Inline `style` is ignored: it
 * is presentation, never structure. Anything else (a table, a list, a
 * heading, a link, an image, code, `<b>`, Google Docs' `<b id="docs-…">`, an
 * Office `<o:p>`) makes the HTML rich, and rich HTML keeps its priority.
 */
const FLAT_ELEMENTS = new Set([
  'html',
  'head',
  'body',
  'meta',
  'div',
  'p',
  'br',
  'span',
]);

const isFlatNode = (node: HastContent): boolean => {
  if (node.type !== 'element') return true;
  if (!FLAT_ELEMENTS.has(node.tagName)) return false;
  return node.children.every(isFlatNode);
};

/** True when `html` is plain text in line boxes: no semantic element at all. */
export function isFlatHtml(html: string): boolean {
  const ast = unified().use(rehypeParse).parse(html) as HastRoot;
  return ast.children.every(isFlatNode);
}

const MARKDOWN_BLOCKS = new Set<string>([
  'table',
  'list',
  'heading',
  'blockquote',
]);

/** A code node is fenced when its source starts with a fence, not an indent. */
const isFenced = (node: MdastContent, markdown: string) => {
  const start = node.position?.start.offset;
  if (start === undefined) return false;
  const source = markdown.slice(start).trimStart();
  return source.startsWith('```') || source.startsWith('~~~');
};

/**
 * True when `text` parses, through the same GFM parser the Markdown adapter
 * uses, into at least one block that a flat HTML copy cannot express: a
 * table, a list, a heading, a blockquote or a fenced code block. Indented
 * code is left out on purpose: four spaces of indentation are what any
 * copied source looks like, not a Markdown intent.
 */
export function isBlockMarkdown(text: string): boolean {
  const ast = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(text) as MdastRoot;
  return ast.children.some(
    node =>
      MARKDOWN_BLOCKS.has(node.type) ||
      (node.type === 'code' && isFenced(node, text))
  );
}

/**
 * The `defer` of the `text/html` clipboard config (labre P4-11). A paste
 * reads `text/html` before `text/plain`, so when an app puts both on the
 * clipboard the HTML wins. That is right when the HTML is richer, and wrong
 * when it is the same text in `<div>` lines while the plain flavour is
 * Markdown: a GFM table pasted from VS Code became paragraphs of pipes.
 * HTML steps aside only when it is flat AND the plain text is block
 * Markdown; both are read by real parsers, so neither side is a guess.
 */
export function htmlDefersToMarkdown(
  read: (mimeType: string) => string | File[]
): boolean {
  const html = read('text/html');
  const text = read('text/plain');
  if (typeof html !== 'string' || typeof text !== 'string') return false;
  if (!html.trim() || !text.trim()) return false;
  return isFlatHtml(html) && isBlockMarkdown(text.replaceAll('\r', ''));
}
