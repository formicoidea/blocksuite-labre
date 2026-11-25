/**
 * Two stores on one document read the same nested props, whoever writes,
 * however (#746, ADR 0057, guard 6, amended 2026-11-25).
 *
 * The first landing of ADR 0057 gave each store its own nested-prop proxies
 * and recognised another store's write by the transaction ORIGIN. Yjs keeps
 * the outer origin for a nested `transact`, so a write made inside
 * `store.transact(...)`, an `updateBlock(model, () => …)` callback or any
 * outer transaction (the house's mandatory path for nested writes) carried
 * the store's client id: the other store's proxy took it for a local write
 * of its own, skipped it, and kept the old value (`prop$` fresh,
 * `model.props.x.y` stale). An editable second store then rewrote a row it
 * believed missing (`if (!cells[rowId]) cells[rowId] = {}`) and dropped the
 * editor's cells. The base shared one proxy per Yjs type between stores and
 * could not diverge; the fix keeps that (one proxy tree per nested prop,
 * shared by every store on the document) and releases it when the LAST
 * store using it is released.
 *
 * Every case reads the second store's `model.props` (what the surface-ref
 * note portal and the frame thumbnail render), not only its signals.
 */
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { Boxed, Text } from '../reactive/index.js';
import { createAutoIncrementIdGenerator } from '../test/index.js';
import { TestWorkspace } from '../test/test-workspace.js';
import {
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  type RootBlockModel,
  RootBlockSchemaExtension,
} from './test-schema.js';

const PAGE_ID = 'page';

type Style = {
  color: string;
  nested: { depth: number; deeper?: { x: number } };
  label?: Text;
  box?: Boxed<{ a: number }>;
  size?: number;
  [row: string]: unknown;
};

function openBoth(second: 'preview' | 'editable' = 'preview') {
  const workspace = new TestWorkspace({
    id: 'two-stores-nested',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
  ];
  workspace.meta.initialize();
  const doc = workspace.createDoc('doc');
  const main = doc.getStore();
  main.load(() => {
    main.addBlock(
      'affine:page',
      {
        id: PAGE_ID,
        title: new Text('t'),
        style: { color: 'red', nested: { depth: 1 } },
        items: [1, { label: 'one' }],
      },
      null
    );
  });
  const other =
    second === 'preview'
      ? doc.getStore({ readonly: true, query: { mode: 'loose', match: [] } })
      : doc.getStore({ readonly: false });
  other.load();
  const mainPage = main.getModelById<RootBlockModel>(PAGE_ID)!;
  const otherPage = other.getModelById<RootBlockModel>(PAGE_ID)!;
  return {
    workspace,
    doc,
    main,
    other,
    mainStyle: () => mainPage.props.style as Style,
    otherStyle: () => otherPage.props.style as Style,
    mainItems: () => mainPage.props.items as unknown[],
    otherItems: () => otherPage.props.items as unknown[],
    mainPage,
    otherPage,
  };
}

/** A peer sets `style[key] = value`; it arrives as a remote update. */
function styleFromAPeer(spaceDoc: Y.Doc, key: string, value: unknown) {
  const peer = new Y.Doc();
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(spaceDoc));
  const style = peer
    .getMap<Y.Map<unknown>>('blocks')
    .get(PAGE_ID)!
    .get('prop:style') as Y.Map<unknown>;
  style.set(key, value);
  Y.applyUpdate(
    spaceDoc,
    Y.encodeStateAsUpdate(peer, Y.encodeStateVector(spaceDoc)),
    'remote'
  );
  peer.destroy();
}

describe('the probe of the review (each red on the first landing)', () => {
  test('a nested write outside any transaction', () => {
    const t = openBoth();
    t.mainStyle().color = 'blue';
    expect(t.otherStyle().color).toBe('blue');
    t.workspace.dispose();
  });

  test('a nested write inside store.transact', () => {
    const t = openBoth();
    t.main.transact(() => {
      t.mainStyle().color = 'blue';
    });
    expect(t.mainStyle().color).toBe('blue');
    expect((t.otherPage.props.style$.value as Style).color).toBe('blue');
    expect(t.otherStyle().color).toBe('blue');
    t.workspace.dispose();
  });

  test('a deeper nested write inside store.transact', () => {
    const t = openBoth();
    t.main.transact(() => {
      t.mainStyle().nested.depth = 5;
    });
    expect(t.otherStyle().nested.depth).toBe(5);
    t.workspace.dispose();
  });

  test('an array push inside store.transact', () => {
    const t = openBoth();
    t.main.transact(() => {
      t.mainItems().push(9);
    });
    expect(t.otherItems().length).toBe(3);
    expect(t.otherItems()[2]).toBe(9);
    t.workspace.dispose();
  });

  test('undo and redo of a nested write made in a transaction, seen from both stores', () => {
    const t = openBoth();
    t.main.transact(() => {
      t.mainStyle().color = 'blue';
    });
    t.main.captureSync();
    t.main.undo();
    expect(t.mainStyle().color).toBe('red');
    expect(t.otherStyle().color).toBe('red');
    t.main.redo();
    expect(t.mainStyle().color).toBe('blue');
    expect(t.otherStyle().color).toBe('blue');
    t.workspace.dispose();
  });
});

