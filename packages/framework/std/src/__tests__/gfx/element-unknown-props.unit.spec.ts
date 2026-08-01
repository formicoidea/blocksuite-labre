/**
 * Compatibility proof for props a running element class does not declare —
 * e.g. an optional semantic field added by a newer version of the library
 * (US-1.8).
 *
 * The probe key is `x-labre-unknown-probe` on purpose: it must be a key NO
 * element class will ever declare. Using a plausible field name (`role`, say)
 * would make this whole spec pass through the declared-accessor branch the day
 * that field ships, and the unknown-key coverage would evaporate in silence —
 * exactly what happened when `@field() role` landed on the base element model.
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
import * as Y from 'yjs';

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

const UNKNOWN_KEY = 'x-labre-unknown-probe';
const UNKNOWN_VALUE = 'wardley:component';

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
 * carries a key that the running (older) element class knows nothing about.
 */
function addElementWithUnknownProp(surfaceModel: SurfaceBlockModel) {
  const id = surfaceModel.addElement({ type: 'testShape' });
  const element = surfaceModel.getElementById(id)! as TestShapeElement;

  surfaceModel.store.transact(() => {
    element.yMap.set(UNKNOWN_KEY, UNKNOWN_VALUE);
  });

  return { id, element };
}

describe('US-1.8 — unknown element prop, preserving paths', () => {
  test('an old client can read an unknown key it does not declare', () => {
    const { surfaceModel } = setupSurface();
    const { element } = addElementWithUnknownProp(surfaceModel);

    // no accessor exists for it, but the raw Y.Map keeps it
    expect(UNKNOWN_KEY in element).toBe(false);
    expect(element.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
  });

  test('writing a declared field (move/resize) does not clobber the unknown key', () => {
    const { surfaceModel } = setupSurface();
    const { id, element } = addElementWithUnknownProp(surfaceModel);

    // `updateElement` -> `@field` setter -> `yMap.set(prop, val)`: key by key,
    // never a whole-map rewrite.
    surfaceModel.updateElement(id, { xywh: '[10,10,200,200]' });
    surfaceModel.updateElement(id, { rotate: 45 });
    element.xywh = '[20,20,50,50]';

    expect(element.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
  });

  test('stash/pop (drag & resize interaction) does not clobber the unknown key', () => {
    const { surfaceModel } = setupSurface();
    const { element } = addElementWithUnknownProp(surfaceModel);

    element.stash('xywh');
    element.xywh = '[5,5,10,10]';
    element.pop('xywh');

    expect(element.xywh).toBe('[5,5,10,10]');
    expect(element.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
  });

  test('undo/redo of an old-client edit does not clobber the unknown key', () => {
    const { store, surfaceModel } = setupSurface();
    const { id, element } = addElementWithUnknownProp(surfaceModel);

    store.captureSync();
    store.resetHistory();

    surfaceModel.updateElement(id, { xywh: '[10,10,200,200]' });
    store.captureSync();

    store.undo();
    expect(element.xywh).toBe('[0,0,10,10]');
    expect(element.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);

    store.redo();
    expect(element.xywh).toBe('[10,10,200,200]');
    expect(element.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
  });

  test('undoing the deletion of the element restores the unknown key', () => {
    const { store, surfaceModel } = setupSurface();
    const { id } = addElementWithUnknownProp(surfaceModel);

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
    expect(restored!.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
  });

  test('serialize() emits the unknown key (clipboard/snapshot write path)', () => {
    const { surfaceModel } = setupSurface();
    const { element } = addElementWithUnknownProp(surfaceModel);

    // `serialize()` is `yMap.toJSON()` — whole map, no field whitelist
    const serialized = element.serialize();
    expect(serialized[UNKNOWN_KEY]).toBe(UNKNOWN_VALUE);
  });
});

describe('US-1.8 — unknown element prop, element creation from props', () => {
  test('re-creating an element from its serialized props preserves the unknown key', () => {
    const { surfaceModel } = setupSurface();
    const { element } = addElementWithUnknownProp(surfaceModel);

    const serialized = element.serialize();
    expect(serialized[UNKNOWN_KEY]).toBe(UNKNOWN_VALUE);

    // This is what duplicate / paste does: feed the serialized payload back
    // into `addElement`. `_createElementFromProps` now forwards a key with no
    // matching accessor straight into the new element's Y.Map.
    const cloneId = surfaceModel.addElement(
      serialized as unknown as SerializedElement & { type: string }
    );
    const clone = surfaceModel.getElementById(cloneId)!;

    expect(clone.yMap.has('xywh')).toBe(true);
    expect(clone.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
    expect(clone.serialize()[UNKNOWN_KEY]).toBe(UNKNOWN_VALUE);
  });

  test('the serialize -> addElement round trip is identical apart from the id', () => {
    const { surfaceModel } = setupSurface();
    const { element } = addElementWithUnknownProp(surfaceModel);

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

    const { element } = addElementWithUnknownProp(source.surfaceModel);
    const clipboardPayload = JSON.parse(
      JSON.stringify(element.serialize())
    ) as SerializedElement;

    expect(clipboardPayload[UNKNOWN_KEY]).toBe(UNKNOWN_VALUE);

    const pastedId = target.surfaceModel.addElement(
      clipboardPayload as unknown as SerializedElement & { type: string }
    );
    const pasted = target.surfaceModel.getElementById(pastedId)!;

    expect(pasted.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
  });

  test('"turn into linked doc" preserves the unknown key before deleting the source', () => {
    // The destructive path: `createLinkedDocFromEdgelessElements` writes each
    // element into the new doc with `surface.addElement(element.serialize())`,
    // then the caller deletes the originals. If the copy lost the key there
    // would be nothing left to recover it from.
    const source = setupSurface('doc-source');
    const linked = setupSurface('doc-linked');

    const { id, element } = addElementWithUnknownProp(source.surfaceModel);

    const movedId = linked.surfaceModel.addElement(
      element.serialize() as unknown as SerializedElement & { type: string }
    );
    source.surfaceModel.deleteElement(id);

    expect(source.surfaceModel.getElementById(id)).toBeNull();

    const moved = linked.surfaceModel.getElementById(movedId)!;
    expect(moved.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
    expect(moved.serialize()[UNKNOWN_KEY]).toBe(UNKNOWN_VALUE);
  });
});

describe('US-1.8 — unknown element prop, bulk update', () => {
  test('updateElement with an undeclared key persists it', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    surfaceModel.updateElement(id, { [UNKNOWN_KEY]: UNKNOWN_VALUE });

    expect(element.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
    expect(element.serialize()[UNKNOWN_KEY]).toBe(UNKNOWN_VALUE);
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

    // `externalXYWH` stacks `@watch()` on top of `@local()`. Decorator `init`
    // functions chain, so the local registry still sees it — assert it, because
    // a break here would silently start writing a local prop to the document.
    surfaceModel.updateElement(id, { externalXYWH: '[1,1,1,1]' });

    expect(element.externalXYWH).toBe('[1,1,1,1]');
    expect(element.yMap.has('externalXYWH')).toBe(false);
  });
});

describe('US-1.8 — unknown element prop, unsafe keys', () => {
  // Object literals treat `__proto__:` as a prototype assignment, so the
  // payload has to be built the way a real clipboard payload is: from JSON.
  const pollutedPayload = () =>
    JSON.parse(
      JSON.stringify({
        type: 'testShape',
        [UNKNOWN_KEY]: UNKNOWN_VALUE,
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
    expect(element.serialize()[UNKNOWN_KEY]).toBe(UNKNOWN_VALUE);

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

/**
 * The routing branch is the load-bearing part of this change, so it is tested
 * against what `key in element` used to match and must no longer: methods,
 * getter-only derived props, and internal instance fields.
 */
describe('US-1.8 — unknown element prop, routing does not touch the instance', () => {
  test('a data key named like a method leaves the method intact', () => {
    const { surfaceModel } = setupSurface();

    const id = surfaceModel.addElement({
      type: 'testShape',
      serialize: 'pwned',
    } as unknown as SerializedElement & { type: string });
    const element = surfaceModel.getElementById(id)!;

    // the method still resolves through the prototype and still runs
    expect(typeof element.serialize).toBe('function');
    expect(Object.hasOwn(element, 'serialize')).toBe(false);

    // ...and the data lands in the document, where it shadows nothing
    expect(element.yMap.get('serialize')).toBe('pwned');
    expect(element.serialize()['serialize']).toBe('pwned');
  });

  test('a data key named like an internal field leaves the internals intact', () => {
    const { surfaceModel } = setupSurface();

    const id = surfaceModel.addElement({
      type: 'testShape',
      _local: 'junk',
    } as unknown as SerializedElement & { type: string });
    const element = surfaceModel.getElementById(id)!;

    // reading a derived prop used to throw `this._local.set is not a function`
    expect(element.deserializedXYWH).toEqual([0, 0, 10, 10]);
    expect(element.yMap.get('_local')).toBe('junk');
  });

  test.each([
    'x',
    'y',
    'w',
    'h',
    'group',
    'groups',
    'connectable',
    'isConnected',
    'elementBound',
    'externalBound',
    'responseBound',
    'deserializedXYWH',
  ])(
    'a getter-only prop named %s is treated as data, not assigned',
    getterOnly => {
      const { surfaceModel } = setupSurface();

      // addElement used to abort entirely: the TypeError from assigning to a
      // getter-only accessor escaped and no element was created at all.
      const id = surfaceModel.addElement({
        type: 'testShape',
        [getterOnly]: 3,
        [UNKNOWN_KEY]: UNKNOWN_VALUE,
      } as unknown as SerializedElement & { type: string });

      const element = surfaceModel.getElementById(id);
      expect(element).not.toBeNull();
      expect(element!.yMap.get(getterOnly)).toBe(3);
      // the prop after it in the same payload is not lost
      expect(element!.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
    }
  );

  test('updateElement no longer swallows the props after a getter-only key', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    // The TypeError raised by `element.x = 3` used to be swallowed by
    // `store.transact`: `xywh` was written, `x` threw, and every prop after it
    // — here the unknown probe — was silently dropped with no exception for
    // the caller. That is the exact failure mode this change exists to remove.
    surfaceModel.updateElement(id, {
      xywh: '[7,7,7,7]',
      x: 3,
      [UNKNOWN_KEY]: UNKNOWN_VALUE,
    });

    expect(element.xywh).toBe('[7,7,7,7]');
    expect(element.yMap.get('x')).toBe(3);
    expect(element.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
  });
});

/**
 * `Y.Map.set` accepts values it cannot encode. The document then looks fine —
 * `serialize()` works, `encodeStateVector` works — while `encodeStateAsUpdate`,
 * i.e. persistence and sync, throws for good. No user action can remove the
 * key. So the unknown branch admits only provably encodable values.
 */
describe('US-1.8 — unknown element prop, value encodability', () => {
  const encodes = (surfaceModel: SurfaceBlockModel) => {
    // throws RangeError: Maximum call stack size exceeded on a cyclic value
    Y.encodeStateAsUpdate(surfaceModel.store.doc.spaceDoc);
    return true;
  };

  test('a cyclic value is dropped and the document stays encodable', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;

    surfaceModel.updateElement(id, {
      cyc: cyclic,
      [UNKNOWN_KEY]: UNKNOWN_VALUE,
    });

    expect(element.yMap.has('cyc')).toBe(false);
    // the rest of the payload still goes through
    expect(element.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
    expect(encodes(surfaceModel)).toBe(true);
  });

  test('a cyclic value pasted through addElement is dropped too', () => {
    const { surfaceModel } = setupSurface();

    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;

    const id = surfaceModel.addElement({
      type: 'testShape',
      cyc: cyclic,
    } as unknown as SerializedElement & { type: string });

    expect(surfaceModel.getElementById(id)!.yMap.has('cyc')).toBe(false);
    expect(encodes(surfaceModel)).toBe(true);
  });

  test('a function value is dropped cleanly', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    surfaceModel.updateElement(id, {
      fn: () => 'nope',
      [UNKNOWN_KEY]: UNKNOWN_VALUE,
    });

    expect(element.yMap.has('fn')).toBe(false);
    expect(element.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
    expect(encodes(surfaceModel)).toBe(true);
  });

  test('a null-prototype object is dropped and the payload after it survives', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    // Yjs dispatches on `value.constructor`, which is `undefined` here, so
    // `Y.Map.set` throws `Unexpected content type` — inside `store.transact`,
    // which swallows it and drops every remaining key of the payload.
    surfaceModel.updateElement(id, {
      nullproto: Object.assign(Object.create(null), { a: 1 }),
      [UNKNOWN_KEY]: UNKNOWN_VALUE,
    });

    expect(element.yMap.has('nullproto')).toBe(false);
    expect(element.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
    expect(encodes(surfaceModel)).toBe(true);
  });

  test('a nested null-prototype object is dropped too', () => {
    const { surfaceModel } = setupSurface();

    const id = surfaceModel.addElement({
      type: 'testShape',
      wrapped: { inner: Object.assign(Object.create(null), { a: 1 }) },
      [UNKNOWN_KEY]: UNKNOWN_VALUE,
    } as unknown as SerializedElement & { type: string });
    const element = surfaceModel.getElementById(id)!;

    expect(element.yMap.has('wrapped')).toBe(false);
    expect(element.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
    expect(encodes(surfaceModel)).toBe(true);
  });

  test('a throwing getter is dropped and the payload after it survives', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    // `Object.values` invokes getters, so the inspection itself can raise. The
    // guard must absorb that instead of letting it reach `store.transact`.
    const evil = {
      get boom(): never {
        throw new Error('getter blew up');
      },
    };

    expect(() =>
      surfaceModel.updateElement(id, {
        evil,
        [UNKNOWN_KEY]: UNKNOWN_VALUE,
      })
    ).not.toThrow();

    expect(element.yMap.has('evil')).toBe(false);
    expect(element.yMap.get(UNKNOWN_KEY)).toBe(UNKNOWN_VALUE);
    expect(encodes(surfaceModel)).toBe(true);
  });

  test('a class instance is dropped rather than silently flattened', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    class Exotic {
      constructor(readonly a = 1) {}
    }

    surfaceModel.updateElement(id, { exotic: new Exotic() });

    expect(element.yMap.has('exotic')).toBe(false);
    expect(encodes(surfaceModel)).toBe(true);
  });

  test('nested plain JSON is admitted', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    const nested = { a: [1, 'two', null, { b: true }] };
    surfaceModel.updateElement(id, { nested });

    expect(element.yMap.get('nested')).toEqual(nested);
    expect(encodes(surfaceModel)).toBe(true);
  });

  test('an undefined value never mints a phantom key', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    // Spreading an absent option is an everyday idiom; it must not create a
    // real Y.Map key that `serialize()` cannot even show.
    surfaceModel.updateElement(id, { ghost: undefined });

    expect(element.yMap.has('ghost')).toBe(false);
  });

  test('a declared field can still be cleared with undefined', () => {
    const { surfaceModel } = setupSurface();
    const id = surfaceModel.addElement({ type: 'testShape' });
    const element = surfaceModel.getElementById(id)!;

    surfaceModel.updateElement(id, { linkedDocId: 'doc-1' });
    expect(element.linkedDocId).toBe('doc-1');

    // the undefined guard applies to the unknown branch only
    surfaceModel.updateElement(id, { linkedDocId: undefined });
    expect(element.linkedDocId).toBeUndefined();
  });
});
