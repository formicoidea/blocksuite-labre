/**
 * ADR 0049 — a BPMN pool's title sizes are two optional stored keys,
 * `nameFontSize` and `laneFontSize`, on the `bpmnPool` element.
 *
 * `packages/affine/model` is the document format, so the assertions that
 * matter are the NEGATIVE ones. This spec would have caught:
 * - a default other than `undefined` on either field: `@field()` would write it
 *   into every pool created from then on, and a pool would no longer be
 *   byte-identical to one written before the fields existed;
 * - a field that writes on LOAD: opening an existing document must leave its
 *   Y.Map untouched, or every open edits every pool and syncs it to every peer;
 * - a size that does not round-trip through the Y.Map, or one write that
 *   touches the other field.
 *
 * Built on a real `Y.Doc`, the harness of `connector-end-labels.unit.spec.ts`.
 */
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { BpmnPoolElementModel } from '../index.js';

/** A pool over `yMap`, created (`skipField: false`) or loaded (`true`). */
function pool(yMap: Y.Map<unknown>, doc: Y.Doc, loading: boolean) {
  const surface = {
    _decoratorState: { creating: false, deriving: false, skipField: loading },
    getElementById: () => null,
    store: {
      readonly: false,
      transact: (fn: () => void) => doc.transact(fn),
    },
  };
  return new BpmnPoolElementModel({
    id: 'pool-1',
    yMap,
    model: surface as never,
    stashedStore: new Map(),
    onChange: () => {},
  });
}

function created() {
  const doc = new Y.Doc();
  const yMap = new Y.Map<unknown>();
  doc.getMap<Y.Map<unknown>>('elements').set('pool-1', yMap);
  return { doc, yMap, model: pool(yMap, doc, false) };
}

/** Two sizes the toolbar offers, neither of them a default. */
const TITLE_SIZE = 24;
const LANE_SIZE = 11;

const storedKeys = (yMap: Y.Map<unknown>) =>
  Array.from(yMap.keys()).sort((a, b) => a.localeCompare(b));

describe('bpmnPool title sizes: stored format (ADR 0049)', () => {
  test('a new pool stores no size key', () => {
    const { model, yMap } = created();

    expect(model.nameFontSize).toBeUndefined();
    expect(model.laneFontSize).toBeUndefined();
    // Every key a pool stored before ADR 0049 — no more, no less. A key this
    // list does not name is a new default somebody started writing.
    expect(storedKeys(yMap)).toEqual([
      'index',
      'name',
      'resizeEnabled',
      'rotate',
      'seed',
      'xywh',
    ]);
  });

  test('opening a pool written without the keys writes nothing', () => {
    const { doc } = created();
    const update = Y.encodeStateAsUpdate(doc);

    const reopened = new Y.Doc();
    Y.applyUpdate(reopened, update);
    const yMap = reopened
      .getMap<Y.Map<unknown>>('elements')
      .get('pool-1') as Y.Map<unknown>;
    const stateBefore = Y.encodeStateVector(reopened);
    const jsonBefore = JSON.stringify(reopened.toJSON());

    const model = pool(yMap, reopened, true);

    expect(model.nameFontSize).toBeUndefined();
    expect(model.laneFontSize).toBeUndefined();
    expect(Y.encodeStateVector(reopened)).toEqual(stateBefore);
    expect(JSON.stringify(reopened.toJSON())).toBe(jsonBefore);
    expect(yMap.has('nameFontSize')).toBe(false);
    expect(yMap.has('laneFontSize')).toBe(false);
  });

  test('each size round-trips on its own key and leaves the other absent', () => {
    const { doc, model, yMap } = created();

    model.nameFontSize = TITLE_SIZE;
    expect(yMap.get('nameFontSize')).toBe(TITLE_SIZE);
    expect(yMap.has('laneFontSize')).toBe(false);

    model.laneFontSize = LANE_SIZE;
    expect(yMap.get('laneFontSize')).toBe(LANE_SIZE);

    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(doc));
    const peerMap = peer
      .getMap<Y.Map<unknown>>('elements')
      .get('pool-1') as Y.Map<unknown>;
    const loaded = pool(peerMap, peer, true);
    expect(loaded.nameFontSize).toBe(TITLE_SIZE);
    expect(loaded.laneFontSize).toBe(LANE_SIZE);
  });
});
