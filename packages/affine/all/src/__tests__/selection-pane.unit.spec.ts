/**
 * The selection pane's headless half (ADR 0031, stage 2), on a real document.
 *
 * The pane is a list of the canvas by z-order; a host draws its own from the
 * same tree and acts through the same commands. So what is pinned here is
 * what both panes rely on, not what the library's panel looks like (the
 * integration suite drives that one with a real pointer):
 *
 * - the rows ARE the paint order, top first, with groups and mindmaps nested
 *   and frames listed as ordinary rows where they paint (never a container),
 *   and the filter offers frames and nothing else;
 * - every write refuses on a read-only document, writes nothing when nothing
 *   would change, and is one undo step;
 * - a row's padlock locks that row alone — never the toolbar's
 *   "group-then-lock" of a multi-selection;
 * - the tree is cheap: an 800-element canvas builds inside one frame, and
 *   geometry churn (a drag) does not rebuild it at all.
 *
 * `gfx` is a stub over the REAL surface and store, as in
 * `remote-cascade-frame.unit.spec.ts`: the actions only reach the controller
 * through `getElementById`, `gfxElements` and `updateElement`, and the stub's
 * `updateElement` is the controller's own two-branch body.
 */
import {
  buildSelectionPaneTree,
  filterSelectionPaneTree,
  paneContainerOf,
  renamePaneFrame,
  renamePaneGroup,
  reorderElementParams,
  reorderPaneElement,
  reorderPaneElements,
  type SelectionPaneNode,
  SelectionPaneModel,
  selectionPaneFilterMembers,
  selectionPaneFilterTargets,
  setPaneElementsLocked,
  type SurfaceBlockModel,
} from '@labre/affine-block-surface';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import type { GroupElementModel } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import {
  compareLayer,
  GfxBlockElementModel,
  GfxControllerIdentifier,
  type GfxModel,
} from '@labre/std/gfx';
import type { Store } from '@labre/store';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { Subject } from 'rxjs';
import { describe, expect, test } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';

/** One 60 fps frame — the budget the Wardley bench holds the engine to. */
const FRAME_BUDGET_MS = 16;

/** Samples per measurement; the best one is asserted (load-tolerant). */
const SAMPLES = 10;

let boardSeq = 0;

