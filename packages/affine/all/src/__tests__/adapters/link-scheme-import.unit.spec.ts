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
 */
import { MarkdownAdapter } from '@labre/affine-shared/adapters';
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
