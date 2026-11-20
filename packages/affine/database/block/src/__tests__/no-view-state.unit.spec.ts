/**
 * A database with no view left draws an empty state, never nothing (ADR 0035
 * amendment of 2026-11-20, product owner's acceptance report of 4.0).
 *
 * Deleting the only view of a base ("⋯" › Delete, or the tab's menu) left
 * `props.views` empty, and the root renderer drew nothing at all: no title,
 * no views bar, no "+", no table, and no way back but Ctrl+Z. `views: []` is
 * also both blocks' schema default, so the state also arrives from a store,
 * an undo, a peer or a paste.
 *
 * What it would have caught:
 * - the delete gesture itself changing (GUARD, holds before and after the
 *   fix): the last view going leaves the rows and one undo step; deleting
 *   one view of two keeps the other current;
 * - a database with no view drawing nothing instead of the block's header
 *   and the status, or drawing the button where no view may be added (a
 *   read-only document, `{ database: false }` through `ViewCreationOffKey`);
 * - the empty state writing anything when it mounts (no Yjs update, no undo
 *   step), or when a peer's deletion of the last view lands;
 * - the host's `deleteView` request throwing, or leaving anything but the
 *   empty state, when `remove()` takes the last view;
 * - undo not bringing the view back, redo not giving the empty state back;
 * - the button not being "+"'s gesture: a view of the picked preset, made
 *   current and traced `DatabaseViewAdded` once;
 * - a view current only by a stale id (a peer deleted it while another view
 *   remains) drawing nothing instead of the remaining view.
 *
 * The real block header, the keyboard and the focus are held by
 * `integration-test/…/page/database-no-view.spec.ts`.
 */
