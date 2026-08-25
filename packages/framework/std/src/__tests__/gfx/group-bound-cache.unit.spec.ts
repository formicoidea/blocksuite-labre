import { serializeXYWH } from '@labre/global/gfx';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';

import { effects } from '../../effects.js';
import type { GfxGroupLikeElementModel } from '../../gfx/index.js';
import {
  RootBlockSchemaExtension,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
} from '../test-schema.js';

effects();

const extensions = [RootBlockSchemaExtension, SurfaceBlockSchemaExtension];

const commonSetup = () => {
  const collection = new TestWorkspace({
    id: 'test-collection',
    idGenerator: createAutoIncrementIdGenerator(),
  });

  collection.meta.initialize();
  const doc = collection.createDoc('home');
  const store = doc.getStore({ extensions });
  doc.load();

  const rootId = store.addBlock('test:page');
  const surfaceId = store.addBlock('test:surface', {}, rootId);

  return store.getBlock(surfaceId)!.model as SurfaceBlockModel;
};

const createGroupWithChild = (model: SurfaceBlockModel) => {
  const childId = model.addElement({
    type: 'testShape',
    xywh: serializeXYWH(0, 0, 100, 100),
  });
  const groupId = model.addElement({
    type: 'testGroup',
    children: { [childId]: true },
  });

  return {
    childId,
    group: model.getElementById(groupId) as GfxGroupLikeElementModel,
  };
};

describe('group bound cache', () => {
  test('the bound follows a child that moves', () => {
    const model = commonSetup();
    const { childId, group } = createGroupWithChild(model);

    expect(group.xywh).toBe(serializeXYWH(0, 0, 100, 100));

    model.updateElement(childId, { xywh: serializeXYWH(50, 60, 100, 100) });

    expect(group.xywh).toBe(serializeXYWH(50, 60, 100, 100));
  });

  test('the bound is computed once per mutation, not once per read', () => {
    const model = commonSetup();
    const { childId, group } = createGroupWithChild(model);

    // Warm the cache, then spy: only the reads after the spy are counted.
    expect(group.xywh).toBe(serializeXYWH(0, 0, 100, 100));

    const getXYWH = vi.spyOn(
      group as unknown as { _getXYWH: () => unknown },
      '_getXYWH'
    );

    for (let i = 0; i < 100; i++) {
      expect(group.xywh).toBe(serializeXYWH(0, 0, 100, 100));
    }

    expect(getXYWH).not.toHaveBeenCalled();

    model.updateElement(childId, { xywh: serializeXYWH(50, 60, 100, 100) });

    for (let i = 0; i < 100; i++) {
      expect(group.xywh).toBe(serializeXYWH(50, 60, 100, 100));
    }

    // One recomputation for the mutation, and none for the 100 reads.
    expect(getXYWH).toHaveBeenCalledTimes(1);
  });

  test('the bound notifies the surface when a child moves', () => {
    const model = commonSetup();
    const { childId, group } = createGroupWithChild(model);

    expect(group.xywh).toBe(serializeXYWH(0, 0, 100, 100));

    const moved: string[] = [];
    model.elementUpdated.subscribe(({ id, props }) => {
      if (id === group.id && 'xywh' in props) {
        moved.push(props.xywh as string);
      }
    });

    model.updateElement(childId, { xywh: serializeXYWH(50, 60, 100, 100) });

    expect(moved).toEqual([serializeXYWH(50, 60, 100, 100)]);
  });

  test('the bound follows a child prop the cache does not know about', () => {
    const model = commonSetup();
    const childId = model.addElement({
      type: 'testPadded',
      xywh: serializeXYWH(0, 0, 100, 100),
    });
    const groupId = model.addElement({
      type: 'testGroup',
      children: { [childId]: true },
    });
    const group = model.getElementById(groupId) as GfxGroupLikeElementModel;

    expect(group.xywh).toBe(serializeXYWH(0, 0, 100, 100));

    // `padding` is not one of the props known to move a bound, so the cache is
    // only invalidated: the next read must still see the inflated bound.
    model.updateElement(childId, { padding: 10 });

    expect(group.xywh).toBe(serializeXYWH(-10, -10, 120, 120));
  });

  test('the bound follows the children added and removed', () => {
    const model = commonSetup();
    const { group } = createGroupWithChild(model);

    const otherId = model.addElement({
      type: 'testShape',
      xywh: serializeXYWH(200, 0, 100, 100),
    });

    group.addChild(model.getElementById(otherId) as never);
    expect(group.xywh).toBe(serializeXYWH(0, 0, 300, 100));

    // oxlint-disable-next-line unicorn/prefer-dom-node-remove
    group.removeChild(model.getElementById(otherId) as never);
    expect(group.xywh).toBe(serializeXYWH(0, 0, 100, 100));
  });
});
