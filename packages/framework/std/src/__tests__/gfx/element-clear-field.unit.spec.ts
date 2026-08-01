/**
 * `GfxPrimitiveElementModel.clearField` — the missing half of `@field()`, and
 * what it refuses.
 *
 * The method exists because the `@field()` setter is unconditional: assigning
 * `undefined` to an optional field still writes the key, so the element stops
 * being byte-identical to one that never had it and the phantom syncs to every
 * peer. `clearField` removes the key instead.
 *
 * That makes it a direct write path into the element's Y.Map, on the class that
 * carries the document format, exported by `@labre/std` and callable by a host —
 * the same shape of exposure `_assignElementProp` was given a deny-list for in
 * `docs/spikes/us-1-8-unknown-props-preservation.md`, where the list is called
 * out as load-bearing for security rather than hygiene. This spec is that
 * deny-list's counterpart on the delete side.
 */
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { effects } from '../../effects.js';
import type { TestShapeElement } from '../test-gfx-element.js';
import {
  RootBlockSchemaExtension,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
} from '../test-schema.js';

effects();

const extensions = [RootBlockSchemaExtension, SurfaceBlockSchemaExtension];

/** A key no element class declares — an annotation from a newer client. */
const UNKNOWN_KEY = 'x-labre-unknown-probe';

function setupSurface() {
  const collection = new TestWorkspace({
    id: 'clear-field',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  collection.meta.initialize();
  const doc = collection.createDoc('home');
  const store = doc.getStore({ extensions });
  doc.load();

  const rootId = store.addBlock('test:page');
  const surfaceId = store.addBlock('test:surface', {}, rootId);
  return store.getBlock(surfaceId)!.model as SurfaceBlockModel;
}

describe('clearField', () => {
  let surface!: SurfaceBlockModel;
  let element!: TestShapeElement;

  beforeEach(() => {
    surface = setupSurface();
    const id = surface.addElement({ type: 'testShape' });
    element = surface.getElementById(id)! as TestShapeElement;
  });

  test('removes an optional field, key and all', () => {
    element.validationExceptions = [{ ruleId: 'a.rule', at: 1 }];
    expect(element.yMap.has('validationExceptions')).toBe(true);

    element.clearField('validationExceptions');

    // Gone from the DOCUMENT, not merely reading as undefined: assigning
    // `undefined` through the accessor leaves the key behind.
    expect(element.yMap.has('validationExceptions')).toBe(false);
    expect(element.validationExceptions).toBeUndefined();
    // `serialize()` is `yMap.toJSON()`, i.e. what a snapshot ships.
    expect('validationExceptions' in element.serialize()).toBe(false);
  });

  test('is a no-op on a field that was never written', () => {
    expect(() => element.clearField('validationExceptions')).not.toThrow();
    expect(element.yMap.has('validationExceptions')).toBe(false);
  });

  describe('refuses what has no meaningful absent state', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    test('keeps the z-order key', () => {
      // Removing it breaks stacking SILENTLY: no throw, the layer manager just
      // sorts the element nowhere.
      const index = element.index;
      element.clearField('index');

      expect(element.yMap.has('index')).toBe(true);
      expect(element.index).toBe(index);
      expect(console.warn).toHaveBeenCalled();
    });

    test('keeps the geometry', () => {
      // Removing it collapses `elementBound` to {0,0,0,0} and makes the
      // renderer throw `"undefined" is not valid JSON` on every frame.
      element.clearField('xywh');

      expect(element.yMap.has('xywh')).toBe(true);
      expect(element.xywh).toBe('[0,0,10,10]');
      expect(element.elementBound.w).toBeGreaterThan(0);
    });

    test('keeps the roughness seed', () => {
      element.clearField('seed');
      expect(element.yMap.has('seed')).toBe(true);
    });
  });

  describe('refuses what it does not own', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    test('will not delete an unknown key preserved for a newer client', () => {
      surface.store.transact(() => {
        element.yMap.set(UNKNOWN_KEY, 'wardley:component');
      });

      element.clearField(UNKNOWN_KEY);

      // Deleting it is precisely the data loss the unknown-props change exists
      // to prevent — an older client must not be able to strip a newer one's
      // annotation, from either direction.
      expect(element.yMap.get(UNKNOWN_KEY)).toBe('wardley:component');
      expect(console.warn).toHaveBeenCalled();
    });

    test('will not delete a key that is not element data at all', () => {
      for (const key of ['serialize', 'stash', '__proto__', 'id', 'type']) {
        expect(() => element.clearField(key)).not.toThrow();
      }
      // Untouched, and still a working element.
      expect(element.serialize).toBeTypeOf('function');
      expect(element.id).toBeTruthy();
      expect(element.type).toBe('testShape');
    });

    test('will not delete a @local() prop, which is not in the document', () => {
      element.opacity = 0.5;
      element.clearField('opacity');
      expect(element.opacity).toBe(0.5);
    });
  });
});
