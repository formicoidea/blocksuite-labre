/**
 * `createDetachedElement`: the element an insertion would build, for a preview
 * to paint — and nothing the document could ever see.
 */
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { effects } from '../../effects.js';
import type { TestShapeElement } from '../test-gfx-element.js';
import {
  RootBlockSchemaExtension,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
} from '../test-schema.js';

effects();

const extensions = [RootBlockSchemaExtension, SurfaceBlockSchemaExtension];

function setupSurface() {
  const workspace = new TestWorkspace({
    id: 'detached-element',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  const doc = workspace.createDoc('home');
  const store = doc.getStore({ extensions });
  doc.load();

  const rootId = store.addBlock('test:page');
  const surfaceId = store.addBlock('test:surface', {}, rootId);

  return {
    spaceDoc: doc.spaceDoc,
    surface: store.getBlock(surfaceId)!.model as SurfaceBlockModel,
  };
}

describe('createDetachedElement', () => {
  test('builds a readable model the document never hears of', () => {
    const { spaceDoc, surface } = setupSurface();
    const added = vi.fn();
    surface.elementAdded.subscribe(added);
    const transactions = vi.fn();
    spaceDoc.on('afterTransaction', transactions);

    const model = surface.createDetachedElement({
      type: 'testShape',
      id: 'preview-0',
      xywh: '[-50,-25,100,50]',
      shapeType: 'triangle',
      // An unknown Y-typed prop: readable only once its map sits in a doc.
      label: new Y.Text('Component'),
    }) as TestShapeElement;

    expect(model.id).toBe('preview-0');
    expect(model.xywh).toBe('[-50,-25,100,50]');
    expect(model.deserializedXYWH).toEqual([-50, -25, 100, 50]);
    expect(model.shapeType).toBe('triangle');
    expect(String(model.yMap.get('label'))).toBe('Component');

    // Not registered: a registered element would be found here.
    expect(surface.getElementById('preview-0')).toBeNull();
    expect(surface.elementModels).toHaveLength(0);
    expect(surface.elements.getValue()!.has('preview-0')).toBe(false);
    expect(added).not.toHaveBeenCalled();
    expect(transactions).not.toHaveBeenCalled();
    expect(model.yMap.doc).not.toBe(spaceDoc);
  });

  test('runs the beforeAdd middlewares, as an insertion does', () => {
    const { surface } = setupSurface();
    surface.applyMiddlewares([
      ctx => {
        ctx.payload.props = { rotate: 45, ...ctx.payload.props };
      },
    ]);

    const model = surface.createDetachedElement({
      type: 'testShape',
      id: 'preview-1',
    }) as TestShapeElement;

    expect(model.rotate).toBe(45);
    expect(surface.elementModels).toHaveLength(0);
  });
});
