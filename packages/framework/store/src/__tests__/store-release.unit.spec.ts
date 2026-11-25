/**
 * What `Store.dispose()` must do and must never do (#746, ADR 0057, part 1).
 *
 * A document's sub-`Y.Doc` lives in the workspace's root `Y.Doc` as long as
 * the workspace, so whatever a store attached to it keeps the store alive.
 * Before ADR 0057, `dispose()` detached only the blocks map's deep observer
 * (and only once the doc was ready); every block's observers, the nested-prop
 * proxies, the `Text` and `Boxed` instances, the undo manager's
 * `afterTransaction` handler and an awareness listener per `load()` stayed:
 * 20 documents opened then disposed in one workspace kept 20 stores, and
 * after 11 open/dispose cycles one block had 22 observers. A disposed store
 * also stayed in its container, so the next `getStore()` handed back a dead
 * store that `load()` half revived: it looked open and never saw a remote
 * change again.
 *
 * The guards, numbered as in the ADR:
 * 1. a release writes nothing to Yjs (state vectors and full updates of the
 *    sub-document and of the root document are unchanged, no `update` event):
 *    a release that wrote would sync a change to every peer and to storage;
 * 2. a release detaches everything, and N open/dispose cycles do not grow
 *    the observer counts;
 * 3. the next `getStore()` builds a new, live store, which sees what a peer
 *    added after the release;
 * 4. a disposed store throws from `load()` and every mutation entry point,
 *    reads keep answering, a second `dispose()` does nothing;
 * 6. two live stores on one document (the editor's and a readonly query
 *    preview) share ONE proxy tree per nested prop, each notified of its
 *    changes: releasing one leaves the other reactive, a nested edit made
 *    through one reaches the other, and the tree detaches from Yjs with the
 *    last of them (the divergence cases, writes inside a transaction among
 *    them, are in `two-stores-nested-props.unit.spec.ts`);
 * 7. an edit made just before `dispose()` is in Yjs: nothing pending is lost
 *    (the block-meta half of this guard lives in `affine/shared`, beside the
 *    service);
 * and a collaboration-shaped case: two clients synced through Yjs updates,
 * one closes and reopens its document, both converge. Guard 5 (the
 * `readonly: false` key) is in `store-container.unit.spec.ts`.
 */
