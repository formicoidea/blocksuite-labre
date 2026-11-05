/**
 * Markdown written by the library reads back into the same blocks, and
 * Markdown read as a slice keeps the structure a reader sees in it.
 *
 * Would have caught:
 * - #520: the callout marker exported as `> \[!💡]`. The stringifier escapes
 *   the `[` (it could open a link reference), so the export only reads back
 *   as a callout through a parser that resolves the escape; GFM / Obsidian
 *   readers, and an agent rewriting what `readDocMarkdown` showed it, see a
 *   quote with the text `[!💡]`;
 * - #521: a standalone image (mdast wraps it in a paragraph) imported with an
 *   empty `affine:paragraph` above the image block;
 * - the same empty paragraph above an image written by the workspace
 *   connector in the shapes #521 (PR #538) left out: an image inside a link,
 *   images split by a hard line break; and the image LOST when it stood
 *   alone in a list item (`- ![a](src)`) or inside a quote, both of which
 *   skipped the paragraph that carried it;
 * - #519: the code preprocessor (slice level) rewriting the first leading
 *   space of every line to `&#x20;` except for `-` lines, so a `1.`, `*` or
 *   `+` sub-list stopped being a list item and folded into its parent's text.
 *   The rewrite itself is kept: it exists so plain text pasted as a slice
 *   keeps its leading spaces and never turns into an indented code block
 *   (BlockSuite #6017, the plain-text adapter).
 */
import { DefaultTheme, NoteDisplayMode } from '@labre/affine-model';
import { MarkdownAdapter } from '@labre/affine-shared/adapters';
import {
  AssetsManager,
  type BlockSnapshot,
  MemoryBlobCRUD,
} from '@labre/store';
import { describe, expect, test } from 'vitest';

import { createJob } from '../utils/create-job.js';
import { getProvider } from '../utils/get-provider.js';

const provider = getProvider();

type Shape = {
  flavour: string;
  type?: string;
  text?: string;
  children?: Shape[];
};

/** The tree a reader sees: flavour, block type, plain text, children. */
function shape(block: BlockSnapshot): Shape {
  const props = block.props as {
    type?: string;
    text?: { delta: { insert: string }[] };
  };
  const out: Shape = { flavour: block.flavour };
  if (props.type) out.type = props.type;
  if (props.text) out.text = props.text.delta.map(op => op.insert).join('');
  if (block.children.length) out.children = block.children.map(shape);
  return out;
}

async function slice(markdown: string): Promise<Shape[]> {
  const snapshot = await new MarkdownAdapter(
    createJob(),
    provider
  ).toSliceSnapshot({ file: markdown, workspaceId: '', pageId: '' });
  // The slice wraps its blocks in a note.
  return snapshot!.content.flatMap(note => note.children.map(shape));
}

const paragraph = (text: string): BlockSnapshot => ({
  type: 'block',
  id: `p-${text}`,
  flavour: 'affine:paragraph',
  props: {
    type: 'text',
    text: { '$blocksuite:internal:text$': true, delta: [{ insert: text }] },
  },
  children: [],
});

const noteWith = (...children: BlockSnapshot[]): BlockSnapshot => ({
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
  children,
});

const callout = (emoji: string, text: string): BlockSnapshot => ({
  type: 'block',
  id: `callout-${emoji}`,
  flavour: 'affine:callout',
  props: { emoji },
  children: [paragraph(text)],
});

describe('callout marker (#520)', () => {
  test.each(['💡', ''])('exports `[!%s]` unescaped', async emoji => {
    const { file } = await new MarkdownAdapter(
      createJob(),
      provider
    ).fromBlockSnapshot({ snapshot: noteWith(callout(emoji, 'Idea')) });
    expect(file).toBe(`> [!${emoji}]\n>\n> Idea\n`);
  });

  test('export then slice import keeps the callout and its emoji', async () => {
    const { file } = await new MarkdownAdapter(
      createJob(),
      provider
    ).fromBlockSnapshot({ snapshot: noteWith(callout('💡', 'Idea')) });
    expect(await slice(file)).toEqual([
      {
        flavour: 'affine:callout',
        children: [{ flavour: 'affine:paragraph', type: 'text', text: 'Idea' }],
      },
    ]);
  });

  test('a link text starting with `[!` is still escaped', async () => {
    const { file } = await new MarkdownAdapter(
      createJob(),
      provider
    ).fromBlockSnapshot({
      snapshot: noteWith(paragraph('[!💡] not a callout')),
    });
    expect(file).toBe('\\[!💡] not a callout\n');
  });
});

