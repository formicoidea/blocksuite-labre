/**
 * ADR 0031, stage 5 — "Hide for everyone", on a real document.
 *
 * Hide is local by default; this is the distinct gesture that persists and
 * syncs. It writes a NEW stored field, `hiddenForEveryone`, never `hidden`
 * (mindmap collapse owns that one). What this spec pins:
 *
 * - every gfx block schema declares the prop with an `undefined` default, the
 *   way each declares `lockedBySelf` — without the declaration a block write
 *   would not reach its `prop:` key;
 * - hiding writes `true` on an element and on a block; showing REMOVES the key
 *   (never stores `false`), so the document goes back to byte-identical;
 * - one gesture is one undo step; a gesture that changes nothing writes
 *   nothing; a read-only store refuses;
 * - `canvas.visibility.hideForEveryone` reports `CanvasVisibilityChanged`
 *   with `scope: 'everyone'` and the count it wrote;
 * - a remote peer receiving the update sees the element hidden: its
 *   `GfxHiddenForEveryone` set (what its renderers and picking skip) holds it;
 * - the pane's tree lists it, marked.
 *
 * `gfx` is a stub over the real surface and store, as in
 * `selection-pane.unit.spec.ts`.
 */
import {
  buildSelectionPaneTree,
  selectionPaneCommands,
  type SurfaceBlockModel,
} from '@labre/affine-block-surface';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import { TelemetryProvider } from '@labre/affine-shared/services';
import { type BlockStdScope, runCommand } from '@labre/std';
import {
  GfxBlockElementModel,
  GfxControllerIdentifier,
  GfxHiddenForEveryone,
  GfxLocalVisibility,
  type GfxModel,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';
import { internalPrimitives, type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { getInternalStoreExtensions } from '../extensions/store.js';

let seq = 0;

function createBoard(id = `hide-everyone-${seq++}`) {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();
  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  let noteId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('h') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
    noteId = store.addBlock('affine:note', { xywh: '[0,0,100,50]' }, rootId);
  });
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;
  const shape = (index: string) =>
    surface.addElement({ type: 'shape', xywh: '[0,0,10,10]', index });
  store.resetHistory();
  return { store, surface, noteId, shape };
}