import { BlockSuiteError, ErrorCode } from '@labre/global/exceptions';
import { describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { StoreSelectionExtension } from '../extension/index.js';
import { BlockSchemaExtension } from '../extension/schema.js';
import { defineBlockSchema, type Store } from '../model/index.js';
import { Boxed, Text } from '../reactive/index.js';
import { createAutoIncrementIdGenerator } from '../test/index.js';
import { TestWorkspace } from '../test/test-workspace.js';
import {
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  type RootBlockModel,
  RootBlockSchemaExtension,
} from './test-schema.js';

/** A flat-data block, the other sync controller (the table's). */
const FlatBlockSchema = defineBlockSchema({
  flavour: 'test:flat',
  props: internal => ({
    title: internal.Text(),
    cols: {} as Record<string, { color: string }>,
    labels: [] as string[],
  }),
  metadata: {
    version: 1,
    role: 'content',
    parent: ['affine:page'],
    isFlatData: true,
  },
});

/** A flat-data block with a `Text` and a `Boxed` under a nested prop. */
type Cell = { text: Text; note: Boxed<{ n: number }> };
const CellsBlockSchema = defineBlockSchema({
  flavour: 'test:cells',
  props: () => ({ cells: {} as Record<string, Cell> }),
  metadata: {
    version: 1,
    role: 'content',
    parent: ['affine:page'],
    isFlatData: true,
  },
});

const extensions = [
  RootBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  BlockSchemaExtension(FlatBlockSchema),
  BlockSchemaExtension(CellsBlockSchema),
];

const DOC_ID = 'doc:release';
const PAGE_ID = 'page';
const NOTE_ID = 'note';
const PARAGRAPH_ID = 'paragraph';
const FLAT_ID = 'flat';
const CYCLES = 11;
/** Page, note, paragraph and the flat block. */
const BLOCKS_IN_DOC = 4;
/** A value no default and no seed gives `count`. */
const EDITED_COUNT = 7;
const UPDATED_COUNT = 3;

let workspaces = 0;

function openWorkspace() {
  workspaces += 1;
  const workspace = new TestWorkspace({
    id: `store-release-${workspaces}`,
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.storeExtensions = extensions;
  workspace.meta.initialize();
  return workspace;
}

/** Page (title, nested `style`, `items`), note, paragraph and a flat block. */
function seed(store: Store) {
  store.addBlock(
    'affine:page',
    {
      id: PAGE_ID,
      title: new Text('hello'),
      style: { color: 'red', nested: { depth: 1 } },
      items: [1, { label: 'one' }],
    },
    null
  );
  store.addBlock('affine:note', { id: NOTE_ID }, PAGE_ID);
  store.addBlock(
    'affine:paragraph',
    { id: PARAGRAPH_ID, text: new Text('first') },
    NOTE_ID
  );
  store.addBlock(
    'test:flat',
    {
      id: FLAT_ID,
      title: new Text('flat'),
      cols: { a: { color: 'blue' } },
      labels: ['x'],
    },
    PAGE_ID
  );
}

/** A document whose content arrived from a peer: no store opened on it yet. */
function docWithPeerContent(workspace: TestWorkspace) {
  const peer = openWorkspace();
  const peerStore = peer.createDoc(DOC_ID).getStore();
  peerStore.load(() => seed(peerStore));
  const update = Y.encodeStateAsUpdate(peerStore.spaceDoc);
  peer.dispose();

  const doc = workspace.createDoc(DOC_ID);
  Y.applyUpdate(doc.spaceDoc, update, 'remote');
  return doc;
}

/** A peer of `spaceDoc` makes `change` to its blocks map; it arrives remote. */
function fromAPeer(
  spaceDoc: Y.Doc,
  change: (blocks: Y.Map<Y.Map<unknown>>) => void
) {
  const peer = new Y.Doc();
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(spaceDoc));
  peer.transact(() => change(peer.getMap('blocks')));
  Y.applyUpdate(
    spaceDoc,
    Y.encodeStateAsUpdate(peer, Y.encodeStateVector(spaceDoc)),
    'remote'
  );
  peer.destroy();
}

/** A paragraph a peer adds under the note. */
function addParagraphFromAPeer(spaceDoc: Y.Doc, id: string) {
  fromAPeer(spaceDoc, blocks => {
    const paragraph = new Y.Map<unknown>();
    paragraph.set('sys:id', id);
    paragraph.set('sys:flavour', 'affine:paragraph');
    paragraph.set('sys:version', 1);
    paragraph.set('sys:children', new Y.Array<string>());
    paragraph.set('prop:type', 'text');
    paragraph.set('prop:text', new Y.Text('from a peer'));
    blocks.set(id, paragraph);
    (blocks.get(NOTE_ID)!.get('sys:children') as Y.Array<string>).push([id]);
  });
}

type YInternals = {
  _eH: { l: unknown[] };
  _dEH: { l: unknown[] };
};
type ObservableInternals = { _observers: Map<string, Set<unknown>> };

/** `observe` plus `observeDeep` handlers on a Yjs type. */
const handlersOn = (type: unknown) => {
  const { _eH, _dEH } = type as YInternals;
  return _eH.l.length + _dEH.l.length;
};

const listenersOf = (observable: unknown, event: string) =>
  (observable as ObservableInternals)._observers.get(event)?.size ?? 0;

/** Every Yjs and awareness attachment point a store reaches in the doc. */
function attachments(workspace: TestWorkspace, spaceDoc: Y.Doc) {
  const blocks = spaceDoc.getMap<Y.Map<unknown>>('blocks');
  const page = blocks.get(PAGE_ID)!;
  const style = page.get('prop:style') as Y.Map<unknown>;
  const items = page.get('prop:items') as Y.Array<unknown>;
  const flat = blocks.get(FLAT_ID)!;
  return {
    blocksMap: handlersOn(blocks),
    page: handlersOn(page),
    pageChildren: handlersOn(page.get('sys:children')),
    pageTitle: handlersOn(page.get('prop:title')),
    pageStyle: handlersOn(style),
    pageStyleNested: handlersOn(style.get('nested')),
    pageItems: handlersOn(items),
    pageItemsNested: handlersOn(items.get(1)),
    paragraph: handlersOn(blocks.get(PARAGRAPH_ID)),
    paragraphText: handlersOn(blocks.get(PARAGRAPH_ID)!.get('prop:text')),
    flat: handlersOn(flat),
    flatTitle: handlersOn(flat.get('prop:title')),
    flatLabels: handlersOn(flat.get('prop:labels')),
    awarenessChange: listenersOf(workspace.awarenessStore.awareness, 'change'),
    afterTransaction: listenersOf(spaceDoc, 'afterTransaction'),
  };
}

/** Open the default store, load it, edit what can be edited, select. */
function openAndEdit(doc: ReturnType<TestWorkspace['createDoc']>) {
  const store = doc.getStore();
  store.load();
  const page = store.getModelById<RootBlockModel>(PAGE_ID)!;
  page.props.title.insert('!', 0);
  (page.props.style as { color: string }).color = 'blue';
  page.props.count = page.props.count + 1;
  store.getModelById(PARAGRAPH_ID)!.text!.insert('x', 0);
  store.get(StoreSelectionExtension).set([]);
  return store;
}

describe('Store.dispose() releases what the store attached (ADR 0057)', () => {
  test('guard 1: a release writes nothing to the sub-document or the root document', () => {
    const workspace = openWorkspace();
    try {
      const doc = docWithPeerContent(workspace);
      const store = openAndEdit(doc);
      const preview = doc.getStore({
        readonly: true,
        query: { mode: 'loose', match: [] },
      });
      preview.load();
      const { spaceDoc, rootDoc } = doc;
      const before = {
        subVector: Y.encodeStateVector(spaceDoc),
        subUpdate: Y.encodeStateAsUpdate(spaceDoc),
        rootVector: Y.encodeStateVector(rootDoc),
        rootUpdate: Y.encodeStateAsUpdate(rootDoc),
      };
      const onUpdate = vi.fn();
      spaceDoc.on('update', onUpdate);
      rootDoc.on('update', onUpdate);

      preview.dispose();
      store.dispose();

      spaceDoc.off('update', onUpdate);
      rootDoc.off('update', onUpdate);
      expect(onUpdate).not.toHaveBeenCalled();
      expect(Y.encodeStateVector(spaceDoc)).toEqual(before.subVector);
      expect(Y.encodeStateAsUpdate(spaceDoc)).toEqual(before.subUpdate);
      expect(Y.encodeStateVector(rootDoc)).toEqual(before.rootVector);
      expect(Y.encodeStateAsUpdate(rootDoc)).toEqual(before.rootUpdate);
    } finally {
      workspace.dispose();
    }
  });

  test('guard 2: after dispose every attachment is back to before the store was opened, and cycles do not grow it', () => {
    const workspace = openWorkspace();
    try {
      const doc = docWithPeerContent(workspace);
      const baseline = attachments(workspace, doc.spaceDoc);

      const store = openAndEdit(doc);
      const open = attachments(workspace, doc.spaceDoc);
      // The store did attach (the guard would pass vacuously otherwise).
      expect(open.page).toBeGreaterThan(baseline.page);
      expect(open.pageStyle).toBeGreaterThan(baseline.pageStyle);
      expect(open.flat).toBeGreaterThan(baseline.flat);
      expect(open.awarenessChange).toBeGreaterThan(baseline.awarenessChange);
      expect(open.afterTransaction).toBeGreaterThan(baseline.afterTransaction);

      store.dispose();
      expect(attachments(workspace, doc.spaceDoc)).toEqual(baseline);

      Array.from({ length: CYCLES }).forEach(() => {
        const again = openAndEdit(doc);
        again.load(); // `load()` twice attaches nothing more
        again.dispose();
      });
      expect(attachments(workspace, doc.spaceDoc)).toEqual(baseline);
    } finally {
      workspace.dispose();
    }
  });

  test('a block removed while the store lives releases its own observers', () => {
    const workspace = openWorkspace();
    try {
      const doc = docWithPeerContent(workspace);
      const yParagraph = doc.spaceDoc
        .getMap<Y.Map<unknown>>('blocks')
        .get(PARAGRAPH_ID)!;
      const yText = yParagraph.get('prop:text');
      const before = {
        block: handlersOn(yParagraph),
        text: handlersOn(yText),
      };
      const store = doc.getStore();
      store.load();
      expect(handlersOn(yParagraph)).toBeGreaterThan(before.block);

      store.deleteBlock(PARAGRAPH_ID);

      expect(handlersOn(yParagraph)).toBe(before.block);
      expect(handlersOn(yText)).toBe(before.text);
      store.dispose();
    } finally {
      workspace.dispose();
    }
  });

  test('guard 3: the next getStore() is a new store, live, and sees what a peer added after the release', () => {
    const workspace = openWorkspace();
    try {
      const doc = docWithPeerContent(workspace);
      const store = openAndEdit(doc);
      store.dispose();

      // Arrives while the document is closed.
      addParagraphFromAPeer(doc.spaceDoc, 'while-closed');

      const reopened = doc.getStore();
      expect(reopened).not.toBe(store);
      reopened.load();
      expect(reopened.getBlock('while-closed')?.flavour).toBe(
        'affine:paragraph'
      );
      // What the closed store's edits wrote is there.
      const page = reopened.getModelById<RootBlockModel>(PAGE_ID)!;
      expect(page.props.title.toString()).toBe('!hello');
      expect((page.props.style as { color: string }).color).toBe('blue');

      const added: string[] = [];
      reopened.slots.blockUpdated.subscribe(({ type, id }) => {
        if (type === 'add') added.push(id);
      });
      addParagraphFromAPeer(doc.spaceDoc, 'after-reopen');
      expect(reopened.getBlock('after-reopen')).toBeDefined();
      expect(added).toEqual(['after-reopen']);

      // The old store saw none of it.
      expect(store.getBlock('while-closed')).toBeUndefined();
      expect(store.getBlock('after-reopen')).toBeUndefined();
      reopened.dispose();
    } finally {
      workspace.dispose();
    }
  });

  test('guard 4: a disposed store throws from load() and every mutation entry point; reads answer; dispose twice is a no-op', () => {
    const workspace = openWorkspace();
    try {
      const doc = docWithPeerContent(workspace);
      const store = doc.getStore();
      store.load();
      const page = store.getModelById<RootBlockModel>(PAGE_ID)!;
      const note = store.getModelById(NOTE_ID)!;
      const paragraph = store.getModelById(PARAGRAPH_ID)!;
      const yBefore = Y.encodeStateAsUpdate(doc.spaceDoc);

      store.dispose();

      const entryPoints: Record<string, () => unknown> = {
        load: () => store.load(),
        addBlock: () => store.addBlock('affine:paragraph', {}, NOTE_ID),
        addBlocks: () => store.addBlocks([], NOTE_ID),
        addSiblingBlocks: () =>
          store.addSiblingBlocks(paragraph, [{ flavour: 'affine:paragraph' }]),
        updateBlock: () => store.updateBlock(page, { count: UPDATED_COUNT }),
        deleteBlock: () => store.deleteBlock(paragraph),
        moveBlocks: () => store.moveBlocks([paragraph], note),
        transact: () => store.transact(() => {}),
        withoutTransact: () => store.withoutTransact(() => {}),
        undo: () => store.undo(),
        redo: () => store.redo(),
      };
      Object.entries(entryPoints).forEach(([name, call]) => {
        let thrown: unknown;
        try {
          call();
        } catch (error) {
          thrown = error;
        }
        expect(thrown, name).toBeInstanceOf(BlockSuiteError);
        expect((thrown as BlockSuiteError).code, name).toBe(
          ErrorCode.ModelCRUDError
        );
      });
      // Nothing reached Yjs.
      expect(Y.encodeStateAsUpdate(doc.spaceDoc)).toEqual(yBefore);

      // Reads answer the last state.
      expect(store.root?.id).toBe(PAGE_ID);
      expect(store.getBlock(PARAGRAPH_ID)?.model).toBe(paragraph);
      expect(store.hasBlock(NOTE_ID)).toBe(true);
      expect(store.blockSize).toBe(BLOCKS_IN_DOC);
      expect(page.props.title.toString()).toBe('hello');
      expect(paragraph.text?.toString()).toBe('first');
      expect(page.children.map(child => child.id)).toEqual([NOTE_ID, FLAT_ID]);
      expect(store.readonly).toBe(false);
      expect(store.canUndo).toBe(false);

      // Twice is a no-op, and never forgets the store that replaced it.
      const reopened = doc.getStore();
      expect(() => store.dispose()).not.toThrow();
      expect(doc.getStore()).toBe(reopened);
      reopened.dispose();
    } finally {
      workspace.dispose();
    }
  });

  test('a disposed store that was never ready releases its deep observer too', () => {
    const workspace = openWorkspace();
    try {
      const doc = docWithPeerContent(workspace);
      const blocks = doc.spaceDoc.getMap('blocks');
      const before = handlersOn(blocks);
      const store = doc.getStore(); // never loaded
      expect(handlersOn(blocks)).toBe(before + 1);
      store.dispose();
      expect(handlersOn(blocks)).toBe(before);
    } finally {
      workspace.dispose();
    }
  });

  test('the selection entry of the released store leaves the local awareness state', () => {
    const workspace = openWorkspace();
    try {
      const doc = docWithPeerContent(workspace);
      const local = () =>
        Object.keys(
          workspace.awarenessStore.getLocalState().selectionV2 ?? {}
        ).filter(key => key.startsWith(doc.id));
      const store = openAndEdit(doc);
      expect(local()).toHaveLength(1);
      store.dispose();
      expect(local()).toEqual([]);
    } finally {
      workspace.dispose();
    }
  });
});

describe('a Text and a Boxed in a flat block’s nested prop (a table cell)', () => {
  const CELLS_ID = 'cells';
  const CELL = 'r:c';
  const SEEDED_NOTE = { n: 1 };
  const EDITED_NOTE = { n: 2 };
  const LOCAL_NOTE = { n: 3 };
  /** The observer a `Boxed` attaches in its own constructor. */
  const OWN_OBSERVER = 1;

  /** A document whose cells block arrived from a peer. */
  function docWithCells(workspace: TestWorkspace) {
    const peer = openWorkspace();
    const peerStore = peer.createDoc(DOC_ID).getStore();
    peerStore.load(() => {
      peerStore.addBlock('affine:page', { id: PAGE_ID }, null);
      peerStore.addBlock(
        'test:cells',
        {
          id: CELLS_ID,
          cells: {
            [CELL]: { text: new Text('x'), note: new Boxed(SEEDED_NOTE) },
          },
        },
        PAGE_ID
      );
    });
    const update = Y.encodeStateAsUpdate(peerStore.spaceDoc);
    peer.dispose();
    const doc = workspace.createDoc(DOC_ID);
    Y.applyUpdate(doc.spaceDoc, update, 'remote');
    return doc;
  }

  /** The cell's `Y.Text` and `Boxed` map, as the document holds them now. */
  function yCell(spaceDoc: Y.Doc) {
    const yBlock = spaceDoc.getMap<Y.Map<unknown>>('blocks').get(CELLS_ID)!;
    return {
      text: yBlock.get(`prop:cells.${CELL}.text`) as Y.Text,
      note: yBlock.get(`prop:cells.${CELL}.note`) as Y.Map<unknown>,
    };
  }

  const cellOf = (store: Store) =>
    (store.getModelById(CELLS_ID)!.props as { cells: Record<string, Cell> })
      .cells[CELL];

  /** Yjs warns when a handler it does not hold is removed: a double release. */
  function consoleSpies() {
    return [vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
  }

  test('each is observed once while the store is open, notifies once per edit, and is released once', () => {
    const workspace = openWorkspace();
    const spies = consoleSpies();
    try {
      const doc = docWithCells(workspace);
      const { text, note } = yCell(doc.spaceDoc);
      expect([handlersOn(text), handlersOn(note)]).toEqual([0, 0]);

      const store = doc.getStore();
      store.load();
      // As on the base: one observer each, by the model's Text and Boxed.
      expect([handlersOn(text), handlersOn(note)]).toEqual([1, 1]);

      const updates: string[] = [];
      store.slots.blockUpdated.subscribe(({ type, id }) => {
        if (id === CELLS_ID) updates.push(type);
      });
      cellOf(store).text.insert('y', 0);
      expect(updates).toEqual(['update']);
      cellOf(store).note.setValue(EDITED_NOTE);
      expect(updates).toEqual(['update', 'update']);

      store.dispose();

      expect([handlersOn(text), handlersOn(note)]).toEqual([0, 0]);
      spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
      expect(text.toString()).toBe('yx');
      expect(note.get('value')).toEqual(EDITED_NOTE);
    } finally {
      spies.forEach(spy => spy.mockRestore());
      workspace.dispose();
    }
  });

  test('a cell written again, locally then by a peer, is released once, old and new', () => {
    const workspace = openWorkspace();
    const spies = consoleSpies();
    try {
      const doc = docWithCells(workspace);
      const store = doc.getStore();
      store.load();
      const seeded = yCell(doc.spaceDoc);

      // The table's write: the whole cell replaced through the proxy.
      const model = store.getModelById(CELLS_ID)!;
      (model.props as { cells: Record<string, Cell> }).cells[CELL] = {
        text: new Text('local'),
        note: new Boxed(LOCAL_NOTE),
      };
      const local = yCell(doc.spaceDoc);
      // The same Text written back to its own cell: bound again, tracked once.
      // (What it does to the content is the base's and not asserted here.)
      cellOf(store).text = cellOf(store).text;

      // A peer replaces the cell's text: the flat data re-initialises it.
      fromAPeer(doc.spaceDoc, blocks => {
        blocks
          .get(CELLS_ID)!
          .set(`prop:cells.${CELL}.text`, new Y.Text('peer'));
      });
      const remote = yCell(doc.spaceDoc);
      expect(cellOf(store).text.toString()).toBe('peer');

      store.dispose();

      expect([handlersOn(seeded.text), handlersOn(seeded.note)]).toEqual([
        0, 0,
      ]);
      expect([handlersOn(local.text), handlersOn(remote.text)]).toEqual([0, 0]);
      // The Boxed written in the cell is the caller's own instance, observing
      // since its constructor and, as on the base, never bound to the store:
      // its observer holds nothing of it.
      expect(remote.note).toBe(local.note);
      expect(handlersOn(local.note)).toBe(OWN_OBSERVER);
      spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
    } finally {
      spies.forEach(spy => spy.mockRestore());
      workspace.dispose();
    }
  });
});

describe('two stores on one document share one nested-prop tree (guard 6)', () => {
  function openBoth(workspace: TestWorkspace) {
    const doc = docWithPeerContent(workspace);
    const main = doc.getStore();
    main.load();
    const preview = doc.getStore({
      readonly: true,
      query: { mode: 'loose', match: [] },
    });
    preview.load();
    return {
      doc,
      main,
      preview,
      mainPage: main.getModelById<RootBlockModel>(PAGE_ID)!,
      previewPage: preview.getModelById<RootBlockModel>(PAGE_ID)!,
    };
  }

  const colorOf = (page: RootBlockModel) =>
    (page.props.style as { color: string }).color;
  const signalColorOf = (page: RootBlockModel) =>
    (page.props.style$.value as { color: string }).color;

  const colorFromAPeer = (spaceDoc: Y.Doc, color: string) =>
    fromAPeer(spaceDoc, blocks => {
      (blocks.get(PAGE_ID)!.get('prop:style') as Y.Map<unknown>).set(
        'color',
        color
      );
    });

  test('both stores read one proxy per nested prop; it detaches with the last store', () => {
    const workspace = openWorkspace();
    try {
      const { doc, main, preview, mainPage, previewPage } = openBoth(workspace);
      expect(previewPage.props.style).toBe(mainPage.props.style);
      expect(previewPage.props.items).toBe(mainPage.props.items);

      const yStyle = doc.spaceDoc
        .getMap<Y.Map<unknown>>('blocks')
        .get(PAGE_ID)!
        .get('prop:style');
      const attached = handlersOn(yStyle);
      expect(attached).toBeGreaterThan(0);
      preview.dispose();
      // The editor store still uses the tree: it stays attached.
      expect(handlersOn(yStyle)).toBe(attached);
      main.dispose();
      expect(handlersOn(yStyle)).toBe(0);
    } finally {
      workspace.dispose();
    }
  });

  test('a nested edit made through the editor store reaches the preview', () => {
    const workspace = openWorkspace();
    try {
      const { main, preview, mainPage, previewPage } = openBoth(workspace);
      const previewUpdates = vi.fn();
      preview.slots.blockUpdated.subscribe(previewUpdates);

      (mainPage.props.style as { color: string }).color = 'blue';

      expect(colorOf(previewPage)).toBe('blue');
      expect(signalColorOf(previewPage)).toBe('blue');
      expect(previewUpdates).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'update', id: PAGE_ID })
      );
      preview.dispose();
      main.dispose();
    } finally {
      workspace.dispose();
    }
  });

  test('releasing the preview leaves the editor store reactive to nested changes', () => {
    const workspace = openWorkspace();
    try {
      const { doc, main, preview, mainPage } = openBoth(workspace);
      preview.dispose();

      const mainUpdates = vi.fn();
      main.slots.blockUpdated.subscribe(mainUpdates);
      colorFromAPeer(doc.spaceDoc, 'green');
      expect(colorOf(mainPage)).toBe('green');
      expect(signalColorOf(mainPage)).toBe('green');
      expect(mainUpdates).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'update', id: PAGE_ID })
      );

      (mainPage.props.style as { color: string }).color = 'yellow';
      expect(
        (
          doc.spaceDoc
            .getMap<Y.Map<unknown>>('blocks')
            .get(PAGE_ID)!
            .get('prop:style') as Y.Map<unknown>
        ).get('color')
      ).toBe('yellow');
      expect(signalColorOf(mainPage)).toBe('yellow');
      main.dispose();
    } finally {
      workspace.dispose();
    }
  });

  test('releasing the editor store leaves the preview reactive to nested changes', () => {
    const workspace = openWorkspace();
    try {
      const { doc, main, preview, previewPage } = openBoth(workspace);
      main.dispose();

      colorFromAPeer(doc.spaceDoc, 'purple');
      expect(colorOf(previewPage)).toBe('purple');
      expect(signalColorOf(previewPage)).toBe('purple');
      preview.dispose();
    } finally {
      workspace.dispose();
    }
  });
});

