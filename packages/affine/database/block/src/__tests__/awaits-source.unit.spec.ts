/**
 * GUARD — `awaitsSource` (ADR 0035 amendment of 2026-10-29): which database
 * a host that sets `requireSource` draws as an empty view offering a source,
 * instead of the native table.
 *
 * What it would have caught:
 * - a host that does not set it (absent, `false`, no picker at all) seeing
 *   anything but the 1.0 native database;
 * - a native database WITH rows hidden behind the empty view (documents
 *   render forever: the rule is about the creation gesture left unfinished,
 *   whose database is inserted rowless);
 * - a connected database (`externalSourceId`) drawn empty because its
 *   block has no row of its own, which a hosted source never has;
 * - a copy of a waiting block judged by anything but the block itself (a
 *   paste carries its props and children, so the copy waits too).
 */
import {
  DatabaseBlockSchemaExtension,
  type DatabaseBlockModel,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  DataSourcePickerProvider,
  type DataSourcePickerService,
  FeatureFlagService,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { describe, expect, test } from 'vitest';

import { awaitsSource } from '../linked-view.js';

function rowlessDatabase(): { store: Store; model: DatabaseBlockModel } {
  const collection = new TestWorkspace({ id: 'awaits-source' });
  collection.meta.initialize();
  const doc = collection.createDoc('doc0');
  doc.load();
  const store = doc.getStore({
    extensions: [
      RootBlockSchemaExtension,
      NoteBlockSchemaExtension,
      ParagraphBlockSchemaExtension,
      DatabaseBlockSchemaExtension,
      FeatureFlagService,
    ],
  });
  const rootId = store.addBlock('affine:page', { title: new Text('page') });
  const noteId = store.addBlock('affine:note', {}, rootId);
  const databaseId = store.addBlock('affine:database', {}, noteId);
  const model = store.getBlock(databaseId)!.model as DatabaseBlockModel;
  return { store, model };
}

function stdWith(picker: DataSourcePickerService | null): BlockStdScope {
  return {
    getOptional: (id: unknown) =>
      id === DataSourcePickerProvider ? picker : null,
  } as unknown as BlockStdScope;
}

const picker = (requireSource?: boolean): DataSourcePickerService => ({
  list: () => signal([]),
  requireSource,
});

describe('awaitsSource', () => {
  test('a rowless database with no source waits when the host requires one', () => {
    const { model } = rowlessDatabase();
    expect(awaitsSource(stdWith(picker(true)), model)).toBe(true);
  });

  test('a host that does not require one keeps the native database', () => {
    const { model } = rowlessDatabase();
    expect(awaitsSource(stdWith(picker()), model)).toBe(false);
    expect(awaitsSource(stdWith(picker(false)), model)).toBe(false);
    expect(awaitsSource(stdWith(null), model)).toBe(false);
  });

  test('a native database with rows renders them', () => {
    const { store, model } = rowlessDatabase();
    store.addBlock('affine:paragraph', {}, model.id);
    expect(awaitsSource(stdWith(picker(true)), model)).toBe(false);
  });

  test('a connected database never waits', () => {
    const { store, model } = rowlessDatabase();
    store.updateBlock(model, { externalSourceId: 'host:plan' });
    expect(awaitsSource(stdWith(picker(true)), model)).toBe(false);
  });
});
