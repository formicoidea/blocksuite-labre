/**
 * ADR 0043 — the simple table's header row and header column through the
 * Markdown and HTML adapters.
 *
 * Would have caught:
 * - a GFM table imported without `headerRow`: GFM always has a header row, and
 *   folding it into an ordinary row lost it;
 * - an HTML `thead` read as an ordinary row, or a body row opening on a `th`
 *   (a header column) losing that cell, since only `td` were read;
 * - the HTML export writing every row in a `tbody` of `td` whatever the flags,
 *   or a table without the flags exporting anything but what it did before;
 * - the Markdown export changing with the flag (GFM always writes row 0 as the
 *   header).
 */
import { HtmlAdapter, MarkdownAdapter } from '@labre/affine-shared/adapters';
import type { BlockSnapshot } from '@labre/store';
import { describe, expect, test } from 'vitest';

import { createJob } from '../utils/create-job.js';
import { getProvider } from '../utils/get-provider.js';

const provider = getProvider();

type TableProps = {
  headerRow?: true;
  headerColumn?: true;
  cells: Record<string, { text: { delta: { insert: string }[] } }>;
};

function tableOf(block: BlockSnapshot): TableProps {
  const table = [block]
    .flatMap(function all(b): BlockSnapshot[] {
      return [b, ...b.children.flatMap(all)];
    })
    .find(b => b.flavour === 'affine:table');
  if (!table) throw new Error('no table block');
  return table.props as unknown as TableProps;
}

const cellTexts = (props: TableProps) =>
  Object.values(props.cells)
    .map(cell => cell.text.delta.map(op => op.insert).join(''))
    .sort();

const text = (insert: string) => ({
  text: { '$blocksuite:internal:text$': true, delta: [{ insert }] },
});

/** A 2×2 table snapshot: header words in row 0 and column 0. */
function tableSnapshot(flags: Partial<TableProps> = {}): BlockSnapshot {
  return {
    type: 'block',
    id: 'table',
    flavour: 'affine:table',
    props: {
      rows: {
        r0: { rowId: 'r0', order: 'a0' },
        r1: { rowId: 'r1', order: 'a1' },
      },
      columns: {
        c0: { columnId: 'c0', order: 'a0' },
        c1: { columnId: 'c1', order: 'a1' },
      },
      cells: {
        'r0:c0': text('Role'),
        'r0:c1': text('Owner'),
        'r1:c0': text('Approve'),
        'r1:c1': text('Ana'),
      },
      ...flags,
    },
    children: [],
  };
}

async function fromMarkdown(markdown: string) {
  const adapter = new MarkdownAdapter(createJob(), provider);
  const snapshot = await adapter.toBlockSnapshot({ file: markdown });
  if (!snapshot) throw new Error('nothing imported');
  return tableOf(snapshot);
}

async function fromHtml(html: string) {
  const adapter = new HtmlAdapter(createJob(), provider);
  const snapshot = await adapter.toBlockSnapshot({ file: html });
  if (!snapshot) throw new Error('nothing imported');
  return tableOf(snapshot);
}

async function toHtml(snapshot: BlockSnapshot) {
  const adapter = new HtmlAdapter(createJob(), provider);
  return (await adapter.fromBlockSnapshot({ snapshot })).file;
}

async function toMarkdown(snapshot: BlockSnapshot) {
  const adapter = new MarkdownAdapter(createJob(), provider);
  return (await adapter.fromBlockSnapshot({ snapshot })).file;
}

describe('table header: Markdown', () => {
  test('an imported GFM table has a header row', async () => {
    const props = await fromMarkdown('| a | b |\n| --- | --- |\n| c | d |\n');
    expect(props.headerRow).toBe(true);
    expect(props.headerColumn).toBeUndefined();
  });

  test('the export does not depend on the flags', async () => {
    const plain = await toMarkdown(tableSnapshot());
    const flagged = await toMarkdown(
      tableSnapshot({ headerRow: true, headerColumn: true })
    );
    expect(flagged).toBe(plain);
    expect(plain).toContain('| Role');
  });
});

describe('table header: HTML import', () => {
  test('a thead is a header row', async () => {
    const props = await fromHtml(
      '<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>c</td><td>d</td></tr></tbody></table>'
    );
    expect(props.headerRow).toBe(true);
    expect(props.headerColumn).toBeUndefined();
    expect(cellTexts(props)).toEqual(['a', 'b', 'c', 'd']);
  });

  test('a table without thead has no header', async () => {
    const props = await fromHtml(
      '<table><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>'
    );
    expect(props).not.toHaveProperty('headerRow');
    expect(props).not.toHaveProperty('headerColumn');
  });

  test('a body whose rows open on a th is a header column, and keeps it', async () => {
    const props = await fromHtml(
      '<table><tbody><tr><th>a</th><td>b</td></tr><tr><th>c</th><td>d</td></tr></tbody></table>'
    );
    expect(props.headerColumn).toBe(true);
    expect(props).not.toHaveProperty('headerRow');
    expect(cellTexts(props)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('table header: HTML export', () => {
  test('without the flags, every cell stays a td in a tbody', async () => {
    const html = await toHtml(tableSnapshot());
    expect(html).not.toContain('<thead');
    expect(html).not.toContain('<th');
    expect(html).toContain('<tbody>');
  });

  test('a header row is a thead of th, a header column opens rows on a th', async () => {
    const html = await toHtml(
      tableSnapshot({ headerRow: true, headerColumn: true })
    );
    expect(html).toMatch(
      /<thead><tr><th>.*Role.*<\/th><th>.*Owner.*<\/th><\/tr><\/thead>/
    );
    expect(html).toMatch(
      /<tbody><tr><th>.*Approve.*<\/th><td>.*Ana.*<\/td><\/tr><\/tbody>/
    );
  });

  test('an exported header survives a round trip', async () => {
    const props = await fromHtml(
      await toHtml(tableSnapshot({ headerRow: true, headerColumn: true }))
    );
    expect(props.headerRow).toBe(true);
    expect(props.headerColumn).toBe(true);
    expect(cellTexts(props)).toEqual(['Ana', 'Approve', 'Owner', 'Role']);
  });
});
