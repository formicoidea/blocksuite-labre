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
 * - #519: the code preprocessor (slice level) rewriting the first leading
 *   space of every line to `&#x20;` except for `-` lines, so a `1.`, `*` or
 *   `+` sub-list stopped being a list item and folded into its parent's text.
 *   The rewrite itself is kept: it exists so plain text pasted as a slice
 *   keeps its leading spaces and never turns into an indented code block
 *   (BlockSuite #6017, the plain-text adapter).
 */
import { DefaultTheme, NoteDisplayMode } from '@labre/affine-model';
import { MarkdownAdapter } from '@labre/affine-shared/adapters';
import type { BlockSnapshot } from '@labre/store';
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