describe('nothing pending is lost at release (guard 7)', () => {
  test('an edit made just before dispose() is in Yjs and in the next store', () => {
    const workspace = openWorkspace();
    try {
      const doc = docWithPeerContent(workspace);
      const store = doc.getStore();
      store.load();
      const page = store.getModelById<RootBlockModel>(PAGE_ID)!;
      page.props.title.insert('edited ', 0);
      (page.props.style as { color: string }).color = 'teal';
      page.props.count = EDITED_COUNT;
      store.dispose();

      const yPage = doc.spaceDoc.getMap<Y.Map<unknown>>('blocks').get(PAGE_ID)!;
      expect(String(yPage.get('prop:title'))).toBe('edited hello');
      expect((yPage.get('prop:style') as Y.Map<unknown>).get('color')).toBe(
        'teal'
      );
      expect(yPage.get('prop:count')).toBe(EDITED_COUNT);

      const reopened = doc.getStore();
      reopened.load();
      const again = reopened.getModelById<RootBlockModel>(PAGE_ID)!;
      expect(again.props.title.toString()).toBe('edited hello');
      expect(again.props.count).toBe(EDITED_COUNT);
      reopened.dispose();
    } finally {
      workspace.dispose();
    }
  });
});

describe('collaboration: one client closes and reopens, both converge', () => {
  test('two clients synced through Yjs updates', () => {
    const alice = openWorkspace();
    const bob = openWorkspace();
    try {
      const aliceDoc = docWithPeerContent(alice);
      const bobDoc = bob.createDoc(DOC_ID);
      Y.applyUpdate(
        bobDoc.spaceDoc,
        Y.encodeStateAsUpdate(aliceDoc.spaceDoc),
        'remote'
      );
      // The wire: every local update of one client reaches the other.
      const wire = (from: Y.Doc, to: Y.Doc) =>
        from.on('update', (update: Uint8Array, origin: unknown) => {
          if (origin !== 'wire') Y.applyUpdate(to, update, 'wire');
        });
      wire(aliceDoc.spaceDoc, bobDoc.spaceDoc);
      wire(bobDoc.spaceDoc, aliceDoc.spaceDoc);

      const aliceStore = aliceDoc.getStore();
      aliceStore.load();
      const bobStore = bobDoc.getStore();
      bobStore.load();

      aliceStore
        .getModelById<RootBlockModel>(PAGE_ID)!
        .props.title.insert('A', 0);
      expect(
        bobStore.getModelById<RootBlockModel>(PAGE_ID)!.props.title.toString()
      ).toBe('Ahello');

      aliceStore.dispose();
      // Bob keeps editing while Alice's document is closed.
      const bobPage = bobStore.getModelById<RootBlockModel>(PAGE_ID)!;
      bobPage.props.title.insert('B', 0);
      (bobPage.props.style as { color: string }).color = 'bob';
      const bobParagraph = bobStore.addBlock(
        'affine:paragraph',
        { text: new Text('bob') },
        NOTE_ID
      );

      const aliceAgain = aliceDoc.getStore();
      expect(aliceAgain).not.toBe(aliceStore);
      aliceAgain.load();
      const alicePage = aliceAgain.getModelById<RootBlockModel>(PAGE_ID)!;
      expect(alicePage.props.title.toString()).toBe('BAhello');
      expect(colorOfStyle(alicePage)).toBe('bob');
      expect(aliceAgain.getBlock(bobParagraph)).toBeDefined();

      // Alice edits again; Bob sees it.
      alicePage.props.title.insert('!', alicePage.props.title.length);
      (alicePage.props.style as { color: string }).color = 'alice';
      expect(bobPage.props.title.toString()).toBe('BAhello!');
      expect(colorOfStyle(bobPage)).toBe('alice');

      expect(Y.encodeStateVector(aliceDoc.spaceDoc)).toEqual(
        Y.encodeStateVector(bobDoc.spaceDoc)
      );
      expect(aliceDoc.spaceDoc.getMap('blocks').toJSON()).toEqual(
        bobDoc.spaceDoc.getMap('blocks').toJSON()
      );
      aliceAgain.dispose();
      bobStore.dispose();
    } finally {
      alice.dispose();
      bob.dispose();
    }
  });
});

function colorOfStyle(page: RootBlockModel) {
  return (page.props.style as { color: string }).color;
}

describe('what a closed document tells the code that resumes after an await', () => {
  test('store.disposed answers whether the store was released', () => {
    const workspace = openWorkspace();
    try {
      const doc = docWithPeerContent(workspace);
      const store = doc.getStore();
      store.load();
      expect(store.disposed).toBe(false);
      store.dispose();
      expect(store.disposed).toBe(true);
      expect(doc.getStore().disposed).toBe(false);
    } finally {
      workspace.dispose();
    }
  });

  test('a store disposed inside load(initFn) attaches nothing afterwards', () => {
    const workspace = openWorkspace();
    try {
      const doc = workspace.createDoc('doc:closed-while-loading');
      const awareness = workspace.awarenessStore.awareness;
      const before = listenersOf(awareness, 'change');
      const store = doc.getStore();
      store.load(() => store.dispose());

      expect(store.disposed).toBe(true);
      expect(listenersOf(awareness, 'change')).toBe(before);
      expect(listenersOf(doc.spaceDoc, 'afterTransaction')).toBe(0);
    } finally {
      workspace.dispose();
    }
  });
});
