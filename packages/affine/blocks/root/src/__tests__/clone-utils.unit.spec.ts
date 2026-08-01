/**
 * "Turn into linked doc" on a partial selection: one endpoint of a connector is
 * cloned, the other stays behind in the source document.
 *
 * The endpoint left behind CANNOT keep its element id: the target document is a
 * brand new doc where that element does not exist, so the id is a dangling
 * cross-document reference. `serializeConnector` — the clipboard's answer to the
 * very same question — converts such an endpoint to an ABSOLUTE position and
 * drops the id, which is what these tests assert.
 *
 * They assert the OBSERVABLE effect, not the value of an id: the connector in
 * the linked doc must have no dangling reference, must sit where it sat in the
 * source document, and must end up with a non-empty `path` — because `path` is
 * `@local()` (never serialized), so a connector whose path is never recomputed
 * is drawn nowhere and hit-tests nowhere: invisible AND unselectable.
 */
import {
  getSurfaceBlock,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
} from '@labre/affine-block-surface';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import { ConnectorPathGenerator } from '@labre/affine-gfx-connector';
import { ConnectorStoreExtension } from '@labre/affine-gfx-connector/store';
import type {
  ConnectorElementModel,
  ShapeElementModel,
} from '@labre/affine-model';
import { ConnectorMode, RootBlockSchemaExtension } from '@labre/affine-model';
import type { EditorHost } from '@labre/std';
import type { GfxModel } from '@labre/std/gfx';
import type { Store } from '@labre/store';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { beforeEach, describe, expect, it } from 'vitest';

import { createLinkedDocFromEdgelessElements } from '../edgeless/configs/toolbar/render-linked-doc.js';

/** The shape that gets cloned, at the left. */
const INSIDE_XYWH = '[0,0,100,100]';
/** The shape that stays behind, 200px to the right. */
const OUTSIDE_XYWH = '[300,0,100,100]';

let workspaceSeq = 0;

/**
 * Extensions live on the WORKSPACE, not on a single store: the linked doc is
 * created inside `createLinkedDocFromEdgelessElements` and there is no seam to
 * hand it extensions, so it inherits them from here — connector watcher
 * included, which is precisely the piece under observation.
 */
function createWorkspace() {
  const manager = new StoreExtensionManager([ConnectorStoreExtension]);
  const collection = new TestWorkspace({
    id: `clone-utils-${workspaceSeq++}`,
  });
  collection.storeExtensions = [
    RootBlockSchemaExtension,
    SurfaceBlockSchemaExtension,
    ...manager.get('store'),
  ];
  collection.meta.initialize();
  return collection;
}

function surfaceOf(store: Store) {
  return getSurfaceBlock(store) as SurfaceBlockModel;
}

/**
 * A source document holding two shapes joined by a connector attached to both
 * shapes' BODIES (`{id}` with no position) — the state the connector tool
 * produces when an endpoint is dropped on a shape.
 */
function authorSourceDoc(collection: TestWorkspace, mode: ConnectorMode) {
  const store = collection.createDoc().getStore();
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('src') });
    store.addBlock('affine:surface', {}, rootId);
  });
  const surface = surfaceOf(store);

  const insideId = surface.addElement({
    type: 'shape',
    shapeType: 'rect',
    xywh: INSIDE_XYWH,
  });
  const outsideId = surface.addElement({
    type: 'shape',
    shapeType: 'rect',
    xywh: OUTSIDE_XYWH,
  });
  const connectorId = surface.addElement({
    type: 'connector',
    mode,
    source: { id: insideId },
    target: { id: outsideId },
  });

  return {
    store,
    surface,
    inside: surface.getElementById(insideId) as ShapeElementModel,
    outside: surface.getElementById(outsideId) as ShapeElementModel,
    connector: surface.getElementById(connectorId) as ConnectorElementModel,
  };
}

/** The `EditorHost` surface `createLinkedDocFromEdgelessElements` actually uses. */
function hostFor(store: Store) {
  return {
    store,
    std: {
      getOptional: () => null,
      get: () => ({ setPrimaryMode: () => {} }),
    },
  } as unknown as EditorHost;
}

