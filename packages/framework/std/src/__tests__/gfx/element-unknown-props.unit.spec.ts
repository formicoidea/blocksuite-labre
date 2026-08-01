/**
 * Compatibility proof for props a running element class does not declare —
 * e.g. an optional semantic `role` field added by a newer version of the
 * library (US-1.8).
 *
 * `TestShapeElement` deliberately declares no `role` accessor, so it plays the
 * part of an OLDER client: a library version shipped before `role` existed,
 * opening and editing a document written by a NEWER client.
 *
 * The US-1.8 spike (`docs/spikes/us-1-8-role-field-compat.md`) found two bulk
 * assignment sites that dropped such keys; they now forward them straight into
 * the element's Y.Map (`docs/spikes/us-1-8-unknown-props-preservation.md`).
 * Every path below must therefore PRESERVE the unknown key. If one of these
 * tests fails, an unknown prop is being lost again somewhere.
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

describe('US-1.8 — unknown element prop, element creation from props', () => {
  test('re-creating an element from its serialized props preserves the unknown key', () => {
    const { surfaceModel } = setupSurface();
    const { element } = addElementWithRole(surfaceModel);

    const serialized = element.serialize();
    expect(serialized[ROLE_KEY]).toBe(ROLE_VALUE);

    // This is what duplicate / paste does: feed the serialized payload back
    // into `addElement`. `_createElementFromProps` now forwards a key with no
    // matching accessor straight into the new element's Y.Map.
    const cloneId = surfaceModel.addElement(
      serialized as unknown as SerializedElement & { type: string }
    );
    const clone = surfaceModel.getElementById(cloneId)!;

    expect(clone.yMap.has('xywh')).toBe(true);
    expect(clone.yMap.get(ROLE_KEY)).toBe(ROLE_VALUE);
    expect(clone.serialize()[ROLE_KEY]).toBe(ROLE_VALUE);
  });

  test('the serialize -> addElement round trip is identical apart from the id', () => {
    const { surfaceModel } = setupSurface();
    const { element } = addElementWithRole(surfaceModel);

    surfaceModel.updateElement(element.id, { xywh: '[3,4,5,6]', rotate: 30 });

    const serialized = element.serialize();
    const cloneId = surfaceModel.addElement(
      serialized as unknown as SerializedElement & { type: string }
    );
    const clone = surfaceModel.getElementById(cloneId)!;

    const { id: _originalId, ...originalProps } = serialized;
    const { id: _cloneId, ...cloneProps } = clone.serialize();

    expect(cloneProps).toEqual(originalProps);
  });

  test('cross-document copy/paste preserves the unknown key', () => {
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

    expect(pasted.yMap.get(ROLE_KEY)).toBe(ROLE_VALUE);
  });

  test('"turn into linked doc" preserves the unknown key before deleting the source', () => {
    // The destructive path: `createLinkedDocFromEdgelessElements` writes each
    // element into the new doc with `surface.addElement(element.serialize())`,
    // then the caller deletes the originals. If the copy lost the key there
    // would be nothing left to recover it from.
    const source = setupSurface('doc-source');
    const linked = setupSurface('doc-linked');

    const { id, element } = addElementWithRole(source.surfaceModel);

    const movedId = linked.surfaceModel.addElement(
      element.serialize() as unknown as SerializedElement & { type: string }
    );
    source.surfaceModel.deleteElement(id);

    expect(source.surfaceModel.getElementById(id)).toBeNull();

    const moved = linked.surfaceModel.getElementById(movedId)!;
    expect(moved.yMap.get(ROLE_KEY)).toBe(ROLE_VALUE);
    expect(moved.serialize()[ROLE_KEY]).toBe(ROLE_VALUE);
  });
});

describe('US-1.8 — unknown element prop, bulk update', () => {
  test('updateElement with an undeclared key persists it', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    surfaceModel.updateElement(id, { [ROLE_KEY]: ROLE_VALUE });

    expect(element.yMap.get(ROLE_KEY)).toBe(ROLE_VALUE);
    expect(element.serialize()[ROLE_KEY]).toBe(ROLE_VALUE);
  });

  test('updateElement still routes a declared local prop away from the Y.Map', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    // `opacity` is an `@local()` accessor: the class knows the key, so it must
    // keep going through the accessor and stay out of the document.
    surfaceModel.updateElement(id, { opacity: 0.5 });

    expect(element.opacity).toBe(0.5);
    expect(element.yMap.has('opacity')).toBe(false);
  });
});

describe('US-1.8 — unknown element prop, unsafe keys', () => {
  // Object literals treat `__proto__:` as a prototype assignment, so the
  // payload has to be built the way a real clipboard payload is: from JSON.
  const pollutedPayload = () =>
    JSON.parse(
      JSON.stringify({
        type: 'testShape',
        [ROLE_KEY]: ROLE_VALUE,
        ['__proto__']: { polluted: true },
        constructor: { polluted: true },
        prototype: { polluted: true },
      })
    ) as SerializedElement & { type: string };

  test('addElement drops prototype-polluting keys and keeps the unknown one', () => {
    const { surfaceModel } = setupSurface();

    const id = surfaceModel.addElement(pollutedPayload());
    const element = surfaceModel.getElementById(id)!;

    expect(element.yMap.has('__proto__')).toBe(false);
    expect(element.yMap.has('constructor')).toBe(false);
    expect(element.yMap.has('prototype')).toBe(false);
    expect(element.serialize()[ROLE_KEY]).toBe(ROLE_VALUE);

    const cleanId = surfaceModel.addElement({ type: 'testShape' });
    expect(Object.getPrototypeOf(element)).toBe(
      Object.getPrototypeOf(surfaceModel.getElementById(cleanId)!)
    );
    expect(
      (Object.prototype as unknown as Record<string, unknown>).polluted
    ).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test('updateElement drops prototype-polluting keys', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    surfaceModel.updateElement(id, pollutedPayload());

    expect(element.yMap.has('__proto__')).toBe(false);
    expect(element.yMap.has('constructor')).toBe(false);
    expect(element.yMap.has('prototype')).toBe(false);
    expect(
      (Object.prototype as unknown as Record<string, unknown>).polluted
    ).toBeUndefined();
  });

  test('updateElement cannot rewrite the element identity', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    surfaceModel.updateElement(id, { id: 'forged-id', type: 'forgedType' });

    expect(element.id).toBe(id);
    expect(element.yMap.get('id')).toBe(id);
    expect(element.yMap.get('type')).toBe('testShape');
  });
});
