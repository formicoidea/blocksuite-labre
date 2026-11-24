/**
 * An editor takes its surface middlewares back when it unmounts.
 *
 * `SurfaceMiddlewareExtension.mounted` installed the editor's middlewares on
 * the store's surface model and never took them out: the surface, which
 * outlives the editor (a host keeps its store open across mounts and mode
 * switches), held the unmounted editor's middlewares, each closing over its
 * `BlockStdScope` — the std, its DI container and, through `std.host`, the
 * whole detached editor tree. One per surface, until the next mount on that
 * store; for a host that opens many documents on the canvas, one detached
 * editor per document opened. Meanwhile a write to the surface with no
 * editor mounted still ran the dead editor's `beforeAdd` (last-used props,
 * index from a layer manager that had stopped listening). On a store with
 * no surface yet, the effect waiting for one was never disposed either, so
 * a surface added after the editor left received that editor's middlewares.
 *
 * What it would have caught: each of those three, read on the surface's
 * `addElement` (which middleware ran, and for which editor). Two editors on
 * one store (a mode switch mounts the next before the last is gone) keep
 * the mounted one's. The retained memory itself is measured in the
 * integration suite (`editor-teardown.spec.ts`).
 */
import type { SurfaceMiddleware } from '../../gfx/model/surface/surface-model.js';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { afterEach, describe, expect, test } from 'vitest';

import { effects } from '../../effects.js';
import { SurfaceMiddlewareBuilder } from '../../gfx/surface-middleware.js';
import type { BlockStdScope } from '../../scope/index.js';
import { TestEditorContainer } from '../test-editor.js';
import {
  RootBlockSchemaExtension,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
} from '../test-schema.js';
import { testSpecs } from '../test-spec.js';

effects();

/** Which editor's `beforeAdd` ran, one entry per element added. */
const ran: BlockStdScope[] = [];

class RecordingMiddlewareBuilder extends SurfaceMiddlewareBuilder {
  static override key = 'test-recording';

  middleware: SurfaceMiddleware = ctx => {
    if (ctx.type === 'beforeAdd') ran.push(this.std);
  };
}

const specs = [...testSpecs, RecordingMiddlewareBuilder];

const mounted: TestEditorContainer[] = [];

afterEach(() => {
  mounted.splice(0).forEach(editor => editor.remove());
  ran.length = 0;
});

function createStore() {
  const collection = new TestWorkspace({
    id: 'test-collection',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  collection.meta.initialize();
  const doc = collection.createDoc('home');
  const store = doc.getStore({
    extensions: [RootBlockSchemaExtension, SurfaceBlockSchemaExtension],
  });
  doc.load();
  const rootId = store.addBlock('test:page');
  return { store, rootId };
}

async function mount(store: TestEditorContainer['doc']) {
  const editor = new TestEditorContainer();
  editor.doc = store;
  editor.specs = specs;
  document.body.append(editor);
  mounted.push(editor);
  await editor.updateComplete;
  return editor;
}

const surfaceOf = (store: TestEditorContainer['doc'], id: string) =>
  store.getBlock(id)!.model as SurfaceBlockModel;

describe('surface middlewares follow the mounted editor', () => {
  test('an unmounted editor no longer runs on the surface', async () => {
    const { store, rootId } = createStore();
    const surfaceId = store.addBlock('test:surface', {}, rootId);
    const surface = surfaceOf(store, surfaceId);

    const editor = await mount(store);
    surface.addElement({ type: 'testShape' });
    expect(ran).toEqual([editor.std]);

    editor.remove();
    surface.addElement({ type: 'testShape' });
    expect(ran, 'nothing ran after the unmount').toEqual([editor.std]);
  });

  test('the editor still mounted keeps its middlewares when an earlier one leaves', async () => {
    const { store, rootId } = createStore();
    const surface = surfaceOf(
      store,
      store.addBlock('test:surface', {}, rootId)
    );

    const first = await mount(store);
    const second = await mount(store);
    first.remove();
    surface.addElement({ type: 'testShape' });

    expect(ran).toEqual([second.std]);
  });

  /**
   * Two editable scopes on one store (a host's split view): the later one
   * leaving must hand the surface back to the earlier one, not leave it bare.
   * Taking the middlewares out wholesale left the editor still mounted with
   * none — no `beforeAdd`, so no index, no user layer (ADR 0031), no
   * last-used props on what it created.
   */
  test('the editor still mounted gets its middlewares back when a later one leaves', async () => {
    const { store, rootId } = createStore();
    const surface = surfaceOf(
      store,
      store.addBlock('test:surface', {}, rootId)
    );

    const first = await mount(store);
    const second = await mount(store);
    second.remove();
    surface.addElement({ type: 'testShape' });

    expect(ran).toEqual([first.std]);
  });

  test('a surface added after the editor left receives nothing from it', async () => {
    const { store, rootId } = createStore();

    const editor = await mount(store);
    editor.remove();
    const surface = surfaceOf(
      store,
      store.addBlock('test:surface', {}, rootId)
    );
    // `onSurfaceAdded` is an effect: let it see the new block.
    await Promise.resolve();
    surface.addElement({ type: 'testShape' });

    expect(ran).toEqual([]);
  });
});
