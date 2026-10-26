/**
 * Guard for the two causes of the quadratic store open of issue #507
 * (ADR 0041).
 *
 * 1. `DocCRUD.root` scanned every block and `getParent` walked the tree from
 *    the root on every call, so a store opened with a query that can hide
 *    blocks (`viewType: 'hidden'`, which climbs the ancestors of every block)
 *    was quadratic. #508 only skipped that climb for queries that cannot hide
 *    anything. The parent index answers both in constant time and is rebuilt
 *    after any structural change.
 * 2. `Store` copied its whole blocks record once per added block, quadratic
 *    under ANY query with real string ids (integer-like ids take a V8 fast
 *    path, which hid it from every earlier bench). The init loop and a
 *    multi-block transaction now assign the record once.
 *
 * What this spec would have caught:
 * - the #507 load itself: 2000 string-id blocks took 7.5 s under a hidden
 *   query and 1.26 s under the default one; 640 ms with the index alone;
 *   25 to 92 ms with both fixes (each budget test fails if either fix is
 *   reverted, measured);
 * - a batch that notifies `store.blocks` per block, or hides a block from
 *   the store's own reads (`getBlock`, `hasBlock`) during its `add`;
 * - a stale index: the answers are compared with the former scan + DFS, kept
 *   below as the oracle, after random adds, moves, deletes and undos, inside
 *   the mutating transaction (the mutators drop the index themselves) and
 *   after it, and after a REMOTE update applied with `Y.applyUpdate` from a
 *   second doc, which no mutator of this store sees;
 * - a mutator that leaves behind an index cached from a half-written tree
 *   (the check inside the transaction, before `beforeObserverCalls`);
 * - the stack overflow the former DFS hit on a cycle in `sys:children`;
 * - a disposed `DocCRUD` answering from a frozen index.
 */
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import type { YBlock } from '../model/block/types.js';
import type { Query } from '../model/index.js';
import { DocCRUD } from '../model/store/crud.js';
import { Schema } from '../schema/schema.js';
import { createAutoIncrementIdGenerator } from '../test/index.js';
import { TestWorkspace } from '../test/test-workspace.js';
import {
  ListBlockSchemaExtension,
  NoteBlockSchema,
  NoteBlockSchemaExtension,
  ParagraphBlockSchema,
  ParagraphBlockSchemaExtension,
  RootBlockSchema,
  RootBlockSchemaExtension,
} from './test-schema.js';

type YBlocks = Y.Map<YBlock>;

function createSchema() {
  const schema = new Schema();
  schema.register([RootBlockSchema, NoteBlockSchema, ParagraphBlockSchema]);
  return schema;
}

function createPeer(schema = createSchema()) {
  const doc = new Y.Doc();
  const yBlocks = doc.getMap('blocks') as YBlocks;
  return { doc, yBlocks, crud: new DocCRUD(yBlocks, schema) };
}

// The pre-#507 `root` getter and `getParent`, in substance: the oracle the
// index must agree with.
function oracleRoot(yBlocks: YBlocks) {
  let root: string | null = null;
  yBlocks.forEach(yBlock => {
    if (yBlock.get('sys:flavour') === 'affine:page') {
      root = yBlock.get('sys:id') as string;
    }
  });
  return root;
}

function oracleParent(yBlocks: YBlocks, targetId: string): string | null {
  const root = oracleRoot(yBlocks);
  if (!root || root === targetId) return null;
  const findParent = (parentId: string): string | null => {
    const parent = yBlocks.get(parentId);
    if (!parent) return null;
    for (const childId of parent.get('sys:children').toArray()) {
      if (childId === targetId) return parentId;
      const found = findParent(childId);
      if (found != null) return found;
    }
    return null;
  };
  return findParent(root);
}

function expectAgreesWithOracle(crud: DocCRUD, yBlocks: YBlocks) {
  expect(crud.root).toBe(oracleRoot(yBlocks));
  const actual: Record<string, string | null> = {};
  const expected: Record<string, string | null> = {};
  yBlocks.forEach((_, id) => {
    actual[id] = crud.getParent(id);
    expected[id] = oracleParent(yBlocks, id);
  });
  expect(actual).toEqual(expected);
}

// Deterministic PRNG so a failure replays.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function subtree(yBlocks: YBlocks, id: string, into = new Set<string>()) {
  into.add(id);
  for (const child of yBlocks.get(id)?.get('sys:children').toArray() ?? []) {
    if (!into.has(child)) subtree(yBlocks, child, into);
  }
  return into;
}

function syncFrom(source: Y.Doc, target: Y.Doc) {
  Y.applyUpdate(
    target,
    Y.encodeStateAsUpdate(source, Y.encodeStateVector(target)),
    'remote'
  );
}

