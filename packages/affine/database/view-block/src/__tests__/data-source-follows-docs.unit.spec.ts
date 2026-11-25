/**
 * The data-view block's source follows the documents it reads, and lets
 * them go (#746, ADR 0057, amendment of 2026-11-25).
 *
 * `BlockQueryDataSource` reads the matching blocks of EVERY document of the
 * workspace from their default stores, subscribed once (`listenToDoc`). A
 * host closing one of those documents releases its default store: the
 * subscription then ended silently, the source never subscribed again (its
 * doc-list check saw the document still listed), and `blockMap` kept the
 * released store's `Block` objects, alive and frozen. It now follows each
 * document's default store (`followDefaultStore`): a released store's blocks
 * leave the rows, and come back from the new store when the document is
 * opened again.
 *
 * No block builds this source on render on this base (the data-view block
 * draws a placeholder, #754); its public `dataSource` getter still does.
 */
import {
  ListBlockSchemaExtension,
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import type { EditorHost } from '@labre/std';
import { type Store, Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test } from 'vitest';

import { BlockQueryDataSource } from '../data-source.js';
import {
  type DataViewBlockModel,
  DataViewBlockSchemaExtension,
} from '../data-view-model.js';

function setup() {
  const workspace = new TestWorkspace({
    id: 'data-source-follows-docs',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    ListBlockSchemaExtension,
    DataViewBlockSchemaExtension,
  ];
  workspace.meta.initialize();
  const host = workspace.createDoc('host').getStore();
  let viewId = '';
  host.load(() => {
    const root = host.addBlock('affine:page', {});
    const note = host.addBlock('affine:note', {}, root);
    viewId = host.addBlock('affine:data-view', {}, note);
  });
  const other = workspace.createDoc('other');
  const otherStore = other.getStore();
  let noteId = '';
  otherStore.load(() => {
    const root = otherStore.addBlock('affine:page', {});
    noteId = otherStore.addBlock('affine:note', {}, root);
  });
  const todoIn = (store: Store, text: string) =>
    store.addBlock(
      'affine:list',
      { type: 'todo', text: new Text(text) },
      noteId
    );
  const firstTodo = todoIn(otherStore, 'first');
  const source = new BlockQueryDataSource(
    { store: host } as unknown as EditorHost,
    host.getModelById(viewId) as DataViewBlockModel,
    { type: 'todo' }
  );
  return { workspace, other, otherStore, todoIn, firstTodo, source };
}

describe('the data-view source and the documents it reads (ADR 0057)', () => {
  test("a document closed: its blocks leave the rows, none of the released store's kept", () => {
    const { workspace, otherStore, firstTodo, source } = setup();
    try {
      expect(source.rows).toEqual([firstTodo]);

      otherStore.dispose();

      expect(source.rows).toEqual([]);
      const kept = [...source.blockMap.values()].filter(
        block => block.model.store === otherStore
      );
      expect(kept).toEqual([]);
    } finally {
      workspace.dispose();
    }
  });

  test('the document opened again: its blocks come back, live, from the new store', () => {
    const { workspace, other, otherStore, todoIn, firstTodo, source } = setup();
    try {
      otherStore.dispose();
      const reopened = other.getStore();
      reopened.load();

      expect(source.rows).toEqual([firstTodo]);
      expect(source.blockMap.get(firstTodo)?.model.store).toBe(reopened);
      const second = todoIn(reopened, 'second');
      expect(source.rows).toEqual([firstTodo, second]);
    } finally {
      workspace.dispose();
    }
  });
});
