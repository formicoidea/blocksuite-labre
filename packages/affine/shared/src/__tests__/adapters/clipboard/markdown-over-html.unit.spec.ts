import { describe, expect, test } from 'vitest';

import {
  htmlDefersToMarkdown,
  isFlatHtml,
  isMarkdownTable,
} from '../../../adapters/clipboard/markdown-over-html.js';

/**
 * When a clipboard carries both `text/html` and `text/plain`, the paste reads
 * the HTML first (priority 90 over 70). `htmlDefersToMarkdown` is the one
 * exception, and these specs pin both of its edges (labre P4-11).
 *
 * Would have caught: a GFM table copied from VS Code, Slack, Teams or a chat
 * app (the same table in one `<div>` per line beside the Markdown) pasting as
 * paragraphs of pipes, because the flat HTML won and the Markdown was never
 * read. And, the other way, a deferral too eager: rich HTML (a table, a list,
 * Google Docs), plain prose, or source code copied from VS Code (flat HTML
 * too) read as Markdown, where `# comment` became a heading, `  - name:` a
 * list and `Total\n-----` a setext heading, indentation lost.
 */
const lines = (...rows: string[]) => rows.join('\n');

const TABLE = lines('| a | b |', '| --- | --- |', '| 1 | 2 |');
const FLAT_TABLE_HTML =
  '<div>| a | b |</div><div>| --- | --- |</div><div>| 1 | 2 |</div>';

const PYTHON = lines(
  '# compute the total',
  'def total(xs):',
  '    return sum(xs)'
);
const YAML = lines('steps:', '  - name: build', '    run: yarn build');
const DOT_ENV = lines(
  'API_URL=https://labre.invalid',
  '# secret below',
  'TOKEN=*abc*_def_'
);
const DIFF = lines('--- a/file.ts', '+++ b/file.ts', '-old', '+new');
const SETEXT = lines('Total', '-----');
const YEAR = '2024. A big year';
/** The size the review measured a second of parsing on. */
const LONG_FILE_LINES = 20_000;

const clipboard =
  (items: Record<string, string>) =>
  (mimeType: string): string =>
    items[mimeType] ?? '';

/** The markup VS Code writes beside a copy: one coloured line box per line. */
const asVsCode = (text: string) =>
  '<meta charset=\'utf-8\'><div style="white-space: pre;">' +
  text
    .split('\n')
    .map(line => `<div><span style="color: #6a9955;">${line}</span></div>`)
    .join('') +
  '</div>';

describe('htmlDefersToMarkdown', () => {
  test('a flat HTML copy of a GFM table yields to the Markdown', () => {
    expect(
      htmlDefersToMarkdown(
        clipboard({ 'text/html': FLAT_TABLE_HTML, 'text/plain': TABLE })
      )
    ).toBe(true);
  });

  test('VS Code markup (meta, styled spans, CRLF) still yields', () => {
    expect(
      htmlDefersToMarkdown(
        clipboard({
          'text/html': asVsCode(TABLE),
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

  test.each([
    ['Python with a comment', PYTHON],
    ['YAML with a list', YAML],
    ['a .env file', DOT_ENV],
    ['a diff', DIFF],
    ['a setext underline', SETEXT],
    ['prose starting with a year', YEAR],
    ['a bullet list', lines('- a', '- b')],
    ['a heading', '# Title'],
  ])('%s copied from VS Code keeps the HTML path', (_, text) => {
    expect(
      htmlDefersToMarkdown(
        clipboard({ 'text/html': asVsCode(text), 'text/plain': text })
      )
    ).toBe(false);
  });

  test('plain prose keeps the HTML path', () => {
    expect(
      htmlDefersToMarkdown(
        clipboard({
          'text/html': '<p>first line</p><p>second | line</p>',
          'text/plain': lines('first line', 'second | line'),
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

  test('a paste over the size cap is never parsed, table or not', () => {
    const rows = Array.from(
      { length: LONG_FILE_LINES },
      (_, i) => `| ${i} | x |`
    );
    const big = lines('| a | b |', '| --- | --- |', ...rows);
    expect(
      htmlDefersToMarkdown(
        clipboard({ 'text/html': asVsCode(big), 'text/plain': big })
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
    expect(isFlatHtml('<pre>a</pre>')).toBe(false);
  });
});

describe('isMarkdownTable', () => {
  test.each([
    ['a GFM table', TABLE],
    ['a table without outer pipes', lines('a | b', '--- | ---', '1 | 2')],
    ['an aligned table', lines('| a | b |', '| :-- | --: |', '| 1 | 2 |')],
  ])('%s is a table', (_, text) => {
    expect(isMarkdownTable(text)).toBe(true);
  });

  test.each([
    ['prose', 'just a sentence'],
    ['pipes without a delimiter row', lines('| a | b |', '| 1 | 2 |')],
    ['indented source', lines('    const a = 1;', '    const b = 2;')],
    ['Python with a comment', PYTHON],
    ['YAML with a list', YAML],
    ['a .env file', DOT_ENV],
    ['a diff', DIFF],
    ['a setext underline', SETEXT],
    ['prose starting with a year', YEAR],
    ['a bullet list', lines('- a', '- b')],
    ['a heading', '# Title'],
    ['a fenced code block', lines('```ts', 'const a = 1;', '```')],
    ['a URL', 'https://labre.invalid/page'],
  ])('%s is not', (_, text) => {
    expect(isMarkdownTable(text)).toBe(false);
  });
});
