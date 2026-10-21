/**
 * Guard for issue #507: opening a store was quadratic in the number of blocks.
 *
 * Every block added to a store runs its query (`runQuery`, `model/store/query.ts`),
 * which used to walk the block's ancestors to un-hide a hidden one. Each step
 * of that walk is a `Store.getParent`, and `DocCRUD.getParent` is O(n): it
 * scans every block to find the root, then searches the tree from it. With
 * about three `getParent` calls per block, opening a 2000-block document made
 * 6017 of them and took 3.3 s (9.8 s for 3000 blocks) in the 0.55.0 bundle.
 *
 * With the default query (`mode: 'loose'`, empty `match`), and more generally
 * with any loose query that has no `viewType: 'hidden'` entry, no block can
 * be hidden, so the walk can never change anything and is skipped. This spec
 * would have caught the walk running on every block of a default store: it
 * counts `getParent` calls while a store opens on an existing document.
 *
 * A store opened with a query that can hide blocks still walks, and is still
 * quadratic; the second half of this spec pins that the walk keeps un-hiding
 * ancestors there, so the guard is not widened past what it can prove.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';

import { Store } from '../model/index.js';
import { createAutoIncrementIdGenerator } from '../test/index.js';
import { TestWorkspace } from '../test/test-workspace.js';
import {
  ListBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from './test-schema.js';

const extensions = [
  RootBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  ListBlockSchemaExtension,
  NoteBlockSchemaExtension,
];

const BLOCK_COUNT = 500;

function createDocWithParagraphs(count: number) {
  const collection = new TestWorkspace({
    id: 'test-collection',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  collection.meta.initialize();
  const doc = collection.createDoc('home');
  doc.load();
  const writer = doc.getStore({ extensions });
  const page = writer.addBlock('affine:page');
  const note = writer.addBlock('affine:note', {}, page);
  const paragraphs: string[] = [];
  for (let i = 0; i < count; i++) {
    paragraphs.push(writer.addBlock('affine:paragraph', {}, note));
  }
  return { doc, page, note, paragraphs };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loading a store (#507)', () => {
  test('the default query never walks ancestors while blocks load', () => {
    const { doc, paragraphs } = createDocWithParagraphs(BLOCK_COUNT);
    const getParent = vi.spyOn(Store.prototype, 'getParent');

    // `readonly` forces a new store, so every existing block goes through
    // `_onBlockAdded` with the default query.
    const reader = doc.getStore({ extensions, readonly: true });

    // Compare the count, not the mock: a failing mock matcher pretty-prints
    // every recorded BlockModel argument and runs out of memory.
    expect(getParent.mock.calls.length).toBe(0);
    expect(reader.getBlock(paragraphs[0]!)?.blockViewType).toBe('display');
    expect(reader.blockSize).toBe(BLOCK_COUNT + 2);
  });

  test('a loose query without a hidden entry does not walk either', () => {
    const { doc, paragraphs } = createDocWithParagraphs(BLOCK_COUNT);
    const getParent = vi.spyOn(Store.prototype, 'getParent');

    const reader = doc.getStore({
      extensions,
      query: {
        mode: 'loose',
        match: [{ flavour: 'affine:paragraph', viewType: 'bypass' }],
      },
    });

    // Compare the count, not the mock: a failing mock matcher pretty-prints
    // every recorded BlockModel argument and runs out of memory.
    expect(getParent.mock.calls.length).toBe(0);
    expect(reader.getBlock(paragraphs[0]!)?.blockViewType).toBe('bypass');
  });

  test('a loose query that hides a block still un-hides its ancestors', () => {
    const { doc, page, note, paragraphs } = createDocWithParagraphs(3);

    const reader = doc.getStore({
      extensions,
      query: {
        mode: 'loose',
        match: [{ flavour: 'affine:note', viewType: 'hidden' }],
      },
    });

    expect(reader.getBlock(page)?.blockViewType).toBe('display');
    expect(reader.getBlock(note)?.blockViewType).toBe('bypass');
    expect(reader.getBlock(paragraphs[0]!)?.blockViewType).toBe('display');
  });

  test('an include query shows the ancestors of what it matches', () => {
    const { doc, page, note, paragraphs } = createDocWithParagraphs(3);

    const reader = doc.getStore({
      extensions,
      query: {
        mode: 'include',
        match: [{ flavour: 'affine:paragraph', viewType: 'display' }],
      },
    });

    expect(reader.getBlock(page)?.blockViewType).toBe('display');
    expect(reader.getBlock(note)?.blockViewType).toBe('display');
    expect(reader.getBlock(paragraphs[0]!)?.blockViewType).toBe('display');
  });
});