describe('nested lists in a slice (#519)', () => {
  const nested = (
    type: 'numbered' | 'bulleted',
    parent: string,
    child: string
  ) => ({
    flavour: 'affine:list',
    type,
    text: parent,
    children: [{ flavour: 'affine:list', type, text: child }],
  });

  test('an ordered sub-list stays a sub-list', async () => {
    expect(await slice('1. un\n2. quatre\n   1. quatre a')).toEqual([
      { flavour: 'affine:list', type: 'numbered', text: 'un' },
      nested('numbered', 'quatre', 'quatre a'),
    ]);
  });

  test.each(['*', '+', '-'])(
    'a `%s` sub-list stays a sub-list',
    async marker => {
      expect(await slice(`${marker} a\n${marker} b\n  ${marker} b1`)).toEqual([
        { flavour: 'affine:list', type: 'bulleted', text: 'a' },
        nested('bulleted', 'b', 'b1'),
      ]);
    }
  );

  test('`1)` items and a bullet under a number nest too', async () => {
    expect(await slice('1) un\n   * puce')).toEqual([
      {
        flavour: 'affine:list',
        type: 'numbered',
        text: 'un',
        children: [{ flavour: 'affine:list', type: 'bulleted', text: 'puce' }],
      },
    ]);
  });

  test('indented plain text still keeps its spaces, never a code block', async () => {
    expect(await slice('aaa\n\n    bbb\n\n *emphasis* kept')).toEqual([
      { flavour: 'affine:paragraph', type: 'text', text: 'aaa' },
      { flavour: 'affine:paragraph', type: 'text', text: '    bbb' },
      { flavour: 'affine:paragraph', type: 'text', text: ' emphasis kept' },
    ]);
  });
});

async function importWithAsset(markdown: string): Promise<Shape[]> {
  const blobCRUD = new MemoryBlobCRUD();
  await blobCRUD.set('blob-a', new Blob());
  const assets = new AssetsManager({ blob: blobCRUD });
  assets.getPathBlobIdMap().set('assets/a.png', 'blob-a');
  const snapshot = await new MarkdownAdapter(
    createJob(),
    provider
  ).toBlockSnapshot({
    file: markdown,
    assets,
  });
  return snapshot.children.map(shape);
}

describe('standalone image (#521)', () => {
  // mdast wraps a lone image in a paragraph; the paragraph matcher used to
  // open an empty `affine:paragraph` above the image block.
  test('emits the image block alone, no empty paragraph', async () => {
    expect(
      await importWithAsset('Texte avant\n\n![schéma](assets/a.png)\n\nAprès')
    ).toEqual([
      { flavour: 'affine:paragraph', type: 'text', text: 'Texte avant' },
      { flavour: 'affine:image' },
      { flavour: 'affine:paragraph', type: 'text', text: 'Après' },
    ]);
  });

  test('two images on consecutive lines are two blocks and nothing else', async () => {
    expect(
      await importWithAsset('![a](assets/a.png)\n![b](assets/a.png)')
    ).toEqual([{ flavour: 'affine:image' }, { flavour: 'affine:image' }]);
  });
});

describe('image-only paragraph in every shape the workspace connector writes', () => {
  // #521 (PR #538) handled a bare image only. A linked image, images split by
  // a hard break, and an image in a list item or a quote still went wrong:
  // an empty paragraph above the image, or the image dropped with the list
  // item's or the quote's skipped paragraph.
  test('a linked image is the image block alone (the href is dropped)', async () => {
    expect(
      await importWithAsset('[![a](assets/a.png)](https://x.test)')
    ).toEqual([{ flavour: 'affine:image' }]);
  });

  test('images split by a hard line break are two image blocks', async () => {
    expect(
      await importWithAsset('![a](assets/a.png)  \n![b](assets/a.png)')
    ).toEqual([{ flavour: 'affine:image' }, { flavour: 'affine:image' }]);
  });

  test('an image list item keeps the image as a child of the list block', async () => {
    expect(await importWithAsset('- ![a](assets/a.png)')).toEqual([
      {
        flavour: 'affine:list',
        type: 'bulleted',
        text: '',
        children: [{ flavour: 'affine:image' }],
      },
    ]);
  });

  test('a list item with text then an image keeps both', async () => {
    expect(await importWithAsset('- Item\n\n  ![a](assets/a.png)')).toEqual([
      {
        flavour: 'affine:list',
        type: 'bulleted',
        text: 'Item',
        children: [{ flavour: 'affine:image' }],
      },
    ]);
  });

  test('a quote with an image keeps its text and puts the image after it', async () => {
    const [quote, image, ...rest] = await importWithAsset(
      '> Quote\n> ![a](assets/a.png)'
    );
    expect(quote.flavour).toBe('affine:paragraph');
    expect(quote.type).toBe('quote');
    expect(quote.text?.trim()).toBe('Quote');
    expect(image).toEqual({ flavour: 'affine:image' });
    expect(rest).toEqual([]);
  });

  test('a quote without an image still reads as one quote', async () => {
    // Pins the path this change leaves alone (children skipped). The joined
    // text is the existing flattening of a multi-paragraph quote, not new.
    expect(await importWithAsset('> Quote\n>\n> Second')).toEqual([
      { flavour: 'affine:paragraph', type: 'quote', text: 'QuoteSecond' },
    ]);
  });
});
