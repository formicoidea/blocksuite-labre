// @vitest-environment node
import { HtmlAdapter } from '@labre/affine-shared/adapters';
import { type BlockSnapshot, type Store, Text } from '@labre/store';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { openHeadless } from './utils/open-headless';

/**
 * GUARD — every stored block reads on a page rendered in plain Node.
 *
 * `HtmlAdapter._traverseSnapshot` used to print nothing for a block with no
 * matcher, so a callout, a formula or an attachment vanished from an HTML export
 * with no error, and an image whose blob was missing went the same way.
 *
 * **What it would catch**: a matcher dropped from its store extension (these go
 * through a store opened headless, not through the matcher), a renderer that
 * needs a DOM, the stored `html` of an embed reaching the page, and a stored
 * block flavour disappearing instead of degrading.
 */

const TWO_KB = 2048;

const text = (value: string) => ({
  '$blocksuite:internal:text$': true,
  delta: [{ insert: value }],
});

const block = (
  flavour: string,
  props: Record<string, unknown>,
  children: BlockSnapshot[] = []
): BlockSnapshot => ({ type: 'block', id: flavour, flavour, props, children });

const adapterOf = (store: Store) =>
  new HtmlAdapter(store.getTransformer(), store.provider);

/** Prints one block the way a page does, with no manager to read blobs. */
const renderBlock = async (snapshot: BlockSnapshot) => {
  const { file, assetsIds } = await adapterOf(
    openHeadless(null).store
  ).fromBlockSnapshot({ snapshot });
  return { html: file.replace('<!doctype html>', ''), assetsIds };
};

const reparsed = (html: string) =>
  String(unified().use(rehypeParse).use(rehypeStringify).processSync(html));

describe('the HTML of each block, in plain Node', () => {
  test('a callout is an aside with its icon as text, and its children', async () => {
    const { html } = await renderBlock(
      block('affine:callout', { emoji: '💡', text: text('Heads up') }, [
        block('affine:paragraph', { type: 'text', text: text('Inside') }),
      ])
    );
    expect(
      html.startsWith(
        '<aside class="affine-callout"><span class="affine-callout-icon">💡</span>Heads up<div'
      )
    ).toBe(true);
    expect(html).toContain('<p>Inside</p>');
    expect(html.endsWith('</aside>')).toBe(true);
  });

  test('a formula goes through KaTeX', async () => {
    const { html } = await renderBlock(
      block('affine:latex', { latex: 'E=mc^2' })
    );
    expect(html.startsWith('<div class="affine-latex">')).toBe(true);
    expect(html).toContain('class="katex-display"');
    expect(html).toContain('E=mc^2</annotation>');
  });

  test('a formula KaTeX refuses stays readable as code', async () => {
    const { html } = await renderBlock(
      block('affine:latex', { latex: '\\frac{<b>' })
    );
    expect(html).toBe('<code class="affine-latex">\\frac{&#x3C;b></code>');
  });

  test('a formula cannot print a link through KaTeX', async () => {
    const { html } = await renderBlock(
      block('affine:latex', { latex: '\\href{javascript:alert(1)}{x}' })
    );
    expect(html).not.toContain('href="javascript');
  });

  test('an attachment links to its asset and names it, unread', async () => {
    const { html, assetsIds } = await renderBlock(
      block('affine:attachment', {
        name: 'report <1>.pdf',
        size: TWO_KB,
        sourceId: 'blob-1',
      })
    );
    expect(html).toBe(
      '<a class="affine-attachment" href="assets/blob-1">report &#x3C;1>.pdf · 2KB</a>'
    );
    expect(assetsIds).toEqual(['blob-1']);
  });

  test('an attachment still uploading keeps its name and no link', async () => {
    const { html } = await renderBlock(
      block('affine:attachment', { name: 'a.pdf', size: 0 })
    );
    expect(html).toBe('<a class="affine-attachment">a.pdf</a>');
  });

  test('a surface reference leaves a mount point and its caption', async () => {
    const { html } = await renderBlock(
      block('affine:surface-ref', { reference: 'frame-1', caption: 'A map' })
    );
    expect(html).toBe(
      '<div class="affine-surface-ref" data-labre-surface-ref="frame-1">A map</div>'
    );
  });

  test('an edgeless text wraps its paragraphs', async () => {
    const { html } = await renderBlock(
      block('affine:edgeless-text', {}, [
        block('affine:paragraph', { type: 'text', text: text('On canvas') }),
      ])
    );
    expect(html.startsWith('<div class="affine-edgeless-text">')).toBe(true);
    expect(html).toContain('<p>On canvas</p>');
  });

  test('an html embed prints no iframe and none of its markup', async () => {
    const { html } = await renderBlock(
      block('affine:embed-html', {
        html: '<script>alert(1)</script>',
        caption: 'A widget',
      })
    );
    expect(html).toBe('<div class="affine-embed-html">A widget</div>');
  });

  test('an image with no blob at hand prints under its id', async () => {
    const { html, assetsIds } = await renderBlock(
      block('affine:image', { sourceId: 'blob-2', caption: 'A picture' })
    );
    expect(html).toContain(
      '<img src="assets/blob-2" alt="blob-2" title="A picture">'
    );
    expect(assetsIds).toEqual(['blob-2']);
  });
});

