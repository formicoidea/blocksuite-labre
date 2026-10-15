/**
 * Markdown import drops a link whose scheme is refused and keeps its words.
 *
 * What it would have caught: the Markdown adapter used to copy `ast.url` into
 * the `link` attribute whatever its scheme, so `[text](javascript:…)` in an
 * imported file became a stored link that `affine-link` rendered as an href.
 * The render side refuses it too (`isSafeLinkUrl`), but nothing refused should
 * be written into a new document in the first place.
 *
 * remark decodes character references before the matcher sees the url, so the
 * `&#106;` spelling is checked as the plain scheme it decodes to.
 *
 * The second half holds the paths #485 left (P4, from the import spike): an
 * HTML `<a>` (whose `href.startsWith('http')` let `httpx:` through), a
 * Markdown footnote definition (stored as a footnote `url` AND as a bookmark
 * block's `url`), and the two writers, which re-emitted whatever a document
 * held. Would have caught: any of them storing or writing a refused scheme.
 */
import { DefaultTheme, NoteDisplayMode } from '@labre/affine-model';
import {
  HtmlAdapter,
  MarkdownAdapter,
  NotionHtmlAdapter,
} from '@labre/affine-shared/adapters';
import type { BlockSnapshot } from '@labre/store';
import { describe, expect, test } from 'vitest';

import { createJob } from '../utils/create-job.js';
import { getProvider } from '../utils/get-provider.js';

const provider = getProvider();

/** The runs of the first paragraph a Markdown import produced. */
async function importMarkdown(markdown: string) {
  const adapter = new MarkdownAdapter(createJob(), provider);
  const snapshot = await adapter.toBlockSnapshot({ file: markdown });
  const paragraph = (function find(block: BlockSnapshot): BlockSnapshot | null {
    if (block.flavour === 'affine:paragraph') return block;
    for (const child of block.children) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  })(snapshot!);
  return (
    paragraph!.props.text as {
      delta: { insert: string; attributes?: Record<string, unknown> }[];
    }
  ).delta;
}

describe('Markdown link import', () => {
  test.each([
    'javascript:void(0)',
    'JaVaScRiPt:void(0)',
    '&#106;avascript:void(0)',
    'data:text/html,x',
    'vbscript:msgbox(1)',
  ])('drops the link mark of [text](%s) and keeps the text', async url => {
    const delta = await importMarkdown(`aaa [bbb](${url}) ccc\n`);
    expect(delta.map(run => run.insert).join('')).toBe('aaa bbb ccc');
    expect(delta.some(run => run.attributes?.link !== undefined)).toBe(false);
  });

  test('keeps the formatting of the text inside a refused link', async () => {
    const delta = await importMarkdown('[**bold**](javascript:void(0))\n');
    expect(delta).toEqual([{ insert: 'bold', attributes: { bold: true } }]);
  });

  test('still imports an http(s) or mailto link', async () => {
    const delta = await importMarkdown(
      '[a](https://example.com/) [b](mailto:someone@example.com)\n'
    );
    expect(delta.filter(run => run.attributes?.link)).toEqual([
      { insert: 'a', attributes: { link: 'https://example.com/' } },
      { insert: 'b', attributes: { link: 'mailto:someone@example.com' } },
    ]);
  });
});

const REFUSED = /javascript|httpx/i;

describe('HTML link import', () => {
  test('keeps only http(s) links, by parsed scheme', async () => {
    const adapter = new HtmlAdapter(createJob(), provider);
    const snapshot = await adapter.toBlockSnapshot({
      file: '<p>aaa <a href="javascript:alert(1)">bbb</a> <a href="httpx://x.example">ccc</a> <a href="https://example.com/">ddd</a></p>',
    });
    const text = JSON.stringify(snapshot);
    expect(text).not.toMatch(REFUSED);
    expect(text).toContain('"link":"https://example.com/"');
    expect(text).toContain('bbb');
  });
});

describe('Markdown footnote import', () => {
  test('stores no refused url, as a footnote or as a bookmark', async () => {
    const adapter = new MarkdownAdapter(createJob(), provider);
    const url = encodeURIComponent('javascript:alert(1)');
    const snapshot = await adapter.toBlockSnapshot({
      file: `aaa[^1]\n\n[^1]: {"type":"url","url":"${url}","title":"t"}\n`,
    });
    const text = JSON.stringify(snapshot);
    // The definition falls back to the reader's default (its JSON as inert
    // paragraph text); what must not exist is a link or a url holding it.
    expect(text).not.toMatch(/"(?:url|link)":"javascript/i);
    expect(text).not.toContain('affine:bookmark');
  });
});

describe('writing a document that holds a refused link', () => {
  const unsafe = 'javascript:alert(1)';
  const snapshot: BlockSnapshot = {
    type: 'block',
    id: 'page',
    flavour: 'affine:page',
    props: { title: { '$blocksuite:internal:text$': true, delta: [] } },
    children: [
      {
        type: 'block',
        id: 'note',
        flavour: 'affine:note',
        props: {
          xywh: '[0,0,800,95]',
          background: DefaultTheme.noteBackgrounColor,
          index: 'a0',
          hidden: false,
          displayMode: NoteDisplayMode.DocAndEdgeless,
        },
        children: [
          {
            type: 'block',
            id: 'paragraph',
            flavour: 'affine:paragraph',
            props: {
              type: 'text',
              text: {
                '$blocksuite:internal:text$': true,
                delta: [
                  { insert: 'aaa ' },
                  { insert: 'bbb', attributes: { link: unsafe } },
                  {
                    insert: ' ',
                    attributes: {
                      footnote: {
                        label: '1',
                        reference: { type: 'url', url: unsafe },
                      },
                    },
                  },
                ],
              },
            },
            children: [],
          },
          {
            type: 'block',
            id: 'bookmark',
            flavour: 'affine:bookmark',
            props: { style: 'horizontal', url: unsafe, title: 'kept title' },
            children: [],
          },
        ],
      },
    ],
  };

  test('Markdown writes the words and no refused link', async () => {
    const adapter = new MarkdownAdapter(createJob(), provider);
    const { file } = await adapter.fromBlockSnapshot({ snapshot });
    expect(file).not.toMatch(REFUSED);
    expect(file).toContain('aaa bbb');
    expect(file).toContain('kept title');
  });

  test('HTML writes the words and no refused href', async () => {
    const adapter = new HtmlAdapter(createJob(), provider);
    const { file } = await adapter.fromBlockSnapshot({ snapshot });
    expect(file).not.toMatch(REFUSED);
    expect(file).toContain('bbb');
  });
});

describe('Notion HTML bookmark import', () => {
  test('stores no refused url on a bookmark', async () => {
    const adapter = new NotionHtmlAdapter(createJob(), provider);
    const snapshot = await adapter.toBlockSnapshot({
      file: '<figure><a href="javascript:alert(1)" class="bookmark source"><div class="bookmark-info"><div class="bookmark-text"><div class="bookmark-title">t</div></div></div></a></figure>',
    });
    const text = JSON.stringify(snapshot);
    expect(text).toContain('affine:bookmark');
    expect(text).not.toMatch(REFUSED);
  });
});
