/**
 * GUARD — a host decides what a deleted view takes with it (ADR 0035
 * amendment of 2026-10-29): `DataSourcePickerService.deleteView` and
 * `viewHistory`.
 *
 * Labre sends a source to its trash with the last view reading it: it must
 * be asked BEFORE the view goes (to announce what goes with it), and told
 * when an undo brings the view back (to restore what went).
 *
 * What it would have caught:
 * - a host without the verb, a native database or a read-only page seeing
 *   anything but the 1.0 removal;
 * - the view removed before the host said so, or kept after `remove()`;
 * - `remove()` removing twice, or removing on a page that turned read-only;
 * - the request fired for a deleted block (removing a block only hides what
 *   it shows), or `viewHistory` fired for a write that is not an undo or a
 *   redo of this client (a remote change);
 * - an undo, redo, undo… chain losing its report after the first step
 *   (Yjs builds a new step for each replay: the tag must follow it);
 * - a removal made by the host later leaving the vanished view current.
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
  type DataSourcePickerViewDeletion,
  FeatureFlagService,
} from '@labre/affine-shared/services';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { describe, expect, test, vi } from 'vitest';

import { DatabaseBlockDataSource } from '../data-source.js';

const VIEWS = [
  { id: 'v1', name: 'Table', mode: 'table', sourceId: 's1' },
  { id: 'v2', name: 'Board', mode: 'kanban', sourceId: 's2' },
];

function database(externalSourceId: string | null = 'host:plan'): {
  store: Store;
  model: DatabaseBlockModel;
} {
  const collection = new TestWorkspace({ id: 'view-deletion' });
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
  const databaseId = store.addBlock(
    'affine:database',
    {
      title: new Text('Plan'),
      views: VIEWS as never,
      ...(externalSourceId ? { externalSourceId } : {}),
    },
    noteId
  );
  const model = store.getModelById(databaseId) as DatabaseBlockModel;
  store.captureSync();
  return { store, model };
}

function host(
  answer: (request: DataSourcePickerViewDeletion) => void = r => {
    r.remove();
  }
) {
  const requests: DataSourcePickerViewDeletion[] = [];
  const history = vi.fn();
  const picker: DataSourcePickerService = {
    list: () => signal([]),
    deleteView: request => {
      requests.push(request);
      answer(request);
    },
    viewHistory: history,
  };
  return { picker, requests, history };
}

function source(model: DatabaseBlockModel, picker: DataSourcePickerService) {
  return new DatabaseBlockDataSource(model, ds =>
    ds.serviceSet(DataSourcePickerProvider, picker)
  );
}

const viewIds = (model: DatabaseBlockModel) => model.props.views.map(v => v.id);

describe('deleting a view of a host database', () => {
  test('without the verb, or without a picker, the view goes at once', () => {
    const { model } = database();
    new DatabaseBlockDataSource(model).viewManager.viewDelete('v1');
    expect(viewIds(model)).toEqual(['v2']);

    const bare: DataSourcePickerService = { list: () => signal([]) };
    source(model, bare).viewManager.viewDelete('v2');
    expect(viewIds(model)).toEqual([]);
  });

  test('a native database never asks the host', () => {
    const { model } = database(null);
    const { picker, requests } = host();
    source(model, picker).viewManager.viewDelete('v1');
    expect(requests).toHaveLength(0);
    expect(viewIds(model)).toEqual(['v2']);
  });

  test('a read-only page never asks the host', () => {
    const { store, model } = database();
    const { picker, requests } = host();
    store.readonly = true;
    source(model, picker).viewManager.viewDelete('v1');
    expect(requests).toHaveLength(0);
  });

  test('the host is asked once, and the view stays until it removes it', () => {
    const { store, model } = database();
    const { picker, requests } = host(() => undefined);
    source(model, picker).viewManager.viewDelete('v2');
    expect(requests).toHaveLength(1);
    const request = requests[0]!;
    expect(request).toMatchObject({
      databaseId: 'host:plan',
      sourceId: 's2',
      viewId: 'v2',
      viewName: 'Board',
      docId: store.id,
      blockId: model.id,
    });
    expect(viewIds(model)).toEqual(['v1', 'v2']);

    expect(request.remove()).toBe(true);
    expect(viewIds(model)).toEqual(['v1']);
    expect(request.remove()).toBe(false);
  });

  test('remove() refuses on a page turned read-only', () => {
    const { store, model } = database();
    const { picker, requests } = host(() => undefined);
    source(model, picker).viewManager.viewDelete('v1');
    store.readonly = true;
    expect(requests[0]!.remove()).toBe(false);
    expect(viewIds(model)).toEqual(['v1', 'v2']);
  });

  test('a removal made later does not leave the vanished view current', () => {
    const { model } = database();
    const { picker, requests } = host(() => undefined);
    const ds = source(model, picker);
    ds.viewManager.setCurrentView('v1');
    ds.viewManager.viewDelete('v1');
    requests[0]!.remove();
    expect(ds.viewManager.currentViewId$.value).toBe('v2');
  });

  test('a deleted block asks nothing', () => {
    const { store, model } = database();
    const { picker, requests } = host();
    source(model, picker);
    store.deleteBlock(model);
    expect(requests).toHaveLength(0);
  });
});

describe('undoing and redoing a removal', () => {
  test('each undo and redo of it is reported once, along the chain', () => {
    const { store, model } = database();
    const { picker, history } = host();
    source(model, picker).viewManager.viewDelete('v2');
    expect(viewIds(model)).toEqual(['v1']);

    const ref = expect.objectContaining({ viewId: 'v2', sourceId: 's2' });
    store.undo();
    expect(viewIds(model)).toEqual(['v1', 'v2']);
    expect(history).toHaveBeenLastCalledWith(ref, 'undo');

    store.redo();
    expect(viewIds(model)).toEqual(['v1']);
    expect(history).toHaveBeenLastCalledWith(ref, 'redo');

    store.undo();
    expect(history).toHaveBeenLastCalledWith(ref, 'undo');
    expect(history).toHaveBeenCalledTimes(3);
  });

  test('an undo of anything else reports nothing', () => {
    const { store, model } = database();
    const { picker, history } = host();
    source(model, picker).viewManager.viewDelete('v2');
    store.captureSync();
    store.updateBlock(model, { title: new Text('Renamed') });
    store.undo();
    expect(history).not.toHaveBeenCalled();
  });

  test('a write that is not this client’s undo reports nothing', () => {
    const { store, model } = database();
    const { picker, history } = host();
    source(model, picker).viewManager.viewDelete('v2');
    // Untracked, like an update applied from a peer.
    store.withoutTransact(() => {
      store.transact(() => {
        model.props.views = VIEWS as never;
      });
    });
    expect(viewIds(model)).toEqual(['v1', 'v2']);
    expect(history).not.toHaveBeenCalled();
  });

  test('a host throwing from viewHistory does not break the undo', () => {
    const { store, model } = database();
    const { picker } = host();
    picker.viewHistory = () => {
      throw new Error('host');
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    source(model, picker).viewManager.viewDelete('v2');
    store.undo();
    expect(viewIds(model)).toEqual(['v1', 'v2']);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