describe('DocCRUD parent index (#507)', () => {
  // 120 steps, each compared with an O(n²) oracle: about 0.2 s alone, over
  // the package's 500 ms default under a parallel run.
  test(
    'agrees with the former DFS through local, undone and remote edits',
    {
      timeout: 10_000,
    },
    () => {
      const random = mulberry32(507);
      const pick = <T>(items: T[]) =>
        items[Math.floor(random() * items.length)];
      const local = createPeer();
      const remote = createPeer();
      const undo = new Y.UndoManager(local.yBlocks);
      let nextId = 0;
      const ids = (yBlocks: YBlocks, flavours: string[]) =>
        [...yBlocks.keys()].filter(id =>
          flavours.includes(yBlocks.get(id)!.get('sys:flavour') as string)
        );

      local.doc.transact(() => {
        local.crud.addBlock('root', 'affine:page');
        local.crud.addBlock('note-a', 'affine:note', {}, 'root');
        local.crud.addBlock('note-b', 'affine:note', {}, 'root');
      });
      undo.clear();

      // Each step warms the index, edits, then checks inside the transaction
      // (before `beforeObserverCalls`) and after it.
      const step = (edit: () => void) => {
        expectAgreesWithOracle(local.crud, local.yBlocks);
        local.doc.transact(() => {
          edit();
          expectAgreesWithOracle(local.crud, local.yBlocks);
        });
        undo.stopCapturing();
        expectAgreesWithOracle(local.crud, local.yBlocks);
      };

      for (let i = 0; i < 120; i++) {
        const roll = random();
        const containers = ids(local.yBlocks, [
          'affine:note',
          'affine:paragraph',
        ]);
        const paragraphs = ids(local.yBlocks, ['affine:paragraph']);

        if (roll < 0.4 || paragraphs.length < 3) {
          const parent = pick(containers);
          const size = local.yBlocks.get(parent)!.get('sys:children').length;
          step(() =>
            local.crud.addBlock(
              `p${nextId++}`,
              'affine:paragraph',
              {},
              parent,
              Math.floor(random() * (size + 1))
            )
          );
        } else if (roll < 0.6) {
          const moved = pick(paragraphs);
          const inside = subtree(local.yBlocks, moved);
          const target = pick(containers.filter(id => !inside.has(id)));
          step(() => local.crud.moveBlocks([moved], target));
        } else if (roll < 0.7) {
          const deleted = pick(paragraphs);
          step(() => local.crud.deleteBlock(deleted));
        } else if (roll < 0.8) {
          expectAgreesWithOracle(local.crud, local.yBlocks);
          undo.undo();
          expectAgreesWithOracle(local.crud, local.yBlocks);
        } else {
          // A peer moves or adds a block; this store only sees the update.
          syncFrom(local.doc, remote.doc);
          const theirs = ids(remote.yBlocks, ['affine:paragraph']);
          const moved = pick(theirs);
          const inside = subtree(remote.yBlocks, moved);
          const target = pick(
            ids(remote.yBlocks, ['affine:note', 'affine:paragraph']).filter(
              id => !inside.has(id)
            )
          );
          if (random() < 0.5) remote.crud.moveBlocks([moved], target);
          else
            remote.crud.addBlock(
              `r${nextId++}`,
              'affine:paragraph',
              {},
              target
            );
          expectAgreesWithOracle(local.crud, local.yBlocks);
          syncFrom(remote.doc, local.doc);
          expectAgreesWithOracle(local.crud, local.yBlocks);
        }
      }
    }
  );

  test('a remote move is seen by a warm index', () => {
    const local = createPeer();
    const remote = createPeer();
    local.crud.addBlock('root', 'affine:page');
    local.crud.addBlock('note-a', 'affine:note', {}, 'root');
    local.crud.addBlock('note-b', 'affine:note', {}, 'root');
    local.crud.addBlock('p', 'affine:paragraph', {}, 'note-a');
    syncFrom(local.doc, remote.doc);
    expect(local.crud.getParent('p')).toBe('note-a');

    remote.crud.moveBlocks(['p'], 'note-b');
    syncFrom(remote.doc, local.doc);

    expect(local.crud.getParent('p')).toBe('note-b');
  });

  test('a block listed twice keeps its first parent, a cycle ends', () => {
    const { crud, yBlocks } = createPeer();
    crud.addBlock('root', 'affine:page');
    crud.addBlock('note-a', 'affine:note', {}, 'root');
    crud.addBlock('note-b', 'affine:note', {}, 'root');
    crud.addBlock('p', 'affine:paragraph', {}, 'note-a');
    crud.addBlock('q', 'affine:paragraph', {}, 'p');
    crud.updateBlockChildren('note-b', ['p']);
    expectAgreesWithOracle(crud, yBlocks);
    expect(crud.getParent('p')).toBe('note-a');

    // The former DFS overflowed the stack here; the index stops.
    crud.updateBlockChildren('q', ['p', 'root']);
    expect(crud.getParent('p')).toBe('note-a');
    expect(crud.getParent('q')).toBe('p');
    expect(crud.getParent('root')).toBeNull();
  });

  test('a disposed index still answers, from the current tree', () => {
    // A remote update, because the local mutators drop the index anyway: once
    // the listener is gone, only "never cache" keeps the answer fresh.
    const local = createPeer();
    const remote = createPeer();
    local.crud.addBlock('root', 'affine:page');
    local.crud.addBlock('note-a', 'affine:note', {}, 'root');
    local.crud.addBlock('note-b', 'affine:note', {}, 'root');
    local.crud.addBlock('p', 'affine:paragraph', {}, 'note-a');
    syncFrom(local.doc, remote.doc);
    local.crud.dispose();
    expect(local.crud.getParent('p')).toBe('note-a');

    remote.crud.moveBlocks(['p'], 'note-b');
    syncFrom(remote.doc, local.doc);

    expect(local.crud.getParent('p')).toBe('note-b');
  });
});

