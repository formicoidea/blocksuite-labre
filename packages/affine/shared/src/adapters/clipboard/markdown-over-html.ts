import type { Root as HastRoot, RootContent as HastContent } from 'hast';
import type { Root as MdastRoot } from 'mdast';
import rehypeParse from 'rehype-parse';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { remarkGfm } from '../markdown/gfm.js';

/**
 * Elements that carry no structure of their own: the document shell, line
 * boxes and presentational spans. Editors and chat apps (VS Code, Slack,
 * Teams) wrap a plain-text copy in exactly these, one `<div>` or `<p>` per
 * line, the spans carrying syntax colours. Inline `style` is ignored: it is
 * presentation, never structure. Anything else (a table, a list, a heading,
 * a link, an image, code, `<pre>`, `<b>`, Google Docs' `<b id="docs-…">`, an
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

/**
 * A GFM delimiter row (`| --- | :-: |`, `--- | ---`): at least one pipe, and
 * cells of dashes with optional colons. A table cannot exist without one, so
 * a clipboard without such a line is never parsed. Matches the line
 * "| :--- | ---: |" and "a-b | -c" is not one ("-old" or "---" alone neither).
 */
const GFM_DELIMITER_ROW =
  // Accepts "| :--- | ---: |" and "--- | ---"; rejects "-old", "---", "a | b".
  // https://regex101.com/?flavor=javascript&flags=m&regex=%5E%5B%20%5Ct%5D*%5C%7C%3F(%3F%3A%5B%20%5Ct%5D*%3A%3F-%2B%3A%3F%5B%20%5Ct%5D*%5C%7C)%2B(%3F%3A%5B%20%5Ct%5D*%3A%3F-%2B%3A%3F%5B%20%5Ct%5D*)%3F%24&testString=%7C%20%3A---%20%7C%20---%3A%20%7C%0A---%20%7C%20---%0A-old%0A---%0Aa%20%7C%20b
  /^[ \t]*\|?(?:[ \t]*:?-+:?[ \t]*\|)+(?:[ \t]*:?-+:?[ \t]*)?$/m;

/**
 * Above this, a paste is not a hand-copied table; parsing both flavours of a
 * long file on every paste costs a second and more (20 000 lines measured).
 */
const MAX_DEFER_CHARS = 200_000;

/**
 * True when `text` parses, through the same GFM parser the Markdown adapter
 * uses, into a top-level table. Only the table: copied source code is flat
 * HTML too, and in it `# comment` reads as a heading, `  - name: x` as a list
 * and `Total\n-----` as a setext heading, so any wider set of blocks turned
 * a code paste into Markdown, losing indentation and emphasising `*` / `_`.
 */
export function isMarkdownTable(text: string): boolean {
  if (!GFM_DELIMITER_ROW.test(text)) return false;
  const ast = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(text) as MdastRoot;
  return ast.children.some(node => node.type === 'table');
}

/**
 * The `defer` of the `text/html` clipboard config (labre P4-11). A paste
 * reads `text/html` before `text/plain`, so when an app puts both on the
 * clipboard the HTML wins. That is right when the HTML is richer, and wrong
 * when it is the same text in `<div>` lines while the plain flavour is a
 * Markdown table: a GFM table pasted from VS Code became paragraphs of pipes.
 * HTML steps aside only when the plain text is a GFM table AND the HTML is
 * flat. A cheap line test and a size cap run first, so an ordinary paste
 * parses nothing; past them, both sides are read by real parsers.
 */
export function htmlDefersToMarkdown(
  read: (mimeType: string) => string | File[]
): boolean {
  const html = read('text/html');
  const text = read('text/plain');
  if (typeof html !== 'string' || typeof text !== 'string') return false;
  if (!html.trim() || !text.trim()) return false;
  if (html.length > MAX_DEFER_CHARS || text.length > MAX_DEFER_CHARS) {
    return false;
  }
  return isMarkdownTable(text.replaceAll('\r', '')) && isFlatHtml(html);
}
