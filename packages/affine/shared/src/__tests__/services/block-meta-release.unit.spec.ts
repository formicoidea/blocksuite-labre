/**
 * The block-meta writer at a store's release (#746, ADR 0057, guard 7).
 *
 * `BlockMetaService` throttles local `blockUpdated` events per block for 30 s
 * with rxjs's default leading-edge-only `throttleTime`: the first event of a
 * window writes the meta at once, the others are dropped, none is deferred.
 * So an edit followed at once by `store.dispose()` must already have its meta
 * in Yjs, and the release must not lose anything (true before ADR 0057, held
 * from now on). What the throttle does hold is the store itself, through the
 * timer of the window, for up to 30 s after the last local edit: the release
 * must end it, so no timer keeps a disposed store.
 *
 * `load()` re-runs every extension's `loaded()`; the service subscribed once
 * per call (two throttled pipelines on a store loaded twice, whose identical
 * writes the props proxy happened to dedupe). It subscribes once now; the
 * last test holds that a reload adds no meta write.
 */
import {
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { BlockMetaService } from '../../services/block-meta-service.js';
import { FeatureFlagService } from '../../services/feature-flag-service.js';
import { WriterInfoServiceExtension } from '../../services/user-service/writer-info-service.js';

const WRITER = 'writer-1';
const NOTE_ID = 'note';
const PARAGRAPH_ID = 'paragraph';

function openStore() {
  const workspace = new TestWorkspace({
    id: 'block-meta-release',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  const store = workspace.createDoc('doc').getStore({
    extensions: [
      RootBlockSchemaExtension,
      NoteBlockSchemaExtension,
      ParagraphBlockSchemaExtension,
      FeatureFlagService,
      BlockMetaService,
      WriterInfoServiceExtension({ getWriterInfo: () => ({ id: WRITER }) }),
    ],
  });
  store.load(() => {
    const page = store.addBlock('affine:page', {});
    store.addBlock('affine:note', { id: NOTE_ID }, page);
  });
  store.get(FeatureFlagService).setFlag('enable_block_meta', true);
  return { workspace, store };
}

const yBlockOf = (store: ReturnType<typeof openStore>['store'], id: string) =>
  store.spaceDoc.getMap<Y.Map<unknown>>('blocks').get(id)!;

describe('BlockMetaService at release (ADR 0057, guard 7)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('a block added then the store disposed at once: its meta is in Yjs', () => {
    const { workspace, store } = openStore();
    try {
      store.addBlock(
        'affine:paragraph',
        { id: PARAGRAPH_ID, text: new Text('hi') },
        NOTE_ID
      );
      store.dispose();

      const yParagraph = yBlockOf(store, PARAGRAPH_ID);
      expect(yParagraph.get('prop:meta:createdBy')).toBe(WRITER);
      expect(typeof yParagraph.get('prop:meta:createdAt')).toBe('number');
    } finally {
      workspace.dispose();
    }
  });

  test('an edit then the store disposed at once: the edit and its meta are in Yjs', () => {
    const { workspace, store } = openStore();
    try {
      store.addBlock('affine:paragraph', { id: PARAGRAPH_ID }, NOTE_ID);
      store.updateBlock(PARAGRAPH_ID, { type: 'h1' });
      store.dispose();

      const yParagraph = yBlockOf(store, PARAGRAPH_ID);
      expect(yParagraph.get('prop:type')).toBe('h1');
      expect(yParagraph.get('prop:meta:updatedBy')).toBe(WRITER);
      expect(typeof yParagraph.get('prop:meta:updatedAt')).toBe('number');
    } finally {
      workspace.dispose();
    }
  });

  test('the release ends the throttle window: no timer keeps the store', () => {
    const { workspace, store } = openStore();
    try {
      // The workspace's awareness keeps its own interval.
      const idle = vi.getTimerCount();
      store.addBlock('affine:paragraph', { id: PARAGRAPH_ID }, NOTE_ID);
      store.updateBlock(PARAGRAPH_ID, { type: 'h2' });
      expect(vi.getTimerCount()).toBeGreaterThan(idle);

      store.dispose();

      expect(vi.getTimerCount()).toBe(idle);
    } finally {
      workspace.dispose();
    }
  });

  test('loading twice subscribes once: the meta is written once', () => {
    const { workspace, store } = openStore();
    try {
      store.load();
      const createdAtWrites: unknown[] = [];
      store.spaceDoc.getMap<Y.Map<unknown>>('blocks').observeDeep(events =>
        events.forEach(event => {
          const target = event.target;
          if (!(target instanceof Y.Map)) return;
          if (target.get('sys:id') !== PARAGRAPH_ID) return;
          if (event.keys.has('prop:meta:createdAt')) {
            createdAtWrites.push(target.get('prop:meta:createdAt'));
          }
        })
      );

      store.addBlock('affine:paragraph', { id: PARAGRAPH_ID }, NOTE_ID);

      expect(createdAtWrites).toHaveLength(1);
      store.dispose();
    } finally {
      workspace.dispose();
    }
  });
});