import {
  DatabaseBlockSchemaExtension,
  type DatabaseBlockModel,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { effects as contextMenuEffects } from '@labre/affine-components/context-menu';
import {
  DataSourcePickerProvider,
  type DataSourcePickerService,
  type DataSourcePickerViewDeletion,
  FeatureFlagService,
} from '@labre/affine-shared/services';
import {
  type DataSourceBase,
  DataViewRootUILogic,
  type DataViewUILogicBase,
  ViewCreationOffKey,
} from '@labre/affine-database-engine';
import { effects as dataViewEffects } from '@labre/affine-database-engine/effects';
import { type Store, Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { html } from 'lit';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';

import { DatabaseBlockDataSource } from '../data-source.js';

const TABLE = { id: 'v1', name: 'Table View', mode: 'table' };
const BOARD = { id: 'v2', name: 'Board', mode: 'kanban' };

const extensions = [
  RootBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  DatabaseBlockSchemaExtension,
  FeatureFlagService,
];

function database(
  views: readonly object[],
  options: { externalSourceId?: string; workspace?: TestWorkspace } = {}
): { store: Store; model: DatabaseBlockModel; rowId: string } {
  const collection =
    options.workspace ??
    new TestWorkspace({
      id: 'no-view-state',
      idGenerator: createAutoIncrementIdGenerator(),
    });
  collection.meta.initialize();
  const doc = collection.createDoc('doc0');
  doc.load();
  const store = doc.getStore({ extensions });
  const rootId = store.addBlock('affine:page', { title: new Text('page') });
  const noteId = store.addBlock('affine:note', {}, rootId);
  const databaseId = store.addBlock(
    'affine:database',
    {
      title: new Text('Plan'),
      views: views as never,
      ...(options.externalSourceId
        ? { externalSourceId: options.externalSourceId }
        : {}),
    },
    noteId
  );
  const rowId = store.addBlock(
    'affine:paragraph',
    { text: new Text('row one') },
    databaseId
  );
  const model = store.getModelById(databaseId) as DatabaseBlockModel;
  store.captureSync();
  store.resetHistory();
  return { store, model, rowId };
}

beforeAll(() => {
  if (!customElements.get('affine-data-view-renderer')) dataViewEffects();
  if (!customElements.get('affine-menu')) contextMenuEffects();
});

afterEach(() => {
  document.body.innerHTML = '';
});

/** Lit renders a level of nested elements per pass: the root, then its state. */
const SETTLE_PASSES = 4;

const updatesOfAll = () =>
  Promise.all(
    [...document.body.querySelectorAll('*')].map(
      element =>
        (element as Partial<{ updateComplete: Promise<unknown> }>)
          .updateComplete
    )
  );

const settle = () =>
  Array.from({ length: SETTLE_PASSES }).reduce<Promise<unknown>>(
    async previous => {
      await previous;
      return updatesOfAll();
    },
    Promise.resolve()
  );

/**
 * The block's root renderer over `source`, as the block configures it for
 * what this suite reads: its header when there is no view, and a stand-in
 * for a view (`viewPlaceholder` replaces the view's whole rendering).
 */
async function mount(source: DataSourceBase) {
  const eventTrace = vi.fn();
  const root = new DataViewRootUILogic({
    dataSource: source,
    eventTrace,
    selection$: signal(undefined),
    setSelection: () => {},
    noViewHeader: () => html`<div data-testid="no-view-header">Plan</div>`,
    viewPlaceholder: (logic: DataViewUILogicBase) =>
      html`<div data-testid="a-view" data-view-id="${logic.view.id}"></div>`,
  } as never);
  const element = document.createElement('affine-data-view-renderer');
  element.logic = root;
  document.body.append(element);
  await settle();
  return { root, element, eventTrace };
}

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

const viewIds = (model: DatabaseBlockModel) => model.props.views.map(v => v.id);

describe('GUARD: the delete gesture of a view', () => {
  test('deleting the only view leaves the rows and one undo step', () => {
    const { store, model, rowId } = database([TABLE]);
    const source = new DatabaseBlockDataSource(model);
    source.viewManager.viewDelete(TABLE.id);

    expect(viewIds(model)).toEqual([]);
    expect(model.children.map(child => child.id)).toEqual([rowId]);
    expect(source.viewManager.currentViewId$.value).toBe(undefined);
    store.undo();
    expect(viewIds(model)).toEqual([TABLE.id]);
  });

  test('deleting one view of two keeps the other current', () => {
    const { model } = database([TABLE, BOARD]);
    const source = new DatabaseBlockDataSource(model);
    source.viewManager.setCurrentView(BOARD.id);
    source.viewManager.viewDelete(BOARD.id);

    expect(viewIds(model)).toEqual([TABLE.id]);
    expect(source.viewManager.currentViewId$.value).toBe(TABLE.id);
  });
});

describe('a database with no view', () => {
  test('draws its header and the status, with "+"\'s button, writing nothing', async () => {
    const { store, model } = database([]);
    const updates: Uint8Array[] = [];
    const record = (update: Uint8Array) => updates.push(update);
    store.doc.spaceDoc.on('update', record);
    try {
      await mount(new DatabaseBlockDataSource(model));
    } finally {
      store.doc.spaceDoc.off('update', record);
    }

    expect(byTestId('no-view-header')?.textContent).toBe('Plan');
    const status = byTestId('database-no-view');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.textContent).toContain('No view');
    const button = byTestId('database-no-view-add');
    expect(button?.getAttribute('role')).toBe('button');
    expect(button?.tabIndex).toBe(0);
    expect(button?.textContent?.trim()).toBe('New view');
    expect(updates).toEqual([]);
    expect(store.canUndo).toBe(false);
    expect(model.props.views).toEqual([]);
  });

  test('on a read-only document, the status alone', async () => {
    const { store, model } = database([]);
    store.readonly = true;
    await mount(new DatabaseBlockDataSource(model));

    expect(byTestId('database-no-view')).not.toBe(null);
    expect(byTestId('database-no-view-add')).toBe(null);
  });

  test('with view creation off (`{ database: false }`), the status alone', async () => {
    const { model } = database([]);
    await mount(
      new DatabaseBlockDataSource(model, ds =>
        ds.serviceSet(ViewCreationOffKey, true)
      )
    );

    expect(byTestId('database-no-view')).not.toBe(null);
    expect(byTestId('database-no-view-add')).toBe(null);
  });

  test('its button adds a view of the picked preset, current, traced once', async () => {
    const { model } = database([]);
    const source = new DatabaseBlockDataSource(model);
    const { eventTrace } = await mount(source);

    byTestId('database-no-view-add')!.click();
    await vi.waitUntil(() => byTestId('database-add-view-preset'));
    const presets = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-testid="database-add-view-preset"]'
      ),
    ];
    expect(presets).toHaveLength(source.viewMetas.length);
    presets[0]!.click();
    await settle();

    expect(model.props.views).toHaveLength(1);
    const added = model.props.views[0]!;
    expect(added.mode).toBe(source.viewMetas[0]!.type);
    expect(source.viewManager.currentViewId$.value).toBe(added.id);
    expect(byTestId('a-view')?.dataset.viewId).toBe(added.id);
    expect(byTestId('database-no-view')).toBe(null);
    expect(eventTrace).toHaveBeenCalledTimes(1);
    expect(eventTrace).toHaveBeenCalledWith('DatabaseViewAdded', {
      viewType: added.mode,
      source: 'existing',
    });
  });
});

