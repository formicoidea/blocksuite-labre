/**
 * Guard (#681, ADR 0053 amendment of 2026-11-24): an element that left the
 * surface never emits `elementUpdated` again, so no subscriber meets
 * `getElementById(id) === null` for an id it was just told about.
 *
 * What it would have caught: after #684 removed the `id: undefined` cause of
 * #681, the same `TypeError: Cannot read properties of null (reading
 * 'externalXYWH')` still came out of `GridManager` (`grid.ts`,
 * `this.update(surface.getElementById(payload.id)!)`), by another path:
 *
 * - `onElementsMapChange` (`surface-model.ts`, std) takes a deleted element out
 *   of `_elementModels` (`takeOut`: `getElementById` is `null` from there) but
 *   tears it down and announces it only in `announceRemoved`, AFTER the
 *   elements the same transaction added are mounted and announced
 *   (`elementAdded.next`). The deleted model was still MOUNTED in that window.
 * - A group-like model emits from its `xywh` GETTER when its bound was
 *   invalidated and has moved (`_recomputeXYWH`).
 * - `BackgroundStackingExtension` reads the `xywh` of every top-level element
 *   the layer manager holds (`stackedElementsOf`) on a LOCAL `elementAdded`,
 *   and the layer manager still holds the deleted group until its
 *   `elementRemoved`.
 *
 * Call path of the null update before the fix: `Store.transact < …
 * onElementsMapChange < BackgroundStackingExtension._restack <
 * stackedElementsOf < GroupElementModel.get xywh < _recomputeXYWH < onChange
 * < _emitElementUpdated < GridManager`. All four ingredients are needed, in ONE
 * local transaction: a non-bound change on a member (invalidates the group's
 * bound lazily), another member deleted (moves the bound), the group deleted,
 * an element added.
 *
 * The fix is at the source: `takeOut` silences the model as it leaves
 * `_elementModels`; its teardown and its `elementRemoved` keep their moment and
 * their payload, which the second case holds.
 */
import {
  BackgroundStackingExtension,
  type SurfaceBlockModel,
} from '@labre/affine-block-surface';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import { type GfxController, GridManager, LayerManager } from '@labre/std/gfx';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { config as rxjsConfig } from 'rxjs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';

let thrown: unknown[] = [];
const previousHandler = rxjsConfig.onUnhandledError;

beforeEach(() => {
  thrown = [];
  rxjsConfig.onUnhandledError = error => thrown.push(error);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  rxjsConfig.onUnhandledError = previousHandler;
  vi.restoreAllMocks();
});

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

/** Two shapes in a group, with the editor's indexes and stacking rule. */
async function setup(id: string) {
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = new StoreExtensionManager(
    getInternalStoreExtensions({})
  ).get('store');
  collection.meta.initialize();
  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('#681') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)!
    .model as unknown as SurfaceBlockModel;

  const a = surface.addElement({
    type: 'shape',
    shapeType: 'rect',
    xywh: '[0,0,100,100]',
  });
  const b = surface.addElement({
    type: 'shape',
    shapeType: 'rect',
    xywh: '[300,0,100,100]',
  });
  const group = surface.addElement({
    type: 'group',
    children: { [a]: true, [b]: true },
  });

  // The editor's two spatial indexes and the stacking rule, as mounted.
  const gfx = {
    std: { store },
    surface,
    updateElement: () => {},
  } as unknown as GfxController;
  const layer = new LayerManager(gfx);
  layer.mounted();
  (gfx as unknown as { layer: LayerManager }).layer = layer;
  new GridManager(gfx).mounted();
  new BackgroundStackingExtension(gfx);
  await settle();

  /** The transaction of #681: all four ingredients at once. */
  const deleteGroupWhileAdding = () => {
    let added = '';
    store.transact(() => {
      surface.updateElement(a, { fillColor: '#ff0000' });
      surface.elements.getValue()!.delete(b);
      surface.elements.getValue()!.delete(group);
      added = surface.addElement({
        type: 'shape',
        shapeType: 'rect',
        xywh: '[600,0,100,100]',
      });
    });
    return added;
  };

  return { surface, a, b, group, deleteGroupWhileAdding };
}

test('a group deleted in the transaction that adds an element never reaches the grid as null', async () => {
  const { surface, deleteGroupWhileAdding } = await setup('guard-681-grid');
  expect(thrown).toEqual([]);

  const unresolved: string[] = [];
  surface.elementUpdated.subscribe(({ id }) => {
    if (surface.getElementById(id) === null) unresolved.push(id);
  });

  deleteGroupWhileAdding();
  await settle();

  expect(unresolved).toEqual([]);
  expect((thrown as Error[]).map(error => error.message)).toEqual([]);
});

test('elementRemoved still comes after elementAdded, with the model as it was', async () => {
  const { surface, b, group, deleteGroupWhileAdding } =
    await setup('guard-681-removed');
  const bModel = surface.getElementById(b)!;
  const groupModel = surface.getElementById(group)!;

  const events: string[] = [];
  surface.elementAdded.subscribe(({ id }) => events.push(`added ${id}`));
  surface.elementUpdated.subscribe(({ id }) => events.push(`updated ${id}`));
  const removed: Record<string, unknown>[] = [];
  surface.elementRemoved.subscribe(({ id, type, model, local }) => {
    events.push(`removed ${id}`);
    // What a subscriber reads off the model: its identity and its last bound
    // (the group's recomputed from the member left), and reading it emits
    // nothing.
    removed.push({
      id,
      type,
      local,
      sameModel: model === (id === b ? bModel : groupModel),
      modelId: model.id,
      modelType: model.type,
      xywh: model.xywh,
      resolvable: surface.getElementById(id) !== null,
    });
  });

  const added = deleteGroupWhileAdding();
  await settle();

  // The order as before the fix: additions announced first, then the
  // removals in the order the keys changed.
  expect(events.filter(event => !event.startsWith('updated'))).toEqual([
    `added ${added}`,
    `removed ${b}`,
    `removed ${group}`,
  ]);
  // Neither removed element emits once it has left the surface.
  expect(events).not.toContain(`updated ${b}`);
  expect(events).not.toContain(`updated ${group}`);
  expect(removed).toEqual([
    {
      id: b,
      type: 'shape',
      local: true,
      sameModel: true,
      modelId: b,
      modelType: 'shape',
      xywh: '[300,0,100,100]',
      resolvable: false,
    },
    {
      id: group,
      type: 'group',
      local: true,
      sameModel: true,
      modelId: group,
      modelType: 'group',
      xywh: '[0,0,100,100]',
      resolvable: false,
    },
  ]);
  expect(thrown).toEqual([]);
});