describe('opening a large store (#507)', () => {
  const extensions = [
    RootBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
    ListBlockSchemaExtension,
    NoteBlockSchemaExtension,
  ];
  const hidden: Query = {
    mode: 'loose',
    match: [{ flavour: 'affine:note', viewType: 'hidden' }],
  };

  // Written through `DocCRUD` on a bare Y.Doc: building through a store
  // would cost more than the load being measured. String ids, as in a real
  // document: integer-like ids take a V8 fast path when the blocks record is
  // copied, which hid the second quadratic cost (one copy per block).
  function documentOf(count: number) {
    const { doc, crud } = createPeer();
    crud.addBlock('root', 'affine:page');
    crud.addBlock('note', 'affine:note', {}, 'root');
    for (let i = 0; i < count; i++) {
      crud.addBlock(`p${i}`, 'affine:paragraph', {}, 'note');
    }
    return Y.encodeStateAsUpdate(doc);
  }

  function emptyDoc() {
    const workspace = new TestWorkspace({
      id: 'scaling',
      idGenerator: createAutoIncrementIdGenerator(),
    });
    workspace.meta.initialize();
    return workspace.createDoc('home');
  }

  function bestOpenMs(update: Uint8Array, query?: Query, samples = 3) {
    let best = Infinity;
    for (let i = 0; i < samples; i++) {
      const doc = emptyDoc();
      Y.applyUpdate(doc.spaceDoc, update);
      const start = performance.now();
      const store = doc.getStore({ extensions, query });
      store.load();
      best = Math.min(best, performance.now() - start);
      expect(store.getBlock('note')?.blockViewType).toBe(
        query ? 'bypass' : 'display'
      );
      expect(store.getBlock('p0')?.blockViewType).toBe('display');
    }
    return best;
  }

  // ponytail: absolute budgets, not the t(2000)/t(500) ratio, because a ratio
  // of two short timings flips under a parallel run (the flaky benches of
  // docs/lessons.md). Measured alone, best of 3, 2000 string-id blocks
  // (default / hidden): 1.26 s / 7.5 s before #507; 640 ms / 630 ms with the
  // parent index alone; 25 to 92 ms with the batched blocks record too. 300 ms
  // is three times the worst sample and half the index-only time, so it fails
  // if either fix regresses. Both timings go in the message to read on a
  // failure (linear is about x4 from 500 to 2000, quadratic x16); rerun a
  // failure alone before calling it a regression.
  const BUDGET_MS = 300;

  test(
    '2000 blocks under a hidden-view query open within budget',
    {
      timeout: 20_000,
    },
    () => {
      const small = bestOpenMs(documentOf(500), hidden);
      const large = bestOpenMs(documentOf(2000), hidden);
      expect(
        large,
        `2000 blocks: ${large.toFixed(1)} ms, 500 blocks: ${small.toFixed(1)} ms`
      ).toBeLessThan(BUDGET_MS);
    }
  );

  test(
    '2000 blocks under the default query open within budget',
    {
      timeout: 20_000,
    },
    () => {
      const small = bestOpenMs(documentOf(500));
      const large = bestOpenMs(documentOf(2000));
      expect(
        large,
        `2000 blocks: ${large.toFixed(1)} ms, 500 blocks: ${small.toFixed(1)} ms`
      ).toBeLessThan(BUDGET_MS);
    }
  );

  test('a transaction of many blocks notifies `blocks` once, each block on its own `add`', () => {
    const doc = emptyDoc();
    doc.load();
    const store = doc.getStore({ extensions });
    let notified = 0;
    const unsubscribe = store.blocks.subscribe(() => notified++);
    notified = 0;
    const seen: string[] = [];
    const subscription = store.slots.blockUpdated.subscribe(payload => {
      if (payload.type !== 'add') return;
      // The store answers for the block from its own `add`, mid-batch.
      expect(store.getBlock(payload.id)?.model).toBe(payload.model);
      expect(store.hasBlock(payload.id)).toBe(true);
      seen.push(payload.id);
    });

    Y.applyUpdate(doc.spaceDoc, documentOf(50), 'remote');

    subscription.unsubscribe();
    unsubscribe();
    expect(seen).toHaveLength(52);
    expect(notified).toBe(1);
    expect(Object.keys(store.blocks.peek())).toHaveLength(52);
    expect(store.getParent('p49')?.id).toBe('note');
  });
});
