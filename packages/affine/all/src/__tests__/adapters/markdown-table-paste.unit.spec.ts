/**
 * A GFM table read from Markdown — pasted as plain text (`MixTextAdapter`) or
 * imported (`MarkdownAdapter`) — becomes the inline table block, never a
 * database, and keeps every cell whole (labre REQ-IM-2, "no data loss").
 *
 * Would have caught:
 * - the database's Markdown matcher reading `table` nodes again: both matchers
 *   used to claim them, and only the database's empty `toBlockSnapshot` kept
 *   the paste from turning into a base;
 * - an image in a cell vanishing: no inline matcher turns an mdast `image`
 *   into a delta, so `![alt](url)` used to leave the cell empty;
 * - a cell losing an escape (`\|`, `\*`) or a row losing its extra cells.
 */
import { MarkdownAdapter, MixTextAdapter } from '@labre/affine-shared/adapters';
import type { BlockSnapshot } from '@labre/store';
import { describe, expect, test } from 'vitest';

import { createJob } from '../utils/create-job.js';
import { getProvider } from '../utils/get-provider.js';

const provider = getProvider();

type Delta = { insert: string; attributes?: Record<string, unknown> }[];
type TableProps = {
  columns: Record<string, { columnId: string; order: string }>;
  rows: Record<string, { rowId: string; order: string }>;
  cells: Record<string, { text: { delta: Delta } }>;
};

function flavours(block: BlockSnapshot): string[] {
  return [block.flavour, ...block.children.flatMap(flavours)];
}

function tableOf(blocks: BlockSnapshot[]): TableProps {
  const table = blocks
    .flatMap(function all(block): BlockSnapshot[] {
      return [block, ...block.children.flatMap(all)];
    })
    .find(block => block.flavour === 'affine:table');
  if (!table) throw new Error('no table block');
  return table.props as unknown as TableProps;
}

/** The cells' deltas, row by row, in display order. */
function grid(props: TableProps): Delta[][] {
  const byOrder = <T extends { order: string }>(items: T[]) =>
    items.sort((a, b) => a.order.localeCompare(b.order));
  const columns = byOrder(Object.values(props.columns));
  return byOrder(Object.values(props.rows)).map(row =>
    columns.map(
      column => props.cells[`${row.rowId}:${column.columnId}`]!.text.delta
    )
  );
}

const text = (delta: Delta) => delta.map(op => op.insert).join('');

const MARKDOWN = [
  '| Name | Note | Code |',
  '| :--- | ---: | :-: |',
  '| a \\| b | **bold** and \\*not\\* | `x \\| y` |',
  '| ![logo](https://example.com/logo.png) | ![](https://example.com/a.png) | ![bad](javascript:alert(1)) |',
  '| only |',
  '| 1 | 2 | 3 | extra |',
].join('\n');

async function pasted(markdown: string) {
  const adapter = new MixTextAdapter(createJob(), provider);
  const slice = await adapter.toSliceSnapshot({
    file: markdown,
    workspaceId: 'workspace',
    pageId: 'page',
  });
  if (!slice) throw new Error('nothing pasted');
  return slice.content;
}

describe('a Markdown table', () => {
  test('pasted, becomes one inline table and no database', async () => {
    const content = await pasted(MARKDOWN);
    const all = content.flatMap(flavours);
    expect(all.filter(flavour => flavour === 'affine:table')).toHaveLength(1);
    expect(all).not.toContain('affine:database');
  });

  test('imported, becomes an inline table and no database', async () => {
    const adapter = new MarkdownAdapter(createJob(), provider);
    const snapshot = await adapter.toBlockSnapshot({ file: MARKDOWN });
    expect(flavours(snapshot)).toContain('affine:table');
    expect(flavours(snapshot)).not.toContain('affine:database');
  });

  test('keeps every cell whole, escapes resolved', async () => {
    const cells = grid(tableOf(await pasted(MARKDOWN)));
    expect(cells.map(row => row.map(text))).toEqual([
      ['Name', 'Note', 'Code', ''],
      ['a | b', 'bold and *not*', 'x | y', ''],
      ['logo', 'https://example.com/a.png', 'bad', ''],
      ['only', '', '', ''],
      ['1', '2', '3', 'extra'],
    ]);
    expect(cells[1]![1]![0]).toEqual({
      insert: 'bold',
      attributes: { bold: true },
    });
    expect(cells[1]![2]).toEqual([
      { insert: 'x | y', attributes: { code: true } },
    ]);
  });

  test('keeps an image of a cell as a link to it, never an unsafe one', async () => {
    const [images] = grid(tableOf(await pasted(MARKDOWN))).slice(2);
    expect(images!.slice(0, 3)).toEqual([
      [
        {
          insert: 'logo',
          attributes: { link: 'https://example.com/logo.png' },
        },
      ],
      [
        {
          insert: 'https://example.com/a.png',
          attributes: { link: 'https://example.com/a.png' },
        },
      ],
      [{ insert: 'bad' }],
    ]);
  });
});
