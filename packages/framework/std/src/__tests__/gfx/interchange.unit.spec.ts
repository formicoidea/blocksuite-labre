/**
 * `interchange` — the per-element, format-keyed carrier for verbatim foreign
 * matter (ADR 0012 § D2).
 *
 * This suite locks the CONTRACT of the field and nothing else. There is no
 * importer yet, and on purpose: the base model is dumb storage, so what has to
 * be pinned here is exactly what an importer will later rely on and what a
 * document written before the field must keep.
 *
 * 1. Absent by default, and **no Y.Map key written** — the whole
 *    "no version bump, no migration" argument on a class that has no schema
 *    version at all, exactly as `role`, `pivotDocId` and `validationExceptions`
 *    already argue it.
 * 2. It survives the serialize / re-create round trip, which is what paste,
 *    duplicate, alt-drag clone and template insertion all are. That is the loss
 *    site `docs/spikes/us-1-8-unknown-props-preservation.md` named, and the
 *    reason D2 chose a per-element field over a document-level side table.
 * 3. It is clearable through `clearField`, silently — it is declared and
 *    optional, so the #78 guard must let it through.
 */
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { effects } from '../../effects.js';
import type { ForeignInterchange } from '../../gfx/index.js';
import type { TestShapeElement } from '../test-gfx-element.js';
import {
  RootBlockSchemaExtension,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
} from '../test-schema.js';

effects();

const extensions = [RootBlockSchemaExtension, SurfaceBlockSchemaExtension];

/**
 * One payload exercising every member of {@link ForeignInterchange} at once, so
 * a shape Yjs turns out to refuse fails here rather than in a user's import.
 *
 * The TYPE is locked by `yarn build`, not by this suite: esbuild strips the
 * annotation, so dropping a member from `ForeignInterchange` leaves all of these
 * tests green and fails `tsc` on this literal instead. `carries every member the
 * type declares` below adds the runtime half, so the two together fail whichever
 * way a member goes missing.
 */
const BPMN_PAYLOAD: ForeignInterchange = {
  id: 'Activity_0x7f2a',
  element: 'bpmn:boundaryEvent',
  attrs: {
    'camunda:asyncBefore': 'true',
    isForCompensation: 'false',
  },
  children: [
    '<bpmn:extensionElements><camunda:formData /></bpmn:extensionElements>',
  ],
  di: ['<bpmndi:BPMNShape id="Shape_1" bpmnElement="Activity_0x7f2a" />'],
  quarantined: [
    {
      fragment: '<bpmn:incoming>Flow_gone</bpmn:incoming>',
      reason: 'dangling-ref',
    },
  ],
};

