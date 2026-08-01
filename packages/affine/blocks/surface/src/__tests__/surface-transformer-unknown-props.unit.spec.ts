/**
 * US-1.8 spike — does the surface SNAPSHOT round-trip preserve element keys
 * that the running client does not know about?
 *
 * `SurfaceBlockTransformer` is the doc-level export/import path (whole-doc
 * copy, template insertion, drag-handle cross-doc drop). It is the counterpart
 * of the edgeless clipboard path proven in
 * `packages/framework/std/src/__tests__/gfx/element-unknown-props.unit.spec.ts`.
 *
 * See `docs/spikes/us-1-8-role-field-compat.md`.
 *
 * Note: a `Y.Map` that is not integrated into a `Y.Doc` keeps its entries in
 * `_prelimContent`, where `get`/`forEach` cannot see them — every map below is
 * therefore attached to a real doc before being read.
 */
import type {
  DraftModel,
  FromSnapshotPayload,
  ToSnapshotPayload,
} from '@labre/store';
import { Boxed } from '@labre/store';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { SurfaceBlockTransformer } from '../surface-transformer.js';

const ROLE_KEY = 'role';
const ROLE_VALUE = 'wardley:component';

/**
 * A surface whose single element carries a key written by a NEWER client and
 * unknown to the running one.
 */
function makeSurfaceModelStub() {
  const doc = new Y.Doc();
  const elementsYMap = new Y.Map<Y.Map<unknown>>();
  const element = new Y.Map<unknown>();

  const boxed = new Boxed(elementsYMap);
  doc.getMap('blocks').set('elements', boxed.yMap);

  elementsYMap.set('el-1', element);
  element.set('type', 'shape');
  element.set('id', 'el-1');
  element.set('xywh', '[0,0,100,100]');
  element.set('index', 'a0');
  element.set(ROLE_KEY, ROLE_VALUE);

  return {
    doc,
    model: {
      id: 'surface-1',
      flavour: 'affine:surface',
      version: 5,
      keys: ['elements'],
      props: { elements: boxed },
    } as unknown as DraftModel,
  };
}

/** Integrate a detached Y.Map into a doc so its entries become readable. */
function attach<T extends Y.Map<unknown>>(yMap: T): T {
  const doc = new Y.Doc();
  doc.getMap('probe').set('value', yMap);
  return yMap;
}

describe('US-1.8 — surface snapshot round-trip', () => {
  test('toSnapshot emits every element key, including unknown ones', () => {
    const transformer = new SurfaceBlockTransformer(new Map());
    const snapshot = transformer.toSnapshot({
      model: makeSurfaceModelStub().model,
    } as unknown as ToSnapshotPayload<never>);

    const elements = snapshot.props.elements as Record<
      string,
      Record<string, unknown>
    >;

    expect(elements['el-1']['type']).toBe('shape');
    expect(elements['el-1'][ROLE_KEY]).toBe(ROLE_VALUE);
  });

  test('a full JSON round-trip preserves the unknown key', async () => {
    const transformer = new SurfaceBlockTransformer(new Map());
    const snapshot = transformer.toSnapshot({
      model: makeSurfaceModelStub().model,
    } as unknown as ToSnapshotPayload<never>);

    // the snapshot really crosses a JSON boundary in the clipboard/file paths
    const wire = JSON.parse(JSON.stringify(snapshot));

    const restored = await transformer.fromSnapshot({
      json: wire,
      assets: undefined,
      children: [],
    } as unknown as FromSnapshotPayload);

    attach(restored.props.elements.yMap);
    const restoredElement = restored.props.elements.getValue()!.get('el-1')!;

    expect(restoredElement.get('type')).toBe('shape');
    expect(restoredElement.get(ROLE_KEY)).toBe(ROLE_VALUE);
  });

  test('elementFromJSON writes back every key without an allow-list', () => {
    const transformer = new SurfaceBlockTransformer(new Map());
    const yMap = attach(
      transformer.elementFromJSON({
        type: 'shape',
        id: 'el-2',
        [ROLE_KEY]: ROLE_VALUE,
        someFutureKey: { nested: true },
      })
    );

    expect(yMap.get(ROLE_KEY)).toBe(ROLE_VALUE);
    expect(yMap.get('someFutureKey')).toEqual({ nested: true });
  });
});
