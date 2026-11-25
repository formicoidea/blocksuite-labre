/**
 * A surface lets go of Yjs when its store is released (#746, ADR 0057).
 *
 * The surface model observes its `elements` map and each element model
 * observes its own `Y.Map`; it detached them only when the surface block was
 * DELETED (`model.deleted`). A store release disposes of every model without
 * deleting any, so an edgeless document closed with `store.dispose()` kept
 * its surface, and through it the store, reachable from the document for as
 * long as the workspace: the store-retention spec measured 20 of 20 stores
 * alive. The surface now runs the same teardown from `dispose()`.
 *
 * Held here: after the release, the elements map and the element's map are
 * back to the handlers they had before the store was opened, and the release
 * wrote nothing to Yjs.
 */
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import {
  RootBlockSchemaExtension,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
  TestGfxBlockSchemaExtension,
} from '../test-schema.js';

const extensions = [
  RootBlockSchemaExtension,
  SurfaceBlockSchemaExtension,
  TestGfxBlockSchemaExtension,
];

const DOC_ID = 'home';
const SURFACE_ID = 'surface';

let workspaces = 0;

function openWorkspace() {
  workspaces += 1;
  const workspace = new TestWorkspace({
    id: `surface-release-${workspaces}`,
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.storeExtensions = extensions;
  workspace.meta.initialize();
  return workspace;
}

/** A document with a surface and one shape, written by a peer. */
function docWithASurface(workspace: TestWorkspace) {
  const peer = openWorkspace();
  const peerStore = peer.createDoc(DOC_ID).getStore();
  peerStore.load(() => {
    const rootId = peerStore.addBlock('test:page');
    peerStore.addBlock('test:surface', { id: SURFACE_ID }, rootId);
  });
  const surface = peerStore.getModelById(SURFACE_ID) as SurfaceBlockModel;
  const elementId = surface.addElement({
    type: 'testShape',
    xywh: '[0,0,10,10]',
  });
  const update = Y.encodeStateAsUpdate(peerStore.spaceDoc);
  peer.dispose();

  const doc = workspace.createDoc(DOC_ID);
  Y.applyUpdate(doc.spaceDoc, update, 'remote');
  return { doc, elementId };
}

type YInternals = { _eH: { l: unknown[] }; _dEH: { l: unknown[] } };
const handlersOn = (type: unknown) => {
  const { _eH, _dEH } = type as YInternals;
  return _eH.l.length + _dEH.l.length;
};

describe('a released store detaches its surface (ADR 0057)', () => {
  test('the elements map and the element map are back to before the store was opened', () => {
    const workspace = openWorkspace();
    try {
      const { doc, elementId } = docWithASurface(workspace);
      const ySurface = doc.spaceDoc
        .getMap<Y.Map<unknown>>('blocks')
        .get(SURFACE_ID)!;
      const yElementsBox = ySurface.get('prop:elements') as Y.Map<unknown>;
      const yElements = yElementsBox.get('value') as Y.Map<Y.Map<unknown>>;
      const yElement = yElements.get(elementId)!;
      const before = {
        surface: handlersOn(ySurface),
        box: handlersOn(yElementsBox),
        elements: handlersOn(yElements),
        element: handlersOn(yElement),
      };

      const store = doc.getStore();
      store.load();
      const surface = store.getModelById(SURFACE_ID) as SurfaceBlockModel;
      expect(surface.getElementById(elementId)).not.toBeNull();
      expect(handlersOn(yElements)).toBeGreaterThan(before.elements);
      expect(handlersOn(yElement)).toBeGreaterThan(before.element);

      const onUpdate = vi.fn();
      doc.spaceDoc.on('update', onUpdate);
      store.dispose();
      doc.spaceDoc.off('update', onUpdate);

      expect(onUpdate).not.toHaveBeenCalled();
      expect({
        surface: handlersOn(ySurface),
        box: handlersOn(yElementsBox),
        elements: handlersOn(yElements),
        element: handlersOn(yElement),
      }).toEqual(before);
      // Store reads still answer.
      expect(store.getModelById(SURFACE_ID)).toBe(surface);
    } finally {
      workspace.dispose();
    }
  });
});
