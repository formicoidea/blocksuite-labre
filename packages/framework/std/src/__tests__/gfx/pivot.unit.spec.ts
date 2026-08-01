/**
 * `pivotDocId` — the identity binding from a surface element to a host-owned
 * pivot record (MF1, ADR 0005), and the computed occurrence table over it.
 *
 * Two families of assertion, and the second is the one that matters most:
 *
 * 1. The field behaves like the optional base-class fields that preceded it
 *    (`role`, `validationExceptions`): absent by default, never stamped,
 *    round-trips, clearable. That is what buys "no version bump, no migration"
 *    on a class with no schema version at all.
 * 2. **Nothing is ever persisted about the reverse direction.** Backlinks are a
 *    recomputation, always — which is exactly why they cannot drift and cannot
 *    be corrupted (ADR 0005 § 5).
 */
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { effects } from '../../effects.js';
import { collectPivotOccurrences, isPivotBound } from '../../gfx/index.js';
import type { TestShapeElement } from '../test-gfx-element.js';
import {
  RootBlockSchemaExtension,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
} from '../test-schema.js';

effects();

const extensions = [RootBlockSchemaExtension, SurfaceBlockSchemaExtension];

const RECORD = 'pivot-payments';
const OTHER_RECORD = 'pivot-onboarding';

function setupSurface(id = 'pivot') {
  const collection = new TestWorkspace({
    id,
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
    surface: store.getBlock(surfaceId)!.model as SurfaceBlockModel,
  };
}

describe('the pivotDocId field', () => {
  let surface!: SurfaceBlockModel;

  beforeEach(() => {
    surface = setupSurface().surface;
  });

  test('an unbound element is byte-identical to one authored before the field', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;

    expect(el.pivotDocId).toBeUndefined();
    // The whole no-migration argument rests on this: `@field().init()` returns
    // early on an `undefined` default, so nothing at all lands in the shared
    // document for an element that never binds.
    expect(el.yMap.has('pivotDocId')).toBe(false);
    expect(el.serialize()).not.toHaveProperty('pivotDocId');
  });

  test('a binding given at creation reaches the shared document', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape', pivotDocId: RECORD })
    )!;

    expect(el.pivotDocId).toBe(RECORD);
    expect(el.yMap.get('pivotDocId')).toBe(RECORD);
  });

  test('an element written before the field existed opens unbound', () => {
    // A Y.Map with no `pivotDocId` key is exactly what an older client wrote.
    // The getter falls through to the accessor's fallback; nothing throws, and
    // no upgrade hook runs (there is none for surface elements).
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape', rotate: 42 })
    )! as TestShapeElement;

    expect(el.yMap.has('pivotDocId')).toBe(false);
    expect(el.pivotDocId).toBeUndefined();
    expect(el.rotate).toBe(42);
    expect(isPivotBound(el)).toBe(false);
  });

  test('the binding survives the serialize / re-create round trip', () => {
    // What paste, duplicate, alt-drag clone and template insertion all do:
    // replay serialized props through `_createElementFromProps`, which only
    // reaches the Y.Map for keys with a DECLARED accessor. Declaring
    // `pivotDocId` on the base class is what makes this work for every
    // primitive type at once (#67 recommendation 1) — a per-subclass
    // declaration would drop the binding on copy, invisibly, until reload.
    const sourceId = surface.addElement({
      type: 'testShape',
      pivotDocId: RECORD,
    });
    const { id: _id, ...props } = surface.getElementById(sourceId)!.serialize();

    const copy = surface.getElementById(surface.addElement(props))!;

    expect(copy.id).not.toBe(sourceId);
    expect(copy.pivotDocId).toBe(RECORD);
    expect(copy.yMap.get('pivotDocId')).toBe(RECORD);
    // Many elements to one record IS the point: the copy does not steal the
    // binding, both are occurrences.
    expect(surface.getElementById(sourceId)!.pivotDocId).toBe(RECORD);
  });

  test('an unbound element stays unbound through a round trip', () => {
    const sourceId = surface.addElement({ type: 'testShape' });
    const { id: _id, ...props } = surface.getElementById(sourceId)!.serialize();

    const copy = surface.getElementById(surface.addElement(props))!;

    expect(copy.pivotDocId).toBeUndefined();
    expect(copy.yMap.has('pivotDocId')).toBe(false);
  });

  test('re-binding to another record replaces, never accumulates', () => {
    const id = surface.addElement({ type: 'testShape', pivotDocId: RECORD });
    const el = surface.getElementById(id)!;

    surface.updateElement(id, { pivotDocId: OTHER_RECORD });

    expect(el.pivotDocId).toBe(OTHER_RECORD);
    // One element is one occurrence of one thing — an array of bindings was
    // explicitly rejected (ADR 0005 Consequences).
    expect(el.yMap.get('pivotDocId')).toBe(OTHER_RECORD);
  });

  test('clearField accepts it — unbinding removes the key, not just the value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const id = surface.addElement({ type: 'testShape', pivotDocId: RECORD });
    const el = surface.getElementById(id)!;

    el.clearField('pivotDocId');

    // The guard added with `clearField` (#78) refuses undeclared and STRUCTURAL
    // fields. `pivotDocId` is declared and optional, so it must pass — and it
    // must pass silently.
    expect(warn).not.toHaveBeenCalled();
    expect(el.yMap.has('pivotDocId')).toBe(false);
    expect(el.pivotDocId).toBeUndefined();
    expect(el.serialize()).not.toHaveProperty('pivotDocId');
    warn.mockRestore();
  });

  test('it is orthogonal to linkedDocId: an element may carry both', () => {
    const id = surface.addElement({
      type: 'testShape',
      pivotDocId: RECORD,
      linkedDocId: 'some-other-doc',
    });
    const el = surface.getElementById(id)!;

    // A hyperlink answers "where does this arrow take me"; a binding answers
    // "what is this an occurrence of". Neither clears the other.
    expect(el.pivotDocId).toBe(RECORD);
    expect(el.linkedDocId).toBe('some-other-doc');
  });
});

