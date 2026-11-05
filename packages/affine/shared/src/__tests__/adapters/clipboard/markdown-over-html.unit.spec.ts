import { describe, expect, test } from 'vitest';

import {
  htmlDefersToMarkdown,
  isBlockMarkdown,
  isFlatHtml,
} from '../../../adapters/clipboard/markdown-over-html.js';

/**
 * When a clipboard carries both `text/html` and `text/plain`, the paste reads
 * the HTML first (priority 90 over 70). `htmlDefersToMarkdown` is the one
 * exception, and these specs pin both of its edges (labre P4-11).
 *
 * Would have caught: a GFM table copied from VS Code, a browser or a chat app
 * (the same table in one `<div>` per line beside the Markdown) pasting as
 * paragraphs of pipes, because the flat HTML won and the Markdown was never
 * read. And, the other way, a deferral too eager: rich HTML (a table, a list,
 * Google Docs) or plain prose losing the HTML path it always had.
 */
const TABLE = ['| a | b |', '| --- | --- |', '| 1 | 2 |'].join('\n');
const FLAT_TABLE_HTML =
  '<div>| a | b |</div><div>| --- | --- |</div><div>| 1 | 2 |</div>';

const clipboard =
  (items: Record<string, string>) =>
  (mimeType: string): string =>
    items[mimeType] ?? '';

describe('htmlDefersToMarkdown', () => {
  test('a flat HTML copy of a GFM table yields to the Markdown', () => {
    expect(
      htmlDefersToMarkdown(
        clipboard({ 'text/html': FLAT_TABLE_HTML, 'text/plain': TABLE })
      )
    ).toBe(true);
  });

  test('VS Code markup (meta, styled spans, CRLF) still yields', () => {
    const html =
      '<meta charset=\'utf-8\'><div style="color: #ccc;white-space: pre;">' +
      '<div><span style="color: #569cd6;">| a | b |</span></div>' +
      '<div><span>| --- | --- |</span></div><div><span>| 1 | 2 |</span></div>' +
      '</div>';
    expect(
      htmlDefersToMarkdown(
        clipboard({
          'text/html': html,
          'text/plain': TABLE.replaceAll('\n', '\r\n'),
        })
      )
    ).toBe(true);
  });

  test.each([
    ['a table', '<table><tr><td>a</td><td>b</td></tr></table>'],
    ['a list', '<ul><li>a</li></ul>'],
    ['a heading', '<h1>a</h1>'],
    ['a link', '<p><a href="https://labre.invalid">a</a></p>'],
    ['an image', '<p><img src="x.png"></p>'],
    ['code', '<pre><code>a</code></pre>'],
    ['formatting', '<p><strong>a</strong></p>'],
    [
      'Google Docs',
      '<b style="font-weight:normal;" id="docs-internal-guid-1"><p>a</p></b>',
    ],
  ])('rich HTML (%s) keeps its priority beside Markdown', (_, html) => {
    expect(
      htmlDefersToMarkdown(
        clipboard({ 'text/html': html, 'text/plain': TABLE })
      )
    ).toBe(false);
  });

  test('plain prose keeps the HTML path', () => {
    expect(
      htmlDefersToMarkdown(
        clipboard({
          'text/html': '<p>first line</p><p>second | line</p>',
          'text/plain': 'first line\nsecond | line',
        })
      )
    ).toBe(false);
  });

  test('a lone URL keeps the HTML path', () => {
    expect(
      htmlDefersToMarkdown(
        clipboard({
          'text/html': '<div>https://labre.invalid/page</div>',
          'text/plain': 'https://labre.invalid/page',
        })
      )
    ).toBe(false);
  });

  test('nothing to compare, nothing deferred', () => {
    expect(
      htmlDefersToMarkdown(clipboard({ 'text/html': FLAT_TABLE_HTML }))
    ).toBe(false);
    expect(htmlDefersToMarkdown(clipboard({ 'text/plain': TABLE }))).toBe(
      false
    );
    expect(
      htmlDefersToMarkdown(mimeType =>
        mimeType === 'text/plain' ? [] : FLAT_TABLE_HTML
      )
    ).toBe(false);
  });
});

describe('isFlatHtml', () => {
  test('line boxes and spans are flat', () => {
    expect(isFlatHtml('<p>a</p><div>b<br><span>c</span></div>')).toBe(true);
    expect(isFlatHtml('<!--StartFragment--><div>a</div>')).toBe(true);
  });

  test('a single semantic element makes it rich', () => {
    expect(isFlatHtml('<div><span><em>a</em></span></div>')).toBe(false);
    expect(isFlatHtml('<div><code>a</code></div>')).toBe(false);
  });
});

describe('isBlockMarkdown', () => {
  test.each([
    ['a GFM table', TABLE],
    ['a bullet list', '- a\n- b'],
    ['an ordered list', '1. a\n2. b'],
    ['an ATX heading', '# Title'],
    ['a blockquote', '> quoted'],
    ['a fenced code block', '```ts\nconst a = 1;\n```'],
    ['a tilde fence', '~~~\nx\n~~~'],
  ])('%s is block Markdown', (_, text) => {
    expect(isBlockMarkdown(text)).toBe(true);
  });

  test.each([
    ['prose', 'just a sentence'],
    ['pipes without a delimiter row', '| a | b |\n| 1 | 2 |'],
    ['indented source', '    const a = 1;\n    const b = 2;'],
    ['a hashtag', '#labre'],
    ['inline Markdown only', 'some **bold** and `code`'],
    ['a URL', 'https://labre.invalid/page'],
  ])('%s is not', (_, text) => {
    expect(isBlockMarkdown(text)).toBe(false);
  });
});
