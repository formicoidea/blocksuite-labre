/**
 * Issue #729 (upstream toeverything/AFFiNE#14840): inserting a table from a
 * block that is not a direct child of the note.
 *
 * `insertTableBlockCommand` adds the table as a SIBLING of the selected
 * block. The table schema accepts only `affine:note` as parent, so from a
 * nested list item (parent `affine:list`), a nested paragraph or a paragraph
 * inside a callout the store refuses the block with a `SchemaValidateError`:
 * the slash-menu chain swallows the throw (`console.error`), and the user
 * sees nothing happen. The table belongs after the selected block's
 * note-level ancestor, and the empty line the slash menu leaves behind is
 * still the selected block's, not that ancestor's. A readonly store gets no
 * table at all (every mutation entry point checks `store.readonly` first).
 *
 * The command runs against a REAL store so the schema check is the real one.
 */
import {
  CalloutBlockSchemaExtension,
  ListBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
  TableBlockSchemaExtension,
} from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, it, vi } from 'vitest';

import { insertTableBlockCommand } from '../commands.js';

let seq = 0;

function createStore(): Store {
  const workspace = new TestWorkspace({ id: `insert-table-${seq++}` });
  workspace.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
    ListBlockSchemaExtension,
    CalloutBlockSchemaExtension,
    TableBlockSchemaExtension,
  ];
  workspace.meta.initialize();
  return workspace.createDoc().getStore();
}

function insertAfter(store: Store, selectedId: string) {
  const selected = store.getBlock(selectedId)?.model;
  if (!selected) throw new Error(`no block ${selectedId}`);
  const next = vi.fn();
  type Ctx = Parameters<typeof insertTableBlockCommand>[0];
  insertTableBlockCommand(
    {
      std: { store } as unknown as BlockStdScope,
      selectedModels: [selected],
      place: 'after',
      removeEmptyLine: true,
    } as Ctx,
    next
  );
  return next.mock.calls[0]?.[0]?.insertedTableBlockId as string | undefined;
}

const childIds = (store: Store, id: string) =>
  store.getBlock(id)?.model.children.map(child => child.id) ?? [];

describe('insert a table from a nested block (#729)', () => {
  it('inserts after a top-level list item (control)', () => {
    const store = createStore();
    let note = '';
    let item = '';
    store.load(() => {
      const root = store.addBlock('affine:page', { title: new Text('') });
      note = store.addBlock('affine:note', {}, root);
      item = store.addBlock(
        'affine:list',
        { type: 'bulleted', text: new Text('item') },
        note
      );
    });

    const table = insertAfter(store, item);

    expect(table).toBeDefined();
    expect(childIds(store, note)).toEqual([item, table]);
  });

  it.each([
    { kind: 'empty', text: '', keptChildren: 0 },
    { kind: 'non-empty', text: 'child', keptChildren: 1 },
  ])(
    'inserts after the top-level list from a nested list item that is $kind',
    ({ text, keptChildren }) => {
      const store = createStore();
      let note = '';
      let outer = '';
      let inner = '';
      store.load(() => {
        const root = store.addBlock('affine:page', { title: new Text('') });
        note = store.addBlock('affine:note', {}, root);
        outer = store.addBlock(
          'affine:list',
          { type: 'bulleted', text: new Text('outer') },
          note
        );
        inner = store.addBlock(
          'affine:list',
          { type: 'bulleted', text: new Text(text) },
          outer
        );
      });

      const table = insertAfter(store, inner);

      expect(table).toBeDefined();
      expect(childIds(store, note)).toEqual([outer, table]);
      expect(childIds(store, outer)).toHaveLength(keptChildren);
    }
  );

  it('inserts after the callout from a paragraph inside it', () => {
    const store = createStore();
    let note = '';
    let callout = '';
    let inside = '';
    store.load(() => {
      const root = store.addBlock('affine:page', { title: new Text('') });
      note = store.addBlock('affine:note', {}, root);
      callout = store.addBlock('affine:callout', {}, note);
      inside = store.addBlock(
        'affine:paragraph',
        { text: new Text('inside') },
        callout
      );
    });

    const table = insertAfter(store, inside);

    expect(table).toBeDefined();
    expect(childIds(store, note)).toEqual([callout, table]);
    expect(childIds(store, callout)).toEqual([inside]);
  });

  it('inserts nothing in a readonly store', () => {
    const store = createStore();
    let note = '';
    let item = '';
    store.load(() => {
      const root = store.addBlock('affine:page', { title: new Text('') });
      note = store.addBlock('affine:note', {}, root);
      item = store.addBlock('affine:paragraph', { text: new Text('') }, note);
    });
    store.readonly = true;

    const table = insertAfter(store, item);

    expect(table).toBeUndefined();
    expect(childIds(store, note)).toEqual([item]);
  });
});