describe('isPivotBound', () => {
  let surface!: SurfaceBlockModel;

  beforeEach(() => {
    surface = setupSurface().surface;
  });

  test('narrows on a real binding, and rejects the empty string', () => {
    const bound = surface.getElementById(
      surface.addElement({ type: 'testShape', pivotDocId: RECORD })
    )!;
    const blank = surface.getElementById(
      surface.addElement({ type: 'testShape', pivotDocId: '' })
    )!;
    const unbound = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;

    expect(isPivotBound(bound)).toBe(true);
    // `@field()` writes whatever it is given; `''` means "none" and must never
    // send a provider looking for a document that cannot exist.
    expect(isPivotBound(blank)).toBe(false);
    expect(isPivotBound(unbound)).toBe(false);
  });
});

describe('collectPivotOccurrences', () => {
  let surface!: SurfaceBlockModel;

  beforeEach(() => {
    surface = setupSurface().surface;
  });

  test('finds every occurrence of one record on the surface', () => {
    const first = surface.addElement({ type: 'testShape', pivotDocId: RECORD });
    surface.addElement({ type: 'testShape' });
    const second = surface.addElement({ type: 'testShape', pivotDocId: RECORD });
    surface.addElement({ type: 'testShape', pivotDocId: OTHER_RECORD });

    expect(collectPivotOccurrences(surface, RECORD)).toEqual([
      { pivotDocId: RECORD, elementId: first, elementType: 'testShape' },
      { pivotDocId: RECORD, elementId: second, elementType: 'testShape' },
    ]);
  });

  test('with no record given, returns every bound element', () => {
    surface.addElement({ type: 'testShape', pivotDocId: RECORD });
    surface.addElement({ type: 'testShape' });
    surface.addElement({ type: 'testShape', pivotDocId: OTHER_RECORD });

    expect(collectPivotOccurrences(surface).map(o => o.pivotDocId)).toEqual([
      RECORD,
      OTHER_RECORD,
    ]);
  });

  test('an unbound board yields nothing, and an unknown record yields nothing', () => {
    surface.addElement({ type: 'testShape' });
    surface.addElement({ type: 'testShape' });

    expect(collectPivotOccurrences(surface)).toEqual([]);
    expect(collectPivotOccurrences(surface, RECORD)).toEqual([]);
  });

  test('a deleted element disappears from the table immediately', () => {
    const kept = surface.addElement({ type: 'testShape', pivotDocId: RECORD });
    const removed = surface.addElement({
      type: 'testShape',
      pivotDocId: RECORD,
    });

    surface.deleteElement(removed);

    // No index to invalidate and no cache to purge: the table is recomputed, so
    // it cannot report an occurrence that no longer exists.
    expect(collectPivotOccurrences(surface, RECORD)).toEqual([
      { pivotDocId: RECORD, elementId: kept, elementType: 'testShape' },
    ]);
  });

  test('unbinding removes the occurrence, and the record is never touched', () => {
    const id = surface.addElement({ type: 'testShape', pivotDocId: RECORD });
    surface.getElementById(id)!.clearField('pivotDocId');

    expect(collectPivotOccurrences(surface, RECORD)).toEqual([]);
  });

  test('nothing about the reverse direction is written back into the document', () => {
    const id = surface.addElement({ type: 'testShape', pivotDocId: RECORD });
    const before = JSON.stringify(surface.elements.getValue()!.toJSON());

    collectPivotOccurrences(surface, RECORD);
    collectPivotOccurrences(surface);

    // The invariant, asserted rather than trusted: no index, no reverse map, no
    // cache, and nothing written back. Collecting is a pure read.
    expect(JSON.stringify(surface.elements.getValue()!.toJSON())).toBe(before);
    expect(surface.getElementById(id)!.serialize()).toEqual(
      expect.objectContaining({ pivotDocId: RECORD })
    );
  });
});
