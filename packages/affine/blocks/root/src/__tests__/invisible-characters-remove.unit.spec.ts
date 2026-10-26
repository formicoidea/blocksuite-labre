/**
 * `text.invisibles.remove` on a real document (the schemas it walks): what
 * an AI tool's watermark leaves in a paragraph, a title, a table cell and a
 * canvas label goes in ONE gesture that ONE undo puts back; code keeps its
 * characters; a read-only document is not touched; the toast and the
 * telemetry carry counts only, and a clean document reports nothing.
 *
 * It exists because the command deletes the user's characters: what it
 * reaches (a generic walk of every `Y.Text` under each block, the surface's
 * elements included) and what it spares are both pinned here.
 */
import {
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
} from '@labre/affine-block-surface';
import {
  CodeBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
  type ShapeElementModel,
  TableBlockSchemaExtension,
} from '@labre/affine-model';
import {
  NotificationProvider,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import type { BlockStdScope, CommandInvocation } from '@labre/std';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { invisibleCharactersCommands } from '../commands/invisible-characters-commands.js';

const ZWSP = '\u200B';
const WJ = '\u2060';

let seq = 0;

function createDoc() {
  const id = `invisibles-${seq++}`;
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = [
    RootBlockSchemaExtension,
    SurfaceBlockSchemaExtension,
    NoteBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
    CodeBlockSchemaExtension,
    TableBlockSchemaExtension,
  ];
  collection.meta.initialize();
  const store = collection.createDoc(id).getStore({ id });
  const ids = { paragraph: '', code: '', table: '', surface: '', shape: '' };
  store.load(() => {
    const rootId = store.addBlock('affine:page', {
      title: new Text(`Ti${ZWSP}tle`),
    });
    ids.surface = store.addBlock('affine:surface', {}, rootId);
    const noteId = store.addBlock('affine:note', {}, rootId);
    const text = new Text();
    text.yText.applyDelta([
      { insert: `wa${ZWSP}ter`, attributes: { bold: true } },
      { insert: `mark${WJ} 👩\u200D💻 Oui\u00A0!` },
    ]);
    ids.paragraph = store.addBlock('affine:paragraph', { text }, noteId);
    ids.code = store.addBlock(
      'affine:code',
      { text: new Text(`const s = '${ZWSP}';`) },
      noteId
    );
    ids.table = store.addBlock(
      'affine:table',
      {
        rows: { r: { rowId: 'r', order: 'a' } },
        columns: { c: { columnId: 'c', order: 'a' } },
        cells: { 'r:c': { text: new Text(`ce${ZWSP}ll`) } },
      },
      noteId
    );
  });
  const surface = store.getBlock(ids.surface)!.model as SurfaceBlockModel;
  ids.shape = surface.addElement({
    type: 'shape',
    xywh: '[0,0,100,100]',
    text: new Y.Text(`la${ZWSP}bel`),
  });
  store.resetHistory();
  return { store, surface, ids };
}

function textOf(store: Store, id: string): string {
  return (
    store.getBlock(id)!.model as unknown as { text: Text }
  ).text.toString();
}

function snapshot(
  store: Store,
  surface: SurfaceBlockModel,
  ids: ReturnType<typeof createDoc>['ids']
) {
  const table = store.getBlock(ids.table)!.model as unknown as {
    props: { cells: Record<string, { text: Text }> };
  };
  return {
    title: (
      store.root as unknown as { props: { title: Text } }
    ).props.title.toString(),
    paragraph: textOf(store, ids.paragraph),
    code: textOf(store, ids.code),
    cell: table.props.cells['r:c'].text.toString(),
    label: (
      surface.getElementById(ids.shape) as ShapeElementModel
    ).text?.toString(),
  };
}

function run(store: Store) {
  const toasts: string[] = [];
  const events: { name: string; props: unknown }[] = [];
  const std = {
    store,
    getOptional: (identifier: unknown) => {
      if (identifier === NotificationProvider) {
        return { toast: (message: string) => toasts.push(message) };
      }
      if (identifier === TelemetryProvider) {
        return {
          track: (name: string, props: unknown) => events.push({ name, props }),
        };
      }
      return null;
    },
  } as unknown as BlockStdScope;
  const command = invisibleCharactersCommands.find(
    c => c.id === 'text.invisibles.remove'
  )!;
  command.run(std, { surface: 'palette' } as CommandInvocation, undefined);
  return { toasts, events };
}

describe('text.invisibles.remove', () => {
  test('cleans the paragraph, the title, a table cell and a canvas label', () => {
    const { store, surface, ids } = createDoc();
    const { toasts, events } = run(store);

    expect(snapshot(store, surface, ids)).toEqual({
      title: 'Title',
      paragraph: 'watermark 👩\u200D💻 Oui\u00A0!',
      code: `const s = '${ZWSP}';`,
      cell: 'cell',
      label: 'label',
    });
    // The bold run keeps its formatting.
    const paragraph = store.getBlock(ids.paragraph)!.model as unknown as {
      text: Text;
    };
    expect(paragraph.text.toDelta()[0]).toEqual({
      insert: 'water',
      attributes: { bold: true },
    });
    // title + paragraph (2) + cell + label = 5; the code block is spared.
    expect(toasts).toEqual(['5 invisible characters removed']);
    expect(events).toEqual([
      {
        name: 'InvisibleCharactersRemoved',
        props: { count: 5, blockCount: 4 },
      },
    ]);
  });

  test('one undo puts every character back', () => {
    const { store, surface, ids } = createDoc();
    const before = snapshot(store, surface, ids);
    run(store);
    expect(store.canUndo).toBe(true);
    store.undo();
    expect(snapshot(store, surface, ids)).toEqual(before);
    expect(store.canUndo).toBe(false);
  });

  test('a read-only document is not touched', () => {
    const { store, surface, ids } = createDoc();
    const before = snapshot(store, surface, ids);
    store.readonly = true;
    const { events } = run(store);
    expect(snapshot(store, surface, ids)).toEqual(before);
    expect(events).toEqual([]);
  });

  test('a clean document writes nothing and reports nothing', () => {
    const { store } = createDoc();
    run(store);
    store.resetHistory();
    const { toasts, events } = run(store);
    expect(store.canUndo).toBe(false);
    expect(toasts).toEqual(['0 invisible characters removed']);
    expect(events).toEqual([]);
  });
});
