/**
 * ADR 0031, stage 4 — the canvas grid as a setting, on a real document.
 *
 * The grid used to be CSS only. It now has four levels, nearest decision
 * first (§11): the viewer's override, the document's `showGrid` written by
 * "Save for everyone", the host's `edgelessShowGrid`, and the library default
 * (on). What this spec pins:
 *
 * - the precedence, level by level;
 * - the toggle is LOCAL: zero Yjs update, remembered per viewer and per
 *   document through the real `EditPropsStore`, and allowed on a read-only
 *   document;
 * - "Save for everyone" writes `showGrid` once, in one undo step, clears the
 *   saver's override, refuses a read-only store and writes nothing when the
 *   document already says so;
 * - a peer receiving the update sees the saved grid (two docs exchanging
 *   updates), unless their own override says otherwise;
 * - `canvas.grid.toggle` / `canvas.grid.saveForEveryone` report
 *   `CanvasGridToggled` with the right scope, and nothing when nothing
 *   changed.
 *
 * `gfx` is a stub over the real surface, as in
 * `canvas-local-visibility.unit.spec.ts`.
 */
import {
  canvasGridCommands,
  type SurfaceBlockModel,
} from '@labre/affine-block-surface';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import {
  CanvasGrid,
  EditorSettingProvider,
  EditPropsStore,
  resolveCanvasGrid,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import { type BlockStdScope, runCommand } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import type { Store } from '@labre/store';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { afterEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { getInternalStoreExtensions } from '../extensions/store.js';

let seq = 0;

function createBoard(id = `grid-${seq++}`) {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();
  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('grid') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;
  return { store, surface, surfaceId };
}

/** One editor mount: the real props store, an optional host setting. */
function mount(
  store: Store,
  surface: SurfaceBlockModel,
  hostSetting?: { edgelessShowGrid?: boolean }
) {
  const events: { name: string; props: Record<string, unknown> }[] = [];
  const gfx = { surface$: signal(surface) };
  const services = new Map<unknown, unknown>();
  const std = {
    store,
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : services.get(identifier),
    getOptional: (identifier: unknown) => services.get(identifier) ?? null,
  } as unknown as BlockStdScope;
  services.set(EditPropsStore, new EditPropsStore(std));
  if (hostSetting) {
    services.set(EditorSettingProvider, { setting$: signal(hostSetting) });
  }
  services.set(TelemetryProvider, {
    track: (name: string, props: Record<string, unknown>) =>
      events.push({ name, props }),
  });
  const grid = new CanvasGrid(std);
  services.set(CanvasGrid, grid);
  grid.mounted();
  return { std, grid, events };
}

const command = (id: string) =>
  canvasGridCommands.find(candidate => candidate.id === id)!;

const PALETTE = { surface: 'palette', source: 'shortcut' } as const;

afterEach(() => {
  localStorage.clear();
});

describe('the four levels, nearest decision first', () => {
  test('resolveCanvasGrid', () => {
    expect(resolveCanvasGrid({})).toEqual({ visible: true, source: 'library' });
    expect(resolveCanvasGrid({ host: false })).toEqual({
      visible: false,
      source: 'host',
    });
    expect(resolveCanvasGrid({ host: false, document: true })).toEqual({
      visible: true,
      source: 'document',
    });
    expect(
      resolveCanvasGrid({ host: true, document: true, local: false })
    ).toEqual({ visible: false, source: 'local' });
  });

  test('on a mounted editor: library, host, document, then the viewer', () => {
    const { store, surface } = createBoard();
    expect(mount(store, surface).grid.visible$.value).toBe(true);

    const { grid } = mount(store, surface, { edgelessShowGrid: false });
    expect(grid.visible$.value).toBe(false);
    expect(grid.source$.value).toBe('host');

    surface.props.showGrid = true;
    expect(grid.visible$.value).toBe(true);
    expect(grid.source$.value).toBe('document');

    grid.toggle();
    expect(grid.visible$.value).toBe(false);
    expect(grid.source$.value).toBe('local');
  });
});

describe('the toggle is local', () => {
  test('zero Yjs update, remembered per document, allowed read-only', () => {
    const { store, surface } = createBoard();
    const other = createBoard();
    store.readonly = true;
    const first = mount(store, surface);
    store.resetHistory();
    const updates: Uint8Array[] = [];
    store.doc.spaceDoc.on('update', update => updates.push(update));

    expect(first.grid.toggle()).toBe(false);
    expect(first.grid.visible$.value).toBe(false);
    expect(updates).toHaveLength(0);
    expect(store.canUndo).toBe(false);

    // A remount of the same document remembers it; another document does not.
    expect(mount(store, surface).grid.visible$.value).toBe(false);
    expect(mount(other.store, other.surface).grid.visible$.value).toBe(true);
  });
});

describe('save for everyone', () => {
  test('writes showGrid once, in one undo step, and clears the override', () => {
    const { store, surface } = createBoard();
    const { grid } = mount(store, surface);
    grid.toggle();
    store.resetHistory();

    expect(grid.saveForEveryone()).toBe(false);
    expect(surface.props.showGrid).toBe(false);
    expect(grid.source$.value).toBe('document');
    expect(mount(store, surface).grid.source$.value).toBe('document');

    store.undo();
    expect(surface.props.showGrid).toBeUndefined();
    expect(store.canUndo).toBe(false);
  });

  test('writes nothing when the document already says so', () => {
    const { store, surface } = createBoard();
    surface.props.showGrid = true;
    const { grid } = mount(store, surface);
    store.resetHistory();
    const updates: Uint8Array[] = [];
    store.doc.spaceDoc.on('update', update => updates.push(update));

    expect(grid.saveForEveryone()).toBeNull();
    expect(updates).toHaveLength(0);
  });

  test('a read-only store refuses', () => {
    const { store, surface } = createBoard();
    const { grid } = mount(store, surface);
    grid.toggle();
    store.readonly = true;

    expect(grid.saveForEveryone()).toBeNull();
    expect(surface.props.showGrid).toBeUndefined();
    // The saver's override is kept: nothing was saved in its place.
    expect(grid.source$.value).toBe('local');
  });

  test('a peer sees the saved grid, unless their own override says otherwise', () => {
    const author = createBoard('grid-peer-a');
    const peer = createBoard('grid-peer-b');
    // The peer starts from the author's document.
    const peerSpace = peer.store.doc.spaceDoc;
    Y.applyUpdate(peerSpace, Y.encodeStateAsUpdate(author.store.doc.spaceDoc));
    const peerSurface = [...peer.store.getAllModels()].find(
      model => model.id === author.surface.id
    ) as SurfaceBlockModel;
    const theirs = mount(peer.store, peerSurface);
    expect(theirs.grid.visible$.value).toBe(true);

    const { grid } = mount(author.store, author.surface);
    grid.toggle();
    grid.saveForEveryone();
    Y.applyUpdate(
      peerSpace,
      Y.encodeStateAsUpdate(
        author.store.doc.spaceDoc,
        Y.encodeStateVector(peerSpace)
      ),
      'remote'
    );

    expect(peerSurface.props.showGrid).toBe(false);
    expect(theirs.grid.visible$.value).toBe(false);
    theirs.grid.toggle();
    expect(theirs.grid.visible$.value).toBe(true);
  });
});

describe('the commands', () => {
  test('toggle reports scope local; save reports scope everyone', () => {
    const { store, surface } = createBoard();
    const { std, events } = mount(store, surface);

    runCommand(std, command('canvas.grid.toggle'), PALETTE);
    runCommand(std, command('canvas.grid.saveForEveryone'), PALETTE);
    // Saving again changes nothing in the document and says nothing.
    runCommand(std, command('canvas.grid.saveForEveryone'), PALETTE);

    expect(events).toEqual([
      {
        name: 'CanvasGridToggled',
        props: { page: 'whiteboard editor', scope: 'local', visible: false },
      },
      {
        name: 'CanvasGridToggled',
        props: { page: 'whiteboard editor', scope: 'everyone', visible: false },
      },
    ]);
  });

  test('save is not offered on a read-only document', () => {
    const save = command('canvas.grid.saveForEveryone');
    expect(save.availability).toBe('editable');
    expect(command('canvas.grid.toggle').availability).toBeUndefined();
  });
});
