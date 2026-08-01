/**
 * US-1.8 spike — compatibility proof for an optional semantic `role` field on
 * surface (gfx primitive) elements.
 *
 * `TestShapeElement` deliberately declares no `role` accessor, so it plays the
 * part of an OLDER client: a library version shipped before `role` existed,
 * opening and editing a document written by a NEWER client.
 *
 * These tests document CURRENT behaviour. If one of them fails after a change
 * to the element model plumbing, the compatibility conclusions recorded in
 * `docs/spikes/us-1-8-role-field-compat.md` no longer hold.
 */
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test } from 'vitest';

import { effects } from '../../effects.js';
import type { SerializedElement } from '../../gfx/index.js';
import type { TestShapeElement } from '../test-gfx-element.js';
import {
  RootBlockSchemaExtension,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
} from '../test-schema.js';

effects();

const extensions = [RootBlockSchemaExtension, SurfaceBlockSchemaExtension];

const ROLE_KEY = 'role';
const ROLE_VALUE = 'wardley:component';

function setupSurface(collectionId = 'test-collection') {
  const collection = new TestWorkspace({
    id: collectionId,
    idGenerator: createAutoIncrementIdGenerator(),
  });

  collection.meta.initialize();
  const doc = collection.createDoc('home');
  const store = doc.getStore({ extensions });
  doc.load();

  const rootId = store.addBlock('test:page');
  const surfaceId = store.addBlock('test:surface', {}, rootId);

  return {
    store,
    surfaceModel: store.getBlock(surfaceId)!.model as SurfaceBlockModel,
  };
}

/**
 * Simulates the document state produced by a NEWER client: the element's Y.Map
 * carries a `role` key that the running (older) element class knows nothing
 * about.
 */
function addElementWithRole(surfaceModel: SurfaceBlockModel) {
  const id = surfaceModel.addElement({ type: 'testShape' });
  const element = surfaceModel.getElementById(id)! as TestShapeElement;

  surfaceModel.store.transact(() => {
    element.yMap.set(ROLE_KEY, ROLE_VALUE);
  });

  return { id, element };
}

describe('US-1.8 — unknown element prop, preserving paths', () => {
  test('an old client can read an unknown key it does not declare', () => {
    const { surfaceModel } = setupSurface();
    const { element } = addElementWithRole(surfaceModel);

    // no accessor exists for it, but the raw Y.Map keeps it
    expect(ROLE_KEY in element).toBe(false);
    expect(element.yMap.get(ROLE_KEY)).toBe(ROLE_VALUE);
  });

  test('writing a declared field (move/resize) does not clobber the unknown key', () => {
    const { surfaceModel } = setupSurface();
    const { id, element } = addElementWithRole(surfaceModel);

    // `updateElement` -> `@field` setter -> `yMap.set(prop, val)`: key by key,
    // never a whole-map rewrite.
    surfaceModel.updateElement(id, { xywh: '[10,10,200,200]' });
    surfaceModel.updateElement(id, { rotate: 45 });
    element.xywh = '[20,20,50,50]';

    expect(element.yMap.get(ROLE_KEY)).toBe(ROLE_VALUE);
  });

  test('stash/pop (drag & resize interaction) does not clobber the unknown key', () => {
    const { surfaceModel } = setupSurface();
    const { element } = addElementWithRole(surfaceModel);

    element.stash('xywh');
    element.xywh = '[5,5,10,10]';
    element.pop('xywh');

    expect(element.xywh).toBe('[5,5,10,10]');
    expect(element.yMap.get(ROLE_KEY)).toBe(ROLE_VALUE);
  });

  test('undo/redo of an old-client edit does not clobber the unknown key', () => {
    const { store, surfaceModel } = setupSurface();
    const { id, element } = addElementWithRole(surfaceModel);

    store.captureSync();
    store.resetHistory();

    surfaceModel.updateElement(id, { xywh: '[10,10,200,200]' });
    store.captureSync();

    store.undo();
    expect(element.xywh).toBe('[0,0,10,10]');
    expect(element.yMap.get(ROLE_KEY)).toBe(ROLE_VALUE);

    store.redo();
    expect(element.xywh).toBe('[10,10,200,200]');
    expect(element.yMap.get(ROLE_KEY)).toBe(ROLE_VALUE);
  });

  test('undoing the deletion of the element restores the unknown key', () => {
    const { store, surfaceModel } = setupSurface();
    const { id } = addElementWithRole(surfaceModel);

    store.captureSync();
    store.resetHistory();

    surfaceModel.deleteElement(id);
    store.captureSync();
    expect(surfaceModel.getElementById(id)).toBeNull();

    store.undo();

    // Yjs re-creates the nested Y.Map on undo, so the element must be read
    // back from the model — the previous `yMap` reference is stale.
    const restored = surfaceModel.getElementById(id);
    expect(restored).not.toBeNull();
    expect(restored!.yMap.get(ROLE_KEY)).toBe(ROLE_VALUE);
  });

  test('serialize() emits the unknown key (clipboard/snapshot write path)', () => {
    const { surfaceModel } = setupSurface();
    const { element } = addElementWithRole(surfaceModel);

    // `serialize()` is `yMap.toJSON()` — whole map, no field whitelist
    const serialized = element.serialize();
    expect(serialized[ROLE_KEY]).toBe(ROLE_VALUE);
  });
});

describe('US-1.8 — unknown element prop, LOSING paths', () => {
  test('LOSS: re-creating an element from its serialized props drops the unknown key', () => {
    const { surfaceModel } = setupSurface();
    const { element } = addElementWithRole(surfaceModel);

    const serialized = element.serialize();
    expect(serialized[ROLE_KEY]).toBe(ROLE_VALUE);

    // This is what duplicate / paste does: feed the serialized payload back
    // into `addElement`. `_createElementFromProps` copies props by ASSIGNING
    // them onto the model instance, so a key with no matching accessor lands
    // on the plain JS object and never reaches the Y.Map.
    const cloneId = surfaceModel.addElement(
      serialized as unknown as SerializedElement & { type: string }
    );
    const clone = surfaceModel.getElementById(cloneId)!;

    expect(clone.yMap.has('xywh')).toBe(true);
    // the unknown key is silently dropped
    expect(clone.yMap.has(ROLE_KEY)).toBe(false);
    expect(clone.serialize()[ROLE_KEY]).toBeUndefined();
  });

  test('LOSS: cross-document copy/paste drops the unknown key', () => {
    const source = setupSurface('doc-a');
    const target = setupSurface('doc-b');

    const { element } = addElementWithRole(source.surfaceModel);
    const clipboardPayload = JSON.parse(
      JSON.stringify(element.serialize())
    ) as SerializedElement;

    expect(clipboardPayload[ROLE_KEY]).toBe(ROLE_VALUE);

    const pastedId = target.surfaceModel.addElement(
      clipboardPayload as unknown as SerializedElement & { type: string }
    );
    const pasted = target.surfaceModel.getElementById(pastedId)!;

    expect(pasted.yMap.has(ROLE_KEY)).toBe(false);
  });

  test('LOSS: updateElement with an undeclared key does not persist it', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    surfaceModel.updateElement(id, { [ROLE_KEY]: ROLE_VALUE });

    // no accessor -> plain own property, invisible to every other peer
    expect(element.yMap.has(ROLE_KEY)).toBe(false);
    expect((element as unknown as Record<string, unknown>)[ROLE_KEY]).toBe(
      ROLE_VALUE
    );
  });
});