describe('reaching no view', () => {
  test('deleting the last view draws the empty state; undo the view, redo the empty state', async () => {
    const { store, model } = database([TABLE]);
    const source = new DatabaseBlockDataSource(model);
    await mount(source);
    expect(byTestId('a-view')).not.toBe(null);

    source.viewManager.viewDelete(TABLE.id);
    await settle();
    expect(byTestId('a-view')).toBe(null);
    expect(byTestId('database-no-view')).not.toBe(null);

    store.undo();
    await settle();
    expect(byTestId('a-view')?.dataset.viewId).toBe(TABLE.id);
    expect(byTestId('database-no-view')).toBe(null);

    store.redo();
    await settle();
    expect(byTestId('database-no-view')).not.toBe(null);
  });

  test('a host removing the last view through its `deleteView` request lands on the empty state', async () => {
    const { model } = database([{ ...TABLE, sourceId: 's1' }], {
      externalSourceId: 'host:plan',
    });
    const requests: DataSourcePickerViewDeletion[] = [];
    const picker: DataSourcePickerService = {
      list: () => signal([]),
      deleteView: request => {
        requests.push(request);
      },
    };
    const source = new DatabaseBlockDataSource(model, ds =>
      ds.serviceSet(DataSourcePickerProvider, picker)
    );
    await mount(source);

    source.viewManager.viewDelete(TABLE.id);
    expect(requests).toHaveLength(1);
    expect(viewIds(model)).toEqual([TABLE.id]);
    expect(requests[0]!.remove()).toBe(true);
    await settle();

    expect(viewIds(model)).toEqual([]);
    expect(source.viewManager.currentViewId$.value).toBe(undefined);
    expect(byTestId('database-no-view')).not.toBe(null);
  });
});

/**
 * Two peers on one document, as a sync provider wires them: the viewer only
 * RECEIVES, one transaction per update, with a named origin (an origin-less
 * one reads as local in `Store._handleYEvent`).
 */
function twoPeers(views: readonly object[]) {
  const options = {
    id: 'no-view-peers',
    idGenerator: createAutoIncrementIdGenerator(),
  };
  const authorWorkspace = new TestWorkspace(options);
  const { store: author, model: authorModel } = database(views, {
    workspace: authorWorkspace,
  });
  const queue: Uint8Array[] = [];
  author.doc.spaceDoc.on('update', (update: Uint8Array) => queue.push(update));

  const viewerWorkspace = new TestWorkspace(options);
  applyUpdate(viewerWorkspace.doc, encodeStateAsUpdate(authorWorkspace.doc));
  const viewerDoc = viewerWorkspace.getDoc('doc0')!;
  applyUpdate(
    viewerDoc.spaceDoc,
    encodeStateAsUpdate(author.doc.spaceDoc),
    'remote-peer'
  );
  const viewer = viewerDoc.getStore({ extensions });
  viewerDoc.load();
  let localWrites = 0;
  viewerDoc.spaceDoc.on('afterTransaction', transaction => {
    if (transaction.local) localWrites++;
  });
  const sync = () => {
    queue.splice(0).forEach(update => {
      applyUpdate(viewerDoc.spaceDoc, update, 'remote-peer');
    });
  };
  return {
    author,
    authorModel,
    viewerModel: viewer.getModelById(authorModel.id) as DatabaseBlockModel,
    sync,
    localWrites: () => localWrites,
  };
}

describe('a peer deleting views', () => {
  test('the last view deleted by a peer draws the empty state and writes nothing here', async () => {
    const peers = twoPeers([TABLE]);
    const source = new DatabaseBlockDataSource(peers.viewerModel);
    await mount(source);
    expect(byTestId('a-view')).not.toBe(null);

    new DatabaseBlockDataSource(peers.authorModel).viewManager.viewDelete(
      TABLE.id
    );
    peers.sync();
    await settle();

    expect(viewIds(peers.viewerModel)).toEqual([]);
    expect(byTestId('database-no-view')).not.toBe(null);
    expect(peers.localWrites()).toBe(0);
  });

  test('the current view deleted by a peer while another remains draws the other', async () => {
    const peers = twoPeers([TABLE, BOARD]);
    const source = new DatabaseBlockDataSource(peers.viewerModel);
    source.viewManager.setCurrentView(BOARD.id);
    await mount(source);
    expect(byTestId('a-view')?.dataset.viewId).toBe(BOARD.id);

    new DatabaseBlockDataSource(peers.authorModel).viewManager.viewDelete(
      BOARD.id
    );
    peers.sync();
    await settle();

    expect(byTestId('a-view')?.dataset.viewId).toBe(TABLE.id);
    expect(peers.localWrites()).toBe(0);
  });
});
