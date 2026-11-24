/**
 * Issue #732 (upstream toeverything/AFFiNE#15819): a table cell whose `text`
 * is a plain string, or has no `text` at all, exports like a delta cell.
 *
 * `processTable` (`blocks/table/src/adapters/utils.ts`) hands `cell.text`
 * through as `{ delta }` without looking at it. The Markdown and plain-text
 * matchers then call `deltaToAST(cell.value.delta)`: `undefined.map` throws
 * for a string cell, and `undefined.delta` throws for a cell without text —
 * the whole doc export fails (`MarkdownTransformer.docFile` →
 * `page.export.markdown`), as does every copy as Markdown. The HTML matcher
 * already handles a string cell but not a cell without text.
 *
 * The store never writes such a cell itself (`TableDataManager` always gives a
 * `Text`); they come from a snapshot or a host write that skipped it. Reading
 * them is a read-path concern only: nothing here is written back.
 */
import {
  HtmlAdapter,
  MarkdownAdapter,
  PlainTextAdapter,
} from '@labre/affine-shared/adapters';
import type { BlockSnapshot } from '@labre/store';
import { describe, expect, test } from 'vitest';

import { createJob } from '../utils/create-job.js';
import { getProvider } from '../utils/get-provider.js';

const provider = getProvider();

const deltaText = (insert: string) => ({
  '$blocksuite:internal:text$': true,
  delta: insert ? [{ insert }] : [],
});

const tableSnapshot = (cells: Record<string, unknown>): BlockSnapshot => ({
  type: 'block',
  id: 'table',
  flavour: 'affine:table',
  props: {
    columns: {
      c1: { columnId: 'c1', order: 'a0' },
      c2: { columnId: 'c2', order: 'a1' },
    },
    rows: {
      r1: { rowId: 'r1', order: 'a0' },
      r2: { rowId: 'r2', order: 'a1' },
    },
    cells,
  },
  children: [],
});

const expectedSnapshot = tableSnapshot({
  'r1:c1': { text: deltaText('name') },
  'r1:c2': { text: deltaText('value') },
  'r2:c1': { text: deltaText('plain') },
  'r2:c2': { text: deltaText('') },
});

const stringAndMissing = tableSnapshot({
  'r1:c1': { text: deltaText('name') },
  'r1:c2': { text: deltaText('value') },
  'r2:c1': { text: 'plain' },
  'r2:c2': {},
});

const stringOnly = tableSnapshot({
  'r1:c1': { text: deltaText('name') },
  'r1:c2': { text: deltaText('value') },
  'r2:c1': { text: 'plain' },
  'r2:c2': { text: deltaText('') },
});

const missingOnly = tableSnapshot({
  'r1:c1': { text: deltaText('name') },
  'r1:c2': { text: deltaText('value') },
  'r2:c1': { text: deltaText('plain') },
  'r2:c2': {},
});

const adapters = [
  { name: 'markdown', Adapter: MarkdownAdapter },
  { name: 'plain text', Adapter: PlainTextAdapter },
  { name: 'html', Adapter: HtmlAdapter },
];

describe('table cells without a delta (#732)', () => {
  test.each(adapters)(
    'export to $name like delta cells when a cell text is a string',
    async ({ Adapter }) => {
      const adapter = new Adapter(createJob(), provider);
      const expected = await adapter.fromBlockSnapshot({
        snapshot: expectedSnapshot,
      });
      const target = await adapter.fromBlockSnapshot({ snapshot: stringOnly });
      expect(target.file).toContain('plain');
      expect(target.file).toBe(expected.file);
    }
  );

  test.each(adapters)(
    'export to $name like delta cells when a cell has no text',
    async ({ Adapter }) => {
      const adapter = new Adapter(createJob(), provider);
      const expected = await adapter.fromBlockSnapshot({
        snapshot: expectedSnapshot,
      });
      const target = await adapter.fromBlockSnapshot({ snapshot: missingOnly });
      expect(target.file).toBe(expected.file);
    }
  );

  test.each(adapters)(
    'export to $name with both kinds in one table',
    async ({ Adapter }) => {
      const adapter = new Adapter(createJob(), provider);
      const expected = await adapter.fromBlockSnapshot({
        snapshot: expectedSnapshot,
      });
      const target = await adapter.fromBlockSnapshot({
        snapshot: stringAndMissing,
      });
      expect(target.file).toBe(expected.file);
    }
  );
});