describe('a block no matcher knows', () => {
  test('prints its title over its text', async () => {
    const { html } = await renderBlock(
      block('affine:from-the-future', {
        title: text('A title'),
        text: text('Some text'),
      })
    );
    expect(html).toBe(
      '<div class="affine-unknown-block" data-flavour="affine:from-the-future">A title</div>'
    );
  });

  test('prints its text, or a plain string', async () => {
    expect(
      (await renderBlock(block('x:a', { text: text('Some text') }))).html
    ).toContain('>Some text</div>');
    expect(
      (await renderBlock(block('x:b', { title: 'A string' }))).html
    ).toContain('>A string</div>');
  });

  test('with nothing to read is still announced, never an error', async () => {
    const { html } = await renderBlock(block('x:c', { n: 1 }));
    expect(html).toBe(
      '<div class="affine-unknown-block" data-flavour="x:c"></div>'
    );
  });

  test('keeps the children it holds', async () => {
    const { html } = await renderBlock(
      block('x:d', {}, [
        block('affine:paragraph', { type: 'text', text: text('Kept') }),
      ])
    );
    expect(html).toContain('<p>Kept</p>');
    expect(html.endsWith('</div>')).toBe(true);
  });

  test('under a surface stays on the canvas', async () => {
    const { html } = await renderBlock(
      block('affine:surface', {}, [block('x:e', { title: 'Drawn' })])
    );
    expect(html).toBe('');
  });
});

describe('a stored page holding them all', () => {
  test('opens from its Y.Doc state and prints well-formed HTML', async () => {
    const writer = openHeadless(null);
    writer.store.transact(() => {
      const page = writer.store.addBlock('affine:page', {
        title: new Text('T'),
      });
      const note = writer.store.addBlock('affine:note', {}, page);
      const callout = writer.store.addBlock(
        'affine:callout',
        { emoji: '💡' },
        note
      );
      writer.store.addBlock(
        'affine:paragraph',
        { text: new Text('In a callout') },
        callout
      );
      writer.store.addBlock('affine:latex', { latex: 'x^2' }, note);
      writer.store.addBlock(
        'affine:attachment',
        { name: 'a.pdf', size: TWO_KB, sourceId: 'blob-1' },
        note
      );
      writer.store.addBlock(
        'affine:surface-ref',
        { reference: 'frame-1', caption: '' },
        note
      );
      writer.store.addBlock(
        'affine:embed-html',
        { html: '<script>alert(1)</script>', caption: 'A widget' },
        note
      );
      writer.store.addBlock('affine:image', { sourceId: 'blob-2' }, note);
    });

    const { store } = openHeadless(Y.encodeStateAsUpdate(writer.doc));
    const job = store.getTransformer();
    const snapshot = job.docToSnapshot(store);
    if (!snapshot) throw new Error('the store gave no snapshot');
    const { file, assetsIds } = await adapterOf(store).fromDocSnapshot({
      snapshot,
    });

    const fragments = [
      '<aside class="affine-callout">',
      'In a callout',
      'class="katex-display"',
      'href="assets/blob-1"',
      'data-labre-surface-ref="frame-1"',
      'A widget',
      'src="assets/blob-2"',
    ];
    expect(fragments.filter(fragment => !file.includes(fragment))).toEqual([]);
    expect(file).not.toContain('<script');
    expect(file).not.toContain('affine-unknown-block');
    expect(assetsIds.sort()).toEqual(['blob-1', 'blob-2']);
    expect(reparsed(file)).toBe(file);
  });
});
