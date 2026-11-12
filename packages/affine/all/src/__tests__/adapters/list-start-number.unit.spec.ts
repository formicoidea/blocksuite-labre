/**
 * Why this spec exists: a numbered list that does not start at 1 (it
 * continues after a paragraph or a code block, or was typed as `3.`) keeps
 * its start number in the `order` prop of its first `affine:list` block.
 * The Markdown and HTML imports already read the start number into `order`,
 * but both exports dropped it, so an exported list restarted at 1 and an
 * export then import round trip lost the numbering (issue #658, upstream
 * toeverything/AFFiNE#15726). The clipboard's `text/html` copy goes through
 * the same HTML adapter.
 *
 * A list starting at 1, or with no `order` at all, must export exactly as
 * before: no `start` attribute and no change for existing exports.
 */
import { DefaultTheme, NoteDisplayMode } from '@labre/affine-model';
import { HtmlAdapter, MarkdownAdapter } from '@labre/affine-shared/adapters';
import type { BlockSnapshot } from '@labre/store';
import { describe, expect, test } from 'vitest';

import { createJob } from '../utils/create-job.js';
import { getProvider } from '../utils/get-provider.js';

const provider = getProvider();

const numbered = (text: string, order: number | null): BlockSnapshot => ({
  type: 'block',
  id: `list-${text}`,
  flavour: 'affine:list',
  props: {
    type: 'numbered',
    text: { '$blocksuite:internal:text$': true, delta: [{ insert: text }] },
    checked: false,
    collapsed: false,
    order,
  },
  children: [],
});

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

/** The list blocks of an imported note, as `[text, order]` pairs. */
function listOrders(note: BlockSnapshot | undefined) {
  return (note?.children ?? [])
    .filter(block => block.flavour === 'affine:list')
    .map(block => {
      const props = block.props as {
        text: { delta: { insert: string }[] };
        order: number | null;
      };
      return [props.text.delta.map(op => op.insert).join(''), props.order];
    });
}

const continued = () =>
  noteWith(
    numbered('aaa', 1),
    paragraph('bbb'),
    numbered('ccc', 3),
    numbered('ddd', 4)
  );

describe('markdown export keeps the start number (#658)', () => {
  const exportMarkdown = async (snapshot: BlockSnapshot) =>
    (
      await new MarkdownAdapter(createJob(), provider).fromBlockSnapshot({
        snapshot,
      })
    ).file;

  test('a list starting at 3 exports as `3.`', async () => {
    expect(await exportMarkdown(continued())).toBe(
      '1. aaa\n\nbbb\n\n3. ccc\n4. ddd\n'
    );
  });

  test('a list starting at 1, with no order or a non-integer one exports unchanged', async () => {
    expect(
      await exportMarkdown(noteWith(numbered('aaa', 1), numbered('bbb', 2)))
    ).toBe('1. aaa\n2. bbb\n');
    expect(
      await exportMarkdown(
        noteWith(numbered('aaa', null), numbered('bbb', null))
      )
    ).toBe('1. aaa\n2. bbb\n');
    expect(await exportMarkdown(noteWith(numbered('aaa', 2.5)))).toBe(
      '1. aaa\n'
    );
  });

  test('export then import keeps the 3', async () => {
    const file = await exportMarkdown(continued());
    const imported = await new MarkdownAdapter(
      createJob(),
      provider
    ).toBlockSnapshot({ file });
    expect(listOrders(imported)).toEqual([
      ['aaa', 1],
      ['ccc', 3],
      ['ddd', 4],
    ]);
  });
});

describe('html export keeps the start number (#658)', () => {
  const exportHtml = async (snapshot: BlockSnapshot) =>
    (
      await new HtmlAdapter(createJob(), provider).fromBlockSnapshot({
        snapshot,
      })
    ).file;

  test('a list starting at 3 exports as `<ol start="3">`', async () => {
    const file = await exportHtml(continued());
    expect(file).toContain(
      '<ol class="numbered-list" start="3"><li class="affine-list-block-container">ccc</li><li class="affine-list-block-container">ddd</li></ol>'
    );
    expect(file).toContain(
      '<ol class="numbered-list"><li class="affine-list-block-container">aaa</li></ol>'
    );
  });

  test('a list starting at 1, with no order or a non-integer one has no start attribute', async () => {
    for (const order of [1, null, 2.5]) {
      const file = await exportHtml(noteWith(numbered('aaa', order)));
      expect(file).toContain('<ol class="numbered-list"><li');
      expect(file).not.toContain('start=');
    }
  });

  test('export then import keeps the 3', async () => {
    const file = await exportHtml(continued());
    const imported = await new HtmlAdapter(
      createJob(),
      provider
    ).toBlockSnapshot({ file });
    // An `<ol>` without `start` reads back with no order (the HTML import
    // only numbers a list that names its start); the list renders from 1.
    expect(listOrders(imported)).toEqual([
      ['aaa', null],
      ['ccc', 3],
      ['ddd', 4],
    ]);
  });
});