/** The watcher recomputes paths in a microtask; let it run. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function connectorIn(store: Store) {
  return surfaceOf(store).getElementsByType(
    'connector'
  )[0] as unknown as ConnectorElementModel;
}

describe('turning a partial selection into a linked doc', () => {
  let collection: TestWorkspace;

  beforeEach(() => {
    collection = createWorkspace();
  });

  it('gives the endpoint left behind an absolute position, not a dangling id', async () => {
    const source = authorSourceDoc(collection, ConnectorMode.Orthogonal);
    await flush();
    // What the connector looked like before the clone.
    const originalEnd =
      source.connector.absolutePath[source.connector.absolutePath.length - 1];
    expect(originalEnd).toBeDefined();

    // Only the left shape and the connector are selected.
    const linkedDoc = createLinkedDocFromEdgelessElements(
      hostFor(source.store),
      [source.inside, source.connector] as GfxModel[],
      'linked'
    );
    await flush();

    const cloned = connectorIn(linkedDoc);

    // The endpoint that was cloned still points at an element — the NEW one.
    const clonedShape = surfaceOf(linkedDoc).getElementsByType('shape')[0];
    expect(cloned.source.id).toBe(clonedShape.id);

    // The endpoint left behind carries NO id at all: no cross-document
    // reference to an element this document has never heard of.
    expect(cloned.target.id).toBeUndefined();
    expect(surfaceOf(linkedDoc).getElementById(source.outside.id)).toBeNull();

    // ...and it sits exactly where it sat in the source document.
    expect(cloned.target.position).toBeDefined();
    expect(cloned.target.position![0]).toBeCloseTo(originalEnd[0], 5);
    expect(cloned.target.position![1]).toBeCloseTo(originalEnd[1], 5);
  });

  it('leaves the connector with a path, so it is drawn and can be picked', async () => {
    const source = authorSourceDoc(collection, ConnectorMode.Orthogonal);
    await flush();

    const linkedDoc = createLinkedDocFromEdgelessElements(
      hostFor(source.store),
      [source.inside, source.connector] as GfxModel[],
      'linked'
    );
    await flush();

    const cloned = connectorIn(linkedDoc);
    // `path` and `absolutePath` are @local(): nothing is persisted, everything
    // depends on the watcher having accepted to recompute them. An endpoint
    // holding a dangling id fails the watcher's guard and leaves both empty.
    expect(cloned.path.length).toBeGreaterThan(1);
    expect(cloned.absolutePath.length).toBeGreaterThan(1);

    // And the recomputed geometry still spans the original gap.
    const [start] = cloned.absolutePath;
    const end = cloned.absolutePath[cloned.absolutePath.length - 1];
    expect(Math.abs(end[0] - start[0])).toBeGreaterThan(100);
  });

  it('does not crash on a Straight connector with one endpoint left behind', async () => {
    // Both endpoints attached to the shape BODIES: with a dangling id kept,
    // `_generateStraightConnectorPath` takes the `source.id && target.id`
    // branch and dereferences `.xywh` on a null element.
    const source = authorSourceDoc(collection, ConnectorMode.Straight);
    await flush();

    const linkedDoc = createLinkedDocFromEdgelessElements(
      hostFor(source.store),
      [source.inside, source.connector] as GfxModel[],
      'linked'
    );
    await flush();

    const cloned = connectorIn(linkedDoc);
    expect(cloned.target.id).toBeUndefined();
    expect(cloned.path.length).toBeGreaterThan(1);

    // Asked to regenerate directly — the watcher's guard bypassed, as any
    // future caller might — the generator must still not blow up.
    // `_generateStraightConnectorPath` takes its `source.id && target.id`
    // branch on a dangling id and dereferences `.xywh` on a null element.
    const elementGetter = (id: string) =>
      surfaceOf(linkedDoc).getElementById(id) ??
      (linkedDoc.getModelById(id) as GfxModel);
    expect(() =>
      ConnectorPathGenerator.updatePath(cloned, null, elementGetter)
    ).not.toThrow();
  });
});
