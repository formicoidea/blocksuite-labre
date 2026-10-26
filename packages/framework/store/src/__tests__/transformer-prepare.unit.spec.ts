/**
 * `prepareSnapshotToBlock` + `insertPrepared` are `snapshotToBlock` in two
 * halves (ADR 0042). A canvas paste awaits every preparation first (blob
 * fetches, conversions), then writes every block in ONE synchronous
 * transaction, so the gesture is one undo step whatever the fetch took; before
 * the split, each pasted note was written after its own await and a slow blob
 * split the paste across several Ctrl+Z.
 *
 * Guards: the preparation writes nothing; the insertion runs inside a
 * caller's transaction (one update) and leaves the `afterImport` events to
 * `flushAfterImport`, since a model only exists once the transaction ends;
 * both halves together write what `snapshotToBlock` writes.
 */
import { describe, expect, test } from 'vitest';

import type { BlockModel } from '../model/index.js';
import { Text } from '../reactive/index.js';
import { createAutoIncrementIdGenerator } from '../test/index.js';
import { TestWorkspace } from '../test/test-workspace.js';
import type { TransformerMiddleware } from '../transformer/index.js';
import {
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from './test-schema.js';

const extensions = [
  RootBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
];

function setup() {
  const workspace = new TestWorkspace({
    id: 'test-collection',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  const open = (id: string) => {
    const doc = workspace.createDoc(id);
    const store = doc.getStore({ extensions });
    doc.load();
    store.addBlock('affine:page');
    return store;
  };

  const source = open('source');
  const noteId = source.addBlock('affine:note', {}, source.root!.id);
  source.addBlock('affine:paragraph', { text: new Text('first') }, noteId);
  source.addBlock('affine:paragraph', { text: new Text('second') }, noteId);
  const snapshot = source
    .getTransformer()
    .blockToSnapshot(source.getBlock(noteId)!.model)!;

  return { open, snapshot };
}

/** The written tree, ids and texts, read back from the models. */
function tree(model: BlockModel | null): unknown {
  if (!model) return null;
  const text = (model.props as { text?: { toString(): string } }).text;
  return {
    id: model.id,
    flavour: model.flavour,
    text: text?.toString(),
    children: model.children.map(tree),
  };
}

function recorder() {
  const events: string[] = [];
  const middleware: TransformerMiddleware = ({ slots }) => {
    slots.beforeImport.subscribe(payload => {
      if (payload.type === 'block')
        events.push(`before:${payload.snapshot.id}`);
    });
    slots.afterImport.subscribe(payload => {
      if (payload.type === 'block') events.push(`after:${payload.model.id}`);
    });
  };
  return { events, middleware };
}

describe('the transformer prepares, then inserts', () => {
  test('preparing writes nothing and imports nothing', async () => {
    const { open, snapshot } = setup();
    const target = open('target');
    const updates: Uint8Array[] = [];
    target.spaceDoc.on('update', update => updates.push(update));
    const { events, middleware } = recorder();

    const prepared = await target
      .getTransformer([middleware])
      .prepareSnapshotToBlock(snapshot, target.root!.id);

    expect(prepared?.id).toBe(snapshot.id);
    expect(updates).toHaveLength(0);
    expect(target.hasBlock(snapshot.id)).toBe(false);
    expect(events.filter(e => e.startsWith('after:'))).toEqual([]);
    expect(events.filter(e => e.startsWith('before:'))).toHaveLength(3);
  });

  test('inserting inside a transaction is one update; the flush imports', async () => {
    const { open, snapshot } = setup();
    const target = open('target');
    const { events, middleware } = recorder();
    const job = target.getTransformer([middleware]);
    const prepared = (await job.prepareSnapshotToBlock(
      snapshot,
      target.root!.id
    ))!;

    const updates: Uint8Array[] = [];
    target.spaceDoc.on('update', update => updates.push(update));
    let inserted: ReturnType<typeof job.insertPrepared>;
    target.transact(() => {
      inserted = job.insertPrepared(prepared, target);
      // The store creates the models when the transaction ends.
      expect(target.getBlock(prepared.id)).toBeUndefined();
    });

    expect(updates).toHaveLength(1);
    expect(events.filter(e => e.startsWith('after:'))).toEqual([]);

    const model = inserted!.flushAfterImport();
    expect(model?.id).toBe(prepared.id);
    expect(events.filter(e => e.startsWith('after:'))).toHaveLength(3);
  });

  test('both halves write what snapshotToBlock writes', async () => {
    const { open, snapshot } = setup();

    const viaSnapshot = open('via-snapshot');
    const expected = await viaSnapshot
      .getTransformer()
      .snapshotToBlock(
        structuredClone(snapshot),
        viaSnapshot,
        viaSnapshot.root!.id
      );

    const viaHalves = open('via-halves');
    const job = viaHalves.getTransformer();
    const prepared = (await job.prepareSnapshotToBlock(
      structuredClone(snapshot),
      viaHalves.root!.id
    ))!;
    const model = job.insertPrepared(prepared, viaHalves)!.flushAfterImport();

    expect(tree(model)).toEqual(tree(expected ?? null));
    expect((tree(model) as { children: unknown[] }).children).toHaveLength(2);
  });
});