describe('two stores on one document never diverge', () => {
  test('both stores write in ONE transaction: each sees both writes', () => {
    const t = openBoth('editable');
    t.main.spaceDoc.transact(() => {
      t.mainStyle().color = 'blue';
      t.otherStyle().size = 3;
    }, t.main.spaceDoc.clientID);
    expect(t.mainStyle().size).toBe(3);
    expect(t.otherStyle().color).toBe('blue');
    t.workspace.dispose();
  });

  test('a remote update interleaved with local transactions', () => {
    const t = openBoth();
    t.main.transact(() => {
      t.mainStyle().color = 'blue';
    });
    styleFromAPeer(t.main.spaceDoc, 'remote', 'yes');
    t.main.transact(() => {
      t.mainStyle().nested.depth = 2;
    });
    expect(t.otherStyle()).toMatchObject({
      color: 'blue',
      remote: 'yes',
      nested: { depth: 2 },
    });
    expect(t.mainStyle()).toMatchObject({ remote: 'yes' });
    t.workspace.dispose();
  });

  test('array splice and reorder inside a transaction', () => {
    const t = openBoth();
    t.main.transact(() => {
      const items = t.mainItems();
      items.splice(0, 1);
      items.splice(1, 0, 'b', 'c');
    });
    const expected = [{ label: 'one' }, 'b', 'c'];
    expect(JSON.parse(JSON.stringify(t.mainItems()))).toEqual(expected);
    expect(JSON.parse(JSON.stringify(t.otherItems()))).toEqual(expected);
    t.workspace.dispose();
  });

  test('a nested map inside a nested map, written in a transaction', () => {
    const t = openBoth();
    t.main.transact(() => {
      t.mainStyle().nested.deeper = { x: 1 };
    });
    t.main.transact(() => {
      t.mainStyle().nested.deeper!.x = 2;
    });
    expect(t.otherStyle().nested.deeper?.x).toBe(2);
    t.workspace.dispose();
  });

  test('a Text and a Boxed inside a nested prop', () => {
    const t = openBoth();
    t.main.transact(() => {
      t.mainStyle().label = new Text('a');
      t.mainStyle().box = new Boxed({ a: 1 });
    });
    t.main.transact(() => {
      t.mainStyle().label!.insert('b', 1);
      t.mainStyle().box!.setValue({ a: 2 });
    });
    expect(t.otherStyle().label?.toString()).toBe('ab');
    expect(t.otherStyle().box?.getValue()).toEqual({ a: 2 });
    t.workspace.dispose();
  });

  test('a nested write in an updateBlock callback', () => {
    const t = openBoth();
    t.main.updateBlock(t.mainPage, () => {
      t.mainStyle().color = 'green';
    });
    expect(t.otherStyle().color).toBe('green');
    t.workspace.dispose();
  });

  test('an editable second store running the updateCells pattern after the editor wrote cells: no cell lost', () => {
    const t = openBoth('editable');
    // The editor writes a row's cells (database `updateCell`).
    t.main.transact(() => {
      const style = t.mainStyle();
      if (!style.row1) style.row1 = {};
      (style.row1 as Record<string, unknown>).a = 1;
    });
    // The second store then writes another cell of the same row
    // (database `updateCells`): it must see the row, not recreate it.
    t.other.transact(() => {
      const style = t.otherStyle();
      if (!style.row1) style.row1 = {};
      (style.row1 as Record<string, unknown>).b = 2;
    });
    const stored = (
      t.main.spaceDoc
        .getMap<Y.Map<unknown>>('blocks')
        .get(PAGE_ID)!
        .get('prop:style') as Y.Map<unknown>
    ).get('row1') as Y.Map<unknown>;
    expect(stored.toJSON()).toEqual({ a: 1, b: 2 });
    expect(t.mainStyle().row1).toEqual({ a: 1, b: 2 });
    expect(t.otherStyle().row1).toEqual({ a: 1, b: 2 });
    t.workspace.dispose();
  });
});
