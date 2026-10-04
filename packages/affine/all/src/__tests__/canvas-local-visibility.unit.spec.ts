/**
 * ADR 0031, stage 3 — local hide, on a real document.
 *
 * Hide is per viewer by default: the ids live in `CanvasLocalVisibility`,
 * persist in `localStorage` through the real `EditPropsStore` (keyed by
 * document id, like the viewport) and reach the canvas through
 * `gfx.localVisibility`. What this spec pins:
 *
 * - hiding and showing produce ZERO Yjs update — the document never hears of
 *   it, which is the whole difference with the later "hide for everyone";
 * - the ids survive a remount, and ids the document no longer has are pruned
 *   when they are loaded;
 * - `canvas.visibility.hideLocal` / `.showAll` change what they say, report
 *   `CanvasVisibilityChanged` with the count they actually changed, and report
 *   nothing when they change nothing;
 * - the pane's tree still LISTS a hidden element, marked.
 *
 * `gfx` is a stub over the real surface, carrying the real
 * `GfxLocalVisibility` hook — the same arrangement as
 * `selection-pane.unit.spec.ts`.
 */
import {
  buildSelectionPaneTree,
  selectionPaneCommands,
  type SurfaceBlockModel,
} from '@labre/affine-block-surface';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import {
  CanvasLocalVisibility,
  EditPropsStore,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import { type BlockStdScope, runCommand } from '@labre/std';
import {
  GfxControllerIdentifier,
  GfxLocalVisibility,
  type GfxModel,
} from '@labre/std/gfx';
import type { Store } from '@labre/store';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { afterEach, describe, expect, test } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';

let seq = 0;

function createBoard() {
  const id = `local-hide-${seq++}`;
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();
  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('hide') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;
  const shape = (index: string) =>
    surface.addElement({ type: 'shape', xywh: '[0,0,10,10]', index });
  return { store, surface, shape };
}

/** One editor mount: a fresh hook, a fresh service, the real props store. */
function mount(store: Store, surface: SurfaceBlockModel) {
  const events: { name: string; props: Record<string, unknown> }[] = [];
  const gfx = {
    surface$: { value: surface },
    localVisibility: new GfxLocalVisibility(),
    selection: { selectedIds: [] as string[] },
    get gfxElements(): GfxModel[] {
      return [...surface.elementModels];
    },
    getElementById: (id: string) => surface.getElementById(id) ?? null,
  };
  const services = new Map<unknown, unknown>();
  const std = {
    store,
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : services.get(identifier),
    getOptional: (identifier: unknown) => services.get(identifier) ?? null,
  } as unknown as BlockStdScope;
  services.set(EditPropsStore, new EditPropsStore(std));
  services.set(TelemetryProvider, {
    track: (name: string, props: Record<string, unknown>) =>
      events.push({ name, props }),
  });
  const visibility = new CanvasLocalVisibility(std);
  services.set(CanvasLocalVisibility, visibility);
  visibility.mounted();
  return { std, gfx, visibility, events };
}

const command = (id: string) =>
  selectionPaneCommands.find(candidate => candidate.id === id)!;

const PALETTE = { surface: 'palette', source: 'shortcut' } as const;

afterEach(() => {
  localStorage.clear();
});

describe('a local hide never reaches the document', () => {
  test('hide and show produce zero Yjs update', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a0');
    const { gfx, visibility } = mount(store, surface);
    store.resetHistory();
    const updates: Uint8Array[] = [];
    store.doc.spaceDoc.on('update', update => updates.push(update));

    expect(visibility.hide([a])).toBe(1);
    expect(gfx.localVisibility.isHidden(surface.getElementById(a)!)).toBe(true);
    expect(visibility.show([a])).toBe(1);
    expect(visibility.hide([a])).toBe(1);
    expect(visibility.showAll()).toBe(1);

    expect(updates).toHaveLength(0);
    expect(store.canUndo).toBe(false);
  });

  test('a read-only viewer may hide: it is a way of looking', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a0');
    store.readonly = true;
    const { visibility } = mount(store, surface);

    expect(visibility.hide([a])).toBe(1);
    expect(visibility.isHidden(a)).toBe(true);
  });
});

describe('the hide is remembered per document', () => {
  test('a remount restores it, and prunes what the document lost', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a0');
    const b = shape('a1');
    const first = mount(store, surface);
    first.visibility.hide([a, b]);
    first.visibility.unmounted();

    surface.deleteElement(b);
    const second = mount(store, surface);

    expect([...second.visibility.hiddenIds$.value]).toEqual([a]);
    expect(
      second.gfx.localVisibility.isHidden(surface.getElementById(a)!)
    ).toBe(true);
    // The pruned list is what is stored now.
    const third = mount(store, surface);
    expect([...third.visibility.hiddenIds$.value]).toEqual([a]);
  });
});

describe('the commands', () => {
  test('hideLocal hides, shows back, and reports what it changed', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a0');
    const b = shape('a1');
    const { std, visibility, events } = mount(store, surface);

    runCommand(std, command('canvas.visibility.hideLocal'), PALETTE, {
      ids: [a, b],
    });
    expect(visibility.isHidden(a) && visibility.isHidden(b)).toBe(true);
    // Hiding what is already hidden changes nothing and says nothing.
    runCommand(std, command('canvas.visibility.hideLocal'), PALETTE, {
      ids: [a],
    });
    runCommand(std, command('canvas.visibility.hideLocal'), PALETTE, {
      ids: [a],
      hidden: false,
    });
    expect(visibility.isHidden(a)).toBe(false);

    expect(events).toEqual([
      {
        name: 'CanvasVisibilityChanged',
        props: {
          page: 'whiteboard editor',
          target: 'element',
          scope: 'local',
          hidden: true,
          count: 2,
        },
      },
      {
        name: 'CanvasVisibilityChanged',
        props: {
          page: 'whiteboard editor',
          target: 'element',
          scope: 'local',
          hidden: false,
          count: 1,
        },
      },
    ]);
  });

  test('showAll is offered only when something is hidden', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a0');
    const { std, visibility, events } = mount(store, surface);
    const showAll = command('canvas.visibility.showAll');

    expect(showAll.when!(std)).toBe(false);
    visibility.hide([a]);
    expect(showAll.when!(std)).toBe(true);

    runCommand(std, showAll, PALETTE);
    expect(visibility.isHidden(a)).toBe(false);
    expect(events.at(-1)?.props).toMatchObject({ hidden: false, count: 1 });
  });
});

describe('the pane still lists a hidden element', () => {
  test('marked, not dropped', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a0');
    const b = shape('a1');
    const { gfx, visibility } = mount(store, surface);
    visibility.hide([a]);

    const tree = buildSelectionPaneTree(
      gfx.gfxElements,
      visibility.hiddenIds$.value
    );
    expect(tree.map(row => [row.id, row.hiddenLocal])).toEqual([
      [b, false],
      [a, true],
    ]);
  });
});