function mount(store: Store, surface: SurfaceBlockModel) {
  const events: { name: string; props: Record<string, unknown> }[] = [];
  const hiddenForEveryone = new GfxHiddenForEveryone();
  hiddenForEveryone.watch(store, surface);
  const localVisibility = new GfxLocalVisibility();
  localVisibility.register(hiddenForEveryone.ids$);
  const gfx = {
    surface,
    surface$: { value: surface },
    hiddenForEveryone,
    localVisibility,
    selection: { selectedIds: [] as string[] },
    get gfxElements(): GfxModel[] {
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
  const std = {
    store,
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : undefined,
    getOptional: (identifier: unknown) =>
      identifier === TelemetryProvider
        ? {
            track: (name: string, props: Record<string, unknown>) =>
              events.push({ name, props }),
          }
        : null,
  } as unknown as BlockStdScope;
  return { std, gfx, events };
}

const hide = selectionPaneCommands.find(
  command => command.id === 'canvas.visibility.hideForEveryone'
)!;
const PANE = {
  surface: 'contextual-toolbar',
  source: 'toolbar:general',
} as const;

describe('every gfx block schema declares hiddenForEveryone', () => {
  /**
   * A gfx block schema is one whose default props carry `xywh` and `index`
   * (`GfxCompatibleProps`). Each must declare the new prop exactly as it
   * declares `lockedBySelf`, with an `undefined` default: undeclared, the
   * store's props proxy would not write it; any other default would be
   * written into every document on load.
   */
  test('fifteen schemas, each with an undefined default', () => {
    // Every schema the store extensions register — `affine:embed-iframe`
    // comes from its block's store extension, not from `getAffineSchemas`.
    const { store } = createBoard();
    const gfxSchemas = [...store.schema.flavourSchemaMap.values()]
      .map(schema => ({
        flavour: schema.model.flavour,
        props: (schema.model.props?.(internalPrimitives) ?? {}) as Record<
          string,
          unknown
        >,
      }))
      .filter(({ props }) => 'xywh' in props && 'index' in props);

    expect(gfxSchemas.map(s => s.flavour).sort()).toEqual([
      'affine:attachment',
      'affine:bookmark',
      'affine:edgeless-text',
      'affine:embed-figma',
      'affine:embed-github',
      'affine:embed-html',
      'affine:embed-iframe',
      'affine:embed-linked-doc',
      'affine:embed-loom',
      'affine:embed-synced-doc',
      'affine:embed-youtube',
      'affine:frame',
      'affine:image',
      'affine:latex',
      'affine:note',
    ]);
    for (const { flavour, props } of gfxSchemas) {
      expect('lockedBySelf' in props, flavour).toBe(true);
      expect('hiddenForEveryone' in props, flavour).toBe(true);
      expect(props.hiddenForEveryone, flavour).toBeUndefined();
    }
  });

  test('loading a document writes no hiddenForEveryone key', () => {
    const { store, noteId } = createBoard();
    expect(
      store.getBlock(noteId)!.model.yBlock.has('prop:hiddenForEveryone')
    ).toBe(false);
  });
});

describe('hide for everyone', () => {
  test('an element and a block: true when hidden, no key once shown', () => {
    const { store, surface, noteId, shape } = createBoard();
    const a = shape('a0');
    const { std, gfx } = mount(store, surface);

    runCommand(std, hide, PANE, { ids: [a, noteId] });

    const element = surface.getElementById(a) as GfxPrimitiveElementModel;
    const note = store.getBlock(noteId)!.model;
    expect(element.yMap.get('hiddenForEveryone')).toBe(true);
    expect(element.hidden).toBe(false);
    expect(note.yBlock.get('prop:hiddenForEveryone')).toBe(true);
    expect(gfx.localVisibility.isHidden(element)).toBe(true);
    expect(gfx.localVisibility.isHidden(note as GfxBlockElementModel)).toBe(
      true
    );

    runCommand(std, hide, PANE, { ids: [a, noteId], hidden: false });

    expect(element.yMap.has('hiddenForEveryone')).toBe(false);
    expect(note.yBlock.has('prop:hiddenForEveryone')).toBe(false);
    expect(gfx.localVisibility.isHidden(element)).toBe(false);
  });

  test('one gesture is one undo step; nothing changed writes nothing', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a0');
    const b = shape('a1');
    const { std } = mount(store, surface);
    store.resetHistory();

    runCommand(std, hide, PANE, { ids: [a, b] });
    store.undo();
    expect(surface.getElementById(a)!.hiddenForEveryone).toBeUndefined();
    expect(surface.getElementById(b)!.hiddenForEveryone).toBeUndefined();
    expect(store.canUndo).toBe(false);

    const updates: Uint8Array[] = [];
    store.doc.spaceDoc.on('update', update => updates.push(update));
    runCommand(std, hide, PANE, { ids: [a], hidden: false });
    expect(updates).toHaveLength(0);
  });

  test('a read-only store refuses', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a0');
    const { std, events } = mount(store, surface);
    store.readonly = true;

    expect(hide.availability).toBe('editable');
    hide.run(std, PANE, { ids: [a] });

    expect(surface.getElementById(a)!.hiddenForEveryone).toBeUndefined();
    expect(events).toEqual([]);
  });

  test('reports scope everyone with the count it wrote', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a0');
    const b = shape('a1');
    const { std, events } = mount(store, surface);

    runCommand(std, hide, PANE, { ids: [a] });
    runCommand(std, hide, PANE, { ids: [a, b] });

    expect(events.map(event => event.props)).toEqual([
      {
        page: 'whiteboard editor',
        target: 'element',
        scope: 'everyone',
        hidden: true,
        count: 1,
      },
      {
        page: 'whiteboard editor',
        target: 'element',
        scope: 'everyone',
        hidden: true,
        count: 1,
      },
    ]);
  });

  test('a remote peer sees it hidden, and shown again', () => {
    const author = createBoard('hide-everyone-author');
    const a = author.shape('a0');
    const peer = createBoard('hide-everyone-peer');
    const peerSpace = peer.store.doc.spaceDoc;
    Y.applyUpdate(peerSpace, Y.encodeStateAsUpdate(author.store.doc.spaceDoc));
    const peerSurface = [...peer.store.getAllModels()].find(
      model => model.id === author.surface.id
    ) as SurfaceBlockModel;
    const theirs = mount(peer.store, peerSurface);
    const sync = () =>
      Y.applyUpdate(
        peerSpace,
        Y.encodeStateAsUpdate(
          author.store.doc.spaceDoc,
          Y.encodeStateVector(peerSpace)
        ),
        'remote'
      );

    const { std } = mount(author.store, author.surface);
    runCommand(std, hide, PANE, { ids: [a, author.noteId] });
    sync();

    expect([...theirs.gfx.hiddenForEveryone.ids$.value].sort()).toEqual(
      [a, author.noteId].sort()
    );
    expect(
      theirs.gfx.localVisibility.isHidden(peerSurface.getElementById(a)!)
    ).toBe(true);

    runCommand(std, hide, PANE, { ids: [a], hidden: false });
    sync();
    expect([...theirs.gfx.hiddenForEveryone.ids$.value]).toEqual([
      author.noteId,
    ]);
  });

  test('the pane lists it, marked', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a0');
    const { std, gfx } = mount(store, surface);
    runCommand(std, hide, PANE, { ids: [a] });

    const row = buildSelectionPaneTree(gfx.gfxElements).find(
      node => node.id === a
    );
    expect(row).toMatchObject({ hiddenForEveryone: true, hiddenLocal: false });
  });
});
