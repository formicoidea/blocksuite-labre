/**
 * The frame manager never adopts a block a REMOTE peer added.
 *
 * Rule (PR #242): a cascade reacts to LOCAL transactions only. The canvas
 * half of `_watchElementAdded` already obeyed it (`elementAdded` is gated on
 * `local`); the block half did not — a remote `add` still ran
 * `addElementsToFrame`, i.e. `frame.addChildren`, a raw `store.transact` on
 * `childElementIds`. The authoring peer had already adopted the block and its
 * `childElementIds` arrives with the same sync, so the write was at best a
 * duplicate — and a readonly viewer must not write at all.
 */
import type { SurfaceBlockModel } from '@labre/affine-block-surface';
import { EdgelessFrameManager } from '@labre/affine-block-frame';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import type { FrameBlockModel } from '@labre/affine-model';
import type { GfxController } from '@labre/std/gfx';
import type { Store } from '@labre/store';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';

function createBoard(id: string) {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();

  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('#251') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });

  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;

  const addFrame = (xywh: string) => {
    const id = store.addBlock(
      'affine:frame',
      { xywh, title: new Text('frame') },
      surfaceId
    );
    return store.getBlock(id)!.model as FrameBlockModel;
  };

  return { store, surface, addFrame };
}

/**
 * The manager only touches a handful of `gfx` members; a stub keeps the spec
 * free of an editor host while running the real subscription code.
 */
function frameManagerFor(store: Store, surface: SurfaceBlockModel) {
  const updateElement = vi.fn();
  const gfx = {
    doc: store,
    surface,
    grid: { search: () => [] },
    layer: { generateIndex: () => 'a9' },
    getElementById: (id: string) =>
      surface.getElementById(id) ?? store.getModelById(id),
    updateElement,
    selection: { set() {} },
    std: { get() {} },
  };

  return {
    manager: new EdgelessFrameManager(gfx as unknown as GfxController),
    updateElement,
  };
}

const childIdsOf = (frame: FrameBlockModel) =>
  Object.keys(frame.props.childElementIds ?? {});

describe('the frame manager and a block added by another peer', () => {
  test.each([{ readonly: true }, { readonly: false }])(
    'a remote add above a frame is not adopted (readonly: $readonly)',
    ({ readonly }) => {
      const { store, surface, addFrame } = createBoard(`frame-${readonly}`);
      const frame = addFrame('[0,0,800,600]');
      const inside = addFrame('[100,100,100,100]');
      frameManagerFor(store, surface);

      expect(childIdsOf(frame)).toEqual([]);

      store.readonly = readonly;

      expect(() =>
        store.slots.blockUpdated.next({
          type: 'add',
          id: inside.id,
          flavour: 'affine:frame',
          model: inside,
          isLocal: false,
          init: false,
        })
      ).not.toThrow();

      expect(childIdsOf(frame)).toEqual([]);
    }
  );

  test('a local add above a frame is still adopted', () => {
    const { store, surface, addFrame } = createBoard('frame-local');
    const frame = addFrame('[0,0,800,600]');
    const inside = addFrame('[100,100,100,100]');
    frameManagerFor(store, surface);

    store.slots.blockUpdated.next({
      type: 'add',
      id: inside.id,
      flavour: 'affine:frame',
      model: inside,
      isLocal: true,
      init: false,
    });

    expect(childIdsOf(frame)).toEqual([inside.id]);
  });

  test('a local add on a readonly store is not adopted', () => {
    const { store, surface, addFrame } = createBoard('frame-local-readonly');
    const frame = addFrame('[0,0,800,600]');
    const inside = addFrame('[100,100,100,100]');
    frameManagerFor(store, surface);
    store.readonly = true;

    expect(() =>
      store.slots.blockUpdated.next({
        type: 'add',
        id: inside.id,
        flavour: 'affine:frame',
        model: inside,
        isLocal: true,
        init: false,
      })
    ).not.toThrow();

    expect(childIdsOf(frame)).toEqual([]);
  });

  /**
   * Guard for the duplicated-child bug (a group pasted into a frame came back
   * with a child twice): a block that a group already claims is not adopted, or
   * two containers list it and the next duplicate copies it twice. The canvas
   * half has had this `.group` guard all along; the block half lacked it.
   */
  test('a local add of a block a group already claims is not adopted', () => {
    const { store, surface, addFrame } = createBoard('frame-local-grouped');
    const frame = addFrame('[0,0,800,600]');
    const inside = addFrame('[100,100,100,100]');
    surface.addElement({ type: 'group', children: { [inside.id]: true } });
    frameManagerFor(store, surface);

    store.slots.blockUpdated.next({
      type: 'add',
      id: inside.id,
      flavour: 'affine:frame',
      model: inside,
      isLocal: true,
      init: false,
    });

    expect(childIdsOf(frame)).toEqual([]);
  });
});