function createBoard() {
  const id = `selection-pane-${boardSeq++}`;
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();

  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  let rootId = '';
  store.load(() => {
    rootId = store.addBlock('affine:page', { title: new Text('pane') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;
  store.resetHistory();
  return { store, surface, rootId, surfaceId };
}

function gfxFor(store: Store, surface: SurfaceBlockModel) {
  let reads = 0;
  const gfx = {
    doc: store,
    surface,
    surface$: { value: surface },
    layer: { slots: { layerUpdated: new Subject<unknown>() } },
    selection: { selectedIds: [] as string[] },
    /** How many times a tree was built from the canvas. */
    get reads() {
      return reads;
    },
    get gfxElements(): GfxModel[] {
      reads++;
      const blocks = [...store.getAllModels()].filter(
        (model): model is GfxBlockElementModel =>
          model instanceof GfxBlockElementModel
      );
      return [...blocks, ...surface.elementModels];
    },
    getElementById(id: string) {
      return surface.getElementById(id) ?? store.getModelById(id) ?? null;
    },
    // `GfxController.updateElement`, verbatim in behaviour.
    updateElement(element: GfxModel | string, props: Record<string, unknown>) {
      const id = typeof element === 'string' ? element : element.id;
      if (surface.hasElementById(id)) {
        surface.updateElement(id, props);
      } else {
        const block = store.getBlock(id);
        if (block) store.updateBlock(block.model, props);
      }
    },
  };
  return gfx;
}

function stdFor(store: Store, gfx: ReturnType<typeof gfxFor>) {
  return {
    store,
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : undefined,
    getOptional: () => null,
  } as unknown as BlockStdScope;
}

function shape(surface: SurfaceBlockModel, index: string, x = 0) {
  return surface.addElement({
    type: 'shape',
    xywh: `[${x},0,10,10]`,
    index,
  });
}

const ids = (nodes: readonly SelectionPaneNode[]) => nodes.map(n => n.id);

/**
 * The rows of the one layer a canvas without a layer record shows, the
 * default one (ADR 0031 amendments; the shape is pinned in
 * `canvas-default-layer.unit.spec.ts`).
 */
const rowsOf = (tree: readonly SelectionPaneNode[]) => tree[0].children!;

const treeOf = (gfx: ReturnType<typeof gfxFor>) =>
  rowsOf(buildSelectionPaneTree(gfx.gfxElements));

describe('the tree is the paint order', () => {
  test('rows are top first, groups nest their members', () => {
    const { store, surface } = createBoard();
    const bottom = shape(surface, 'a0');
    const a = shape(surface, 'a1');
    const b = shape(surface, 'a2');
    const top = shape(surface, 'a5');
    const group = surface.addElement({
      type: 'group',
      children: { [a]: true, [b]: true },
      index: 'a3',
    });

    const tree = treeOf(gfxFor(store, surface));

    expect(ids(tree)).toEqual([top, group, bottom]);
    const groupRow = tree[1];
    expect(groupRow.type).toBe('group');
    expect(ids(groupRow.children!)).toEqual([b, a]);
    expect(groupRow.children!.every(row => row.groupId === group)).toBe(true);
    expect(tree.every(row => row.layerId === '@default')).toBe(true);
  });

  test('a frame is a row at its real z position, never a container', () => {
    // ADR 0031, amendments: frames are ordinary rows, listed where they
    // paint. A frame interleaves with everything else through `compare`, and
    // its members paint right above it — so they are listed right above it,
    // as siblings, not nested (a frame holds elements from any layer).
    const { store, surface, surfaceId } = createBoard();
    const below = shape(surface, 'a0', 200);
    const inside = shape(surface, 'a2', 20);
    const above = shape(surface, 'a3', 400);
    const frame = store.addBlock(
      'affine:frame',
      {
        xywh: '[0,0,100,100]',
        index: 'a1',
        title: new Text('Slide'),
        childElementIds: { [inside]: true },
      },
      surfaceId
    );

    const tree = treeOf(gfxFor(store, surface));

    expect(ids(tree)).toEqual([above, inside, frame, below]);
    const row = tree.find(node => node.id === frame)!;
    expect(row.kind).toBe('block');
    expect(row.type).toBe('affine:frame');
    expect(row.children).toBeUndefined();
  });

  test('a framework board stays an ordinary row', () => {
    const { store, surface } = createBoard();
    const board = surface.addElement({
      type: 'c4Board',
      xywh: '[0,0,400,300]',
      index: 'a0',
    });
    const top = shape(surface, 'a1', 20);

    expect(ids(treeOf(gfxFor(store, surface)))).toEqual([top, board]);
  });

  test('a row reports its own lock', () => {
    const { store, surface } = createBoard();
    const id = shape(surface, 'a0');
    surface.updateElement(id, { lockedBySelf: true });

    expect(treeOf(gfxFor(store, surface))[0].locked).toBe(true);
  });
});

describe('filter', () => {
  test('offers the frames only, never a framework board', () => {
    const { store, surface, surfaceId } = createBoard();
    surface.addElement({ type: 'c4Board', xywh: '[0,0,400,300]' });
    const frame = store.addBlock(
      'affine:frame',
      { xywh: '[0,0,100,100]', title: new Text('Slide') },
      surfaceId
    );
    const std = stdFor(store, gfxFor(store, surface));

    expect(selectionPaneFilterTargets(std)).toEqual([
      { id: frame, kind: 'frame' },
    ]);
  });

  test('narrows the rows to the frame and its members', () => {
    const { store, surface, surfaceId } = createBoard();
    const inside = shape(surface, 'a1', 20);
    const outside = shape(surface, 'a2', 500);
    const frame = store.addBlock(
      'affine:frame',
      {
        xywh: '[0,0,100,100]',
        index: 'a0',
        title: new Text('Slide'),
        childElementIds: { [inside]: true },
      },
      surfaceId
    );
    const gfx = gfxFor(store, surface);
    const members = selectionPaneFilterMembers(stdFor(store, gfx), frame)!;

    const rows = filterSelectionPaneTree(treeOf(gfx), members);

    // The least surprising narrowing: the frame's own row stays, so the list
    // still shows what it is filtered by, at its place.
    expect(ids(rows)).toEqual([inside, frame]);
    expect(ids(rows)).not.toContain(outside);
  });
});

describe('filter, with user layers', () => {
  const node = (
    id: string,
    kind: SelectionPaneNode['kind'],
    children?: SelectionPaneNode[]
  ): SelectionPaneNode => ({
    id,
    kind,
    type: kind === 'layer' ? 'layer' : 'shape',
    layerId: '@default',
    locked: false,
    hiddenLocal: false,
    hiddenForEveryone: false,
    ...(children ? { children } : {}),
  });

  test('keeps every layer row, even one the filter empties', () => {
    // The product owner's review: under a frame filter, a second "New layer"
    // created an empty layer the filter then hid, and nothing happened on
    // screen. A layer is not filtered; only the element rows inside it are.
    const tree = [
      node('fresh', 'layer', []),
      node('outside-only', 'layer', [node('outside', 'element')]),
      node('@default', 'layer', [node('inside', 'element')]),
    ];

    const rows = filterSelectionPaneTree(tree, new Set(['inside']));

    expect(ids(rows)).toEqual(['fresh', 'outside-only', '@default']);
    expect(rows[0].children).toEqual([]);
    expect(rows[1].children).toEqual([]);
    expect(ids(rows[2].children!)).toEqual(['inside']);
  });
});

describe('reorder', () => {
  test('puts a row directly above its target, in one undo step', () => {
    const { store, surface } = createBoard();
    const s0 = shape(surface, 'a0');
    const s1 = shape(surface, 'a1');
    const s2 = shape(surface, 'a2');
    const gfx = gfxFor(store, surface);
    const std = stdFor(store, gfx);

    expect(reorderPaneElement(std, s0, s1)).toBe(true);
    expect(ids(treeOf(gfx))).toEqual([s2, s0, s1]);

    store.undo();
    expect(ids(treeOf(gfx))).toEqual([s2, s1, s0]);
  });

  test('`null` sends a row to the bottom of its stack', () => {
    const { store, surface } = createBoard();
    const s0 = shape(surface, 'a0');
    const s1 = shape(surface, 'a1');
    const gfx = gfxFor(store, surface);

    expect(reorderPaneElement(stdFor(store, gfx), s1, null)).toBe(true);
    expect(ids(treeOf(gfx))).toEqual([s0, s1]);
  });

  test('writes nothing when the row is already there', () => {
    const { store, surface } = createBoard();
    const s0 = shape(surface, 'a0');
    const s1 = shape(surface, 'a1');
    store.resetHistory();
    const gfx = gfxFor(store, surface);

    expect(reorderPaneElement(stdFor(store, gfx), s1, s0)).toBe(false);
    expect(reorderPaneElement(stdFor(store, gfx), s0, null)).toBe(false);
    expect(store.canUndo).toBe(false);
  });

  test('refuses on a read-only document', () => {
    const { store, surface } = createBoard();
    const s0 = shape(surface, 'a0');
    const s1 = shape(surface, 'a1');
    const gfx = gfxFor(store, surface);
    store.readonly = true;

    expect(reorderPaneElement(stdFor(store, gfx), s0, s1)).toBe(false);
    expect(surface.getElementById(s0)!.index).toBe('a0');
  });

  test('refuses a target outside the row’s stack', () => {
    const { store, surface } = createBoard();
    const a = shape(surface, 'a1');
    const b = shape(surface, 'a2');
    const loose = shape(surface, 'a4');
    surface.addElement({
      type: 'group',
      children: { [a]: true, [b]: true },
      index: 'a3',
    });
    const gfx = gfxFor(store, surface);

    expect(reorderPaneElement(stdFor(store, gfx), a, loose)).toBe(false);
  });
});

/*
 * The pane drags the whole selection (ADR 0034): `canvas.element.reorder`
 * takes `ids`, and the rows move as one block of their own stack.
 */
describe('reorder several rows', () => {
  test('they move as one block, in their own z-order, in one undo step', () => {
    const { store, surface } = createBoard();
    const s0 = shape(surface, 'a0');
    const s1 = shape(surface, 'a1');
    const s2 = shape(surface, 'a2');
    const s3 = shape(surface, 'a3');
    store.resetHistory();
    const gfx = gfxFor(store, surface);

    // Listed out of order on purpose: the stack's order is kept, not the list's.
    expect(reorderPaneElements(stdFor(store, gfx), [s2, s0], s3)).toBe(true);
    expect(ids(treeOf(gfx))).toEqual([s2, s0, s3, s1]);

    store.undo();
    expect(ids(treeOf(gfx))).toEqual([s3, s2, s1, s0]);
    expect(store.canUndo).toBe(false);
  });

  test('`null` sends them to the bottom of their stack', () => {
    const { store, surface } = createBoard();
    const s0 = shape(surface, 'a0');
    const s1 = shape(surface, 'a1');
    const s2 = shape(surface, 'a2');
    const gfx = gfxFor(store, surface);

    expect(reorderPaneElements(stdFor(store, gfx), [s2, s1], null)).toBe(true);
    expect(ids(treeOf(gfx))).toEqual([s0, s2, s1]);
  });

  test('writes nothing when the block is already there', () => {
    const { store, surface } = createBoard();
    const s0 = shape(surface, 'a0');
    const s1 = shape(surface, 'a1');
    const s2 = shape(surface, 'a2');
    store.resetHistory();
    const gfx = gfxFor(store, surface);

    expect(reorderPaneElements(stdFor(store, gfx), [s0, s1], null)).toBe(false);
    expect(reorderPaneElements(stdFor(store, gfx), [s2, s1], s0)).toBe(false);
    expect(store.canUndo).toBe(false);
  });

  test('refuses a selection spanning two stacks', () => {
    const { store, surface } = createBoard();
    const a = shape(surface, 'a1');
    const b = shape(surface, 'a2');
    const loose = shape(surface, 'a4');
    const bottom = shape(surface, 'a0');
    surface.addElement({
      type: 'group',
      children: { [a]: true, [b]: true },
      index: 'a3',
    });
    store.resetHistory();
    const gfx = gfxFor(store, surface);

    expect(reorderPaneElements(stdFor(store, gfx), [a, loose], null)).toBe(
      false
    );
    expect(reorderPaneElements(stdFor(store, gfx), [loose, a], bottom)).toBe(
      false
    );
    expect(store.canUndo).toBe(false);
  });

  test('refuses a target among the moved rows, and an unknown id', () => {
    const { store, surface } = createBoard();
    const s0 = shape(surface, 'a0');
    const s1 = shape(surface, 'a1');
    shape(surface, 'a2');
    const gfx = gfxFor(store, surface);

    expect(reorderPaneElements(stdFor(store, gfx), [s0, s1], s1)).toBe(false);
    expect(reorderPaneElements(stdFor(store, gfx), [s0, 'nope'], null)).toBe(
      false
    );
    expect(reorderPaneElements(stdFor(store, gfx), [], null)).toBe(false);
  });

  test('refuses on a read-only document', () => {
    const { store, surface } = createBoard();
    const s0 = shape(surface, 'a0');
    const s1 = shape(surface, 'a1');
    const s2 = shape(surface, 'a2');
    const gfx = gfxFor(store, surface);
    store.readonly = true;

    expect(reorderPaneElements(stdFor(store, gfx), [s0, s1], s2)).toBe(false);
    expect(surface.getElementById(s0)!.index).toBe('a0');
  });

  test('the command takes `ids`, and still takes `id` alone', () => {
    expect(
      reorderElementParams.safeParse({ ids: ['a', 'b'], above: null }).success
    ).toBe(true);
    expect(
      reorderElementParams.safeParse({ id: 'a', above: 'b' }).success
    ).toBe(true);
  });
});

describe('lock', () => {
  test('locks each row on its own — no group is created', () => {
    const { store, surface } = createBoard();
    const s0 = shape(surface, 'a0');
    const s1 = shape(surface, 'a1');
    const gfx = gfxFor(store, surface);

    expect(setPaneElementsLocked(stdFor(store, gfx), [s0, s1], true)).toBe(
      true
    );

    expect(surface.getElementsByType('group')).toHaveLength(0);
    expect(surface.getElementById(s0)!.lockedBySelf).toBe(true);
    expect(surface.getElementById(s1)!.lockedBySelf).toBe(true);
    store.undo();
    expect(surface.getElementById(s0)!.lockedBySelf).toBeFalsy();
    expect(surface.getElementById(s1)!.lockedBySelf).toBeFalsy();
  });

  test('writes nothing when every row already has that state', () => {
    const { store, surface } = createBoard();
    const s0 = shape(surface, 'a0');
    store.resetHistory();
    const gfx = gfxFor(store, surface);

    expect(setPaneElementsLocked(stdFor(store, gfx), [s0], false)).toBe(false);
    expect(store.canUndo).toBe(false);
  });

  test('refuses on a read-only document', () => {
    const { store, surface } = createBoard();
    const s0 = shape(surface, 'a0');
    const gfx = gfxFor(store, surface);
    store.readonly = true;

    expect(setPaneElementsLocked(stdFor(store, gfx), [s0], true)).toBe(false);
    expect(surface.getElementById(s0)!.lockedBySelf).toBeFalsy();
  });

  test('locks a gfx block through its props', () => {
    const { store, surface, surfaceId } = createBoard();
    const frame = store.addBlock(
      'affine:frame',
      { xywh: '[0,0,100,100]', title: new Text('Slide') },
      surfaceId
    );
    const gfx = gfxFor(store, surface);

    expect(setPaneElementsLocked(stdFor(store, gfx), [frame], true)).toBe(true);
    expect(
      (store.getBlock(frame)!.model as GfxBlockElementModel).lockedBySelf
    ).toBe(true);
  });
});

describe('rename a group', () => {
  test('writes the stored title, once', () => {
    const { store, surface } = createBoard();
    const a = shape(surface, 'a0');
    const groupId = surface.addElement({
      type: 'group',
      children: { [a]: true },
      title: 'Group 1',
    });
    store.resetHistory();
    const gfx = gfxFor(store, surface);
    const std = stdFor(store, gfx);
    const group = () => surface.getElementById(groupId) as GroupElementModel;

    expect(renamePaneGroup(std, groupId, '  Payments  ')).toBe(true);
    expect(group().title.toString()).toBe('Payments');
    expect(renamePaneGroup(std, groupId, 'Payments')).toBe(false);
    expect(renamePaneGroup(std, groupId, '   ')).toBe(false);

    store.undo();
    expect(group().title.toString()).toBe('Group 1');
  });

  test('refuses on a read-only document, and on anything but a group', () => {
    const { store, surface } = createBoard();
    const a = shape(surface, 'a0');
    const groupId = surface.addElement({
      type: 'group',
      children: { [a]: true },
      title: 'Group 1',
    });
    const gfx = gfxFor(store, surface);
    const std = stdFor(store, gfx);

    expect(renamePaneGroup(std, a, 'Shape')).toBe(false);
    store.readonly = true;
    expect(renamePaneGroup(std, groupId, 'Payments')).toBe(false);
  });
});

describe('rename a frame', () => {
  test('writes the stored title, once, and refuses on a read-only document', () => {
    const { store, surface, surfaceId } = createBoard();
    const frameId = store.addBlock(
      'affine:frame',
      { xywh: '[0,0,100,100]', title: new Text('Frame 1') },
      surfaceId
    );
    store.resetHistory();
    const std = stdFor(store, gfxFor(store, surface));
    const title = () =>
      (store.getModelById(frameId)!.props as { title: Text }).title.toString();

    expect(renamePaneFrame(std, frameId, '  Context  ')).toBe(true);
    expect(title()).toBe('Context');
    expect(renamePaneFrame(std, frameId, 'Context')).toBe(false);
    expect(renamePaneFrame(std, frameId, '   ')).toBe(false);
    expect(renamePaneFrame(std, shape(surface, 'a0'), 'Shape')).toBe(false);

    store.undo();
    expect(title()).toBe('Frame 1');
    store.readonly = true;
    expect(renamePaneFrame(std, frameId, 'Context')).toBe(false);
  });
});

describe('the tree is cheap', () => {
  /**
   * 500 loose shapes, 100 groups of two, 20 frames holding five of the loose
   * shapes each: 820 models. The frames are rows too (ADR 0031, amendments),
   * and their members are the rows ordered across ancestors — the slow path.
   */
  function bigBoard() {
    const board = createBoard();
    const { store, surface, surfaceId } = board;
    let n = 0;
    const next = () => `a${(n++).toString(36).padStart(4, '0')}`;
    const loose: string[] = [];
    for (let i = 0; i < 500; i++) loose.push(shape(surface, next(), i * 12));
    for (let g = 0; g < 100; g++) {
      const a = shape(surface, next());
      const b = shape(surface, next());
      surface.addElement({
        type: 'group',
        children: { [a]: true, [b]: true },
        index: next(),
      });
    }
    for (let f = 0; f < 20; f++) {
      const members = loose.slice(f * 5, f * 5 + 5);
      store.addBlock(
        'affine:frame',
        {
          xywh: `[${f * 60},0,60,10]`,
          index: next(),
          title: new Text(`Frame ${f + 1}`),
          childElementIds: Object.fromEntries(members.map(id => [id, true])),
        },
        surfaceId
      );
    }
    return board;
  }

  test(`an 820-model canvas builds within ${FRAME_BUDGET_MS} ms`, () => {
    const { store, surface } = bigBoard();
    const models = gfxFor(store, surface).gfxElements;
    expect(models).toHaveLength(820);

    let best = Infinity;
    let tree: SelectionPaneNode[] = [];
    // Best of several samples, and the sweep is prolonged while no sample has
    // made the budget: alone the build takes about a third of it, but the
    // whole unit suite runs in parallel and a starved worker measured 18 ms
    // on its best of ten. A real regression fails every sample, so the cap
    // only costs time when the budget is truly broken.
    const deadline = performance.now() + 3_000;
    for (
      let i = 0;
      i < SAMPLES || (best >= FRAME_BUDGET_MS && performance.now() < deadline);
      i++
    ) {
      const start = performance.now();
      tree = buildSelectionPaneTree(models);
      best = Math.min(best, performance.now() - start);
    }

    // The default layer, holding 500 loose rows (100 of them a frame's
    // members), 100 groups and 20 frames.
    expect(tree).toHaveLength(1);
    expect(rowsOf(tree)).toHaveLength(620);
    expect(best).toBeLessThan(FRAME_BUDGET_MS);
  }, 30_000);

  // The tree orders rows across ancestors on chains it reads once per model,
  // not through `compareLayer`, to hold the budget above. This is the parity
  // that keeps the two one rule: the top-level rows are exactly the canvas'
  // own comparator, reversed.
  test('its order across ancestors is compareLayer’s', () => {
    const { store, surface } = bigBoard();
    const models = gfxFor(store, surface).gfxElements;
    const topLevel = models.filter(model => paneContainerOf(model) === null);

    expect(ids(rowsOf(buildSelectionPaneTree(models)))).toEqual(
      [...topLevel].sort((a, b) => compareLayer(b, a)).map(model => model.id)
    );
  });

  test('a drag does not rebuild it; a reorder does', () => {
    const { store, surface } = createBoard();
    const s0 = shape(surface, 'a0');
    shape(surface, 'a1');
    const gfx = gfxFor(store, surface);
    const model = new SelectionPaneModel(stdFor(store, gfx));
    model.mounted();

    expect(rowsOf(model.tree$.value)).toHaveLength(2);
    const built = gfx.reads;

    // Geometry churn, a frame of a drag.
    surface.updateElement(s0, { xywh: '[50,50,10,10]' });
    expect(rowsOf(model.tree$.value)).toHaveLength(2);
    expect(gfx.reads).toBe(built);

    // Stacking changes the rows.
    surface.updateElement(s0, { index: 'a2' });
    expect(ids(rowsOf(model.tree$.value))[0]).toBe(s0);
    expect(gfx.reads).toBe(built + 1);

    model.unmounted();
  });
});