function setupSurface(id = 'interchange') {
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

describe('the interchange field', () => {
  let surface!: SurfaceBlockModel;

  beforeEach(() => {
    surface = setupSurface().surface;
  });

  test('an element that never met an import writes no key at all', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;

    expect(el.interchange).toBeUndefined();
    // The assertion the whole no-migration claim rests on: a board full of drawn
    // elements costs zero bytes for a feature it never used.
    //
    // Two INDEPENDENT mechanisms produce it, and the stronger one is the one
    // that is easy to miss. `@field()`'s `init` returns early on an `undefined`
    // default (`decorators/field.ts`) — but for a field declared on the BASE
    // class it never gets that far: the instance initializer runs before the
    // constructor body reaches `this.yMap = yMap`, so `this.yMap` is still
    // `undefined` and `init`'s write block is unreachable on the
    // `_createElementFromProps` path whatever the default says. (The early
    // return IS load-bearing for a SUBCLASS field, whose initializer runs after
    // `super()` returns. `interchange` is not one.)
    //
    // So this guarantee survives an initializer typo, a refactor of the default,
    // even a future `= {}` — which is worth knowing before judging some later
    // change to this line safe or unsafe.
    expect(el.yMap.has('interchange')).toBe(false);
    expect(el.serialize()).not.toHaveProperty('interchange');
  });

  test('the sample payload carries every member the type declares', () => {
    // The runtime half of the shape lock. `tsc` catches a member REMOVED from
    // `ForeignInterchange` (the literal above stops compiling); this catches one
    // that survives in the type but silently stops being exercised here, which
    // is how the encodability and round-trip assertions would quietly narrow.
    expect(Object.keys(BPMN_PAYLOAD).sort()).toEqual([
      'attrs',
      'children',
      'di',
      'element',
      'id',
      'quarantined',
    ]);
  });

  test('an element written before the field existed opens with no payload', () => {
    // A Y.Map with no `interchange` key is exactly what every client before
    // this change wrote. The getter falls through to the accessor's fallback;
    // nothing throws, and there is no upgrade hook for surface elements to run.
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape', rotate: 42 })
    )! as TestShapeElement;

    expect(el.yMap.has('interchange')).toBe(false);
    expect(el.interchange).toBeUndefined();
    expect(el.rotate).toBe(42);
  });

  test('a payload given at creation reaches the shared document intact', () => {
    const el = surface.getElementById(
      surface.addElement({
        type: 'testShape',
        interchange: { bpmn: BPMN_PAYLOAD },
      })
    )!;

    expect(el.interchange).toEqual({ bpmn: BPMN_PAYLOAD });
    // Read back off the Y.Map, not off the accessor's cache: the point of the
    // flat-JSON rule is that Yjs stores the whole blob as one encodable value.
    expect(el.yMap.get('interchange')).toEqual({ bpmn: BPMN_PAYLOAD });
  });

  test('it is keyed by format, and two formats coexist on one element', () => {
    // The key is the FORMAT, never the framework — the reason the field
    // generalizes past BPMN without a second decision (ADR 0012 § D2).
    const el = surface.getElementById(
      surface.addElement({
        type: 'testShape',
        interchange: {
          bpmn: { id: 'Task_1' },
          owm: { id: 'component-4', attrs: { evolution: '0.62' } },
        },
      })
    )!;

    expect(Object.keys(el.interchange!).sort()).toEqual(['bpmn', 'owm']);
    expect(el.interchange!.bpmn.id).toBe('Task_1');
    expect(el.interchange!.owm.attrs).toEqual({ evolution: '0.62' });
  });

  test('the payload survives the serialize / re-create round trip', () => {
    // What paste, duplicate, alt-drag clone and template insertion all do:
    // replay serialized props through `_createElementFromProps`, which only
    // reaches the Y.Map for keys with a DECLARED accessor. Declaring
    // `interchange` on the base class is what makes this work for every
    // primitive type at once — a per-subclass declaration would drop the
    // payload on copy, invisibly, until reload.
    const sourceId = surface.addElement({
      type: 'testShape',
      interchange: { bpmn: BPMN_PAYLOAD },
    });
    const { id: _id, ...props } = surface.getElementById(sourceId)!.serialize();

    const copy = surface.getElementById(surface.addElement(props))!;

    expect(copy.id).not.toBe(sourceId);
    expect(copy.interchange).toEqual({ bpmn: BPMN_PAYLOAD });
    expect(copy.yMap.get('interchange')).toEqual({ bpmn: BPMN_PAYLOAD });
    // The original is untouched: a copy is a copy of the values, never a second
    // reference to one object.
    expect(surface.getElementById(sourceId)!.interchange).toEqual({
      bpmn: BPMN_PAYLOAD,
    });
  });

  test('the copy owns its payload — mutating one does not reach the other', () => {
    const sourceId = surface.addElement({
      type: 'testShape',
      interchange: { bpmn: { id: 'Task_1', children: ['<a />'] } },
    });
    const { id: _id, ...props } = surface.getElementById(sourceId)!.serialize();
    const copyId = surface.addElement(props);

    surface.updateElement(copyId, {
      interchange: { bpmn: { id: 'Task_2', children: ['<b />'] } },
    });

    expect(surface.getElementById(sourceId)!.interchange).toEqual({
      bpmn: { id: 'Task_1', children: ['<a />'] },
    });
    expect(surface.getElementById(copyId)!.interchange).toEqual({
      bpmn: { id: 'Task_2', children: ['<b />'] },
    });
  });

  test('an element with no payload stays that way through a round trip', () => {
    const sourceId = surface.addElement({ type: 'testShape' });
    const { id: _id, ...props } = surface.getElementById(sourceId)!.serialize();

    const copy = surface.getElementById(surface.addElement(props))!;

    expect(copy.interchange).toBeUndefined();
    expect(copy.yMap.has('interchange')).toBe(false);
  });

  test('the serialized element JSON is identical in and out', () => {
    // Serialization is the clipboard payload and the template payload both, so
    // it is the shape an importer's output is actually judged on.
    const id = surface.addElement({
      type: 'testShape',
      interchange: { bpmn: BPMN_PAYLOAD },
    });
    const before = surface.getElementById(id)!.serialize();

    const { id: _id, ...props } = before;
    const after = surface
      .getElementById(surface.addElement(props))!
      .serialize();

    expect({ ...after, id: before.id }).toEqual(before);
  });

  test('the whole payload is encodable, so a save and a sync cannot break', () => {
    // `Y.Map.set` accepts values it cannot later encode, and only
    // `encodeStateAsUpdate` — persistence and sync — blows up. Asserting the
    // update encodes is the only honest way to pin "flat JSON, Yjs-friendly".
    surface.addElement({
      type: 'testShape',
      interchange: { bpmn: BPMN_PAYLOAD },
    });

    expect(() =>
      Y.encodeStateAsUpdate(surface.store.doc.spaceDoc)
    ).not.toThrow();
  });

  test('replacing the payload replaces it, and never accumulates', () => {
    const id = surface.addElement({
      type: 'testShape',
      interchange: { bpmn: { id: 'Task_1' } },
    });
    const el = surface.getElementById(id)!;

    surface.updateElement(id, { interchange: { bpmn: { id: 'Task_2' } } });

    // The whole blob is one Y.Map entry, written once per import: replacing it
    // is last-write-wins on the value, not a merge of two payloads.
    expect(el.interchange).toEqual({ bpmn: { id: 'Task_2' } });
  });

  test('clearField accepts it — the key is removed, not blanked', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const id = surface.addElement({
      type: 'testShape',
      interchange: { bpmn: BPMN_PAYLOAD },
    });
    const el = surface.getElementById(id)!;

    el.clearField('interchange');

    // The #78 guard refuses undeclared and STRUCTURAL fields. `interchange` is
    // declared and optional, so it must pass — and it must pass silently.
    expect(warn).not.toHaveBeenCalled();
    expect(el.yMap.has('interchange')).toBe(false);
    expect(el.interchange).toBeUndefined();
    expect(el.serialize()).not.toHaveProperty('interchange');
    warn.mockRestore();
  });

  test('a cleared element is indistinguishable from one that never carried a payload', () => {
    const carried = surface.addElement({
      type: 'testShape',
      interchange: { bpmn: BPMN_PAYLOAD },
    });
    surface.getElementById(carried)!.clearField('interchange');
    const virgin = surface.addElement({ type: 'testShape' });

    // Clearing leaves no tombstone: stripping an import must give back exactly
    // the document a hand-drawn board would have produced.
    //
    // Compared on VALUES, not just on the key set — a tombstone written as
    // `interchange: null`, or a payload blanked to `{}` rather than deleted,
    // both keep the key set identical and would pass a keys-only assertion.
    // `id`, `seed` and `index` necessarily differ between any two elements
    // (identity, roughness seed, fractional z-order), so they are excluded and
    // everything else must match exactly.
    const identity = ({
      id: _id,
      seed: _seed,
      index: _index,
      ...rest
    }: Record<string, unknown>) => rest;

    const cleared = surface.getElementById(carried)!.yMap.toJSON();
    const untouched = surface.getElementById(virgin)!.yMap.toJSON();

    expect(identity(cleared)).toEqual(identity(untouched));
    // Belt to that braces: the excluded three are PRESENT on both, so the
    // exclusion cannot be hiding a missing key.
    expect(Object.keys(cleared).sort()).toEqual(Object.keys(untouched).sort());
  });

  test('it is orthogonal to the other base-class fields', () => {
    const el = surface.getElementById(
      surface.addElement({
        type: 'testShape',
        role: 'bpmn:task',
        interchange: { bpmn: BPMN_PAYLOAD },
      })
    )!;

    // An imported element is a statement in the same sense a drawn one is
    // (ADR 0010): the payload records what the file said, the role records what
    // the element IS, and neither stands in for the other.
    expect(el.role).toBe('bpmn:task');
    expect(el.interchange).toEqual({ bpmn: BPMN_PAYLOAD });

    el.clearField('interchange');
    expect(el.role).toBe('bpmn:task');
  });
});
