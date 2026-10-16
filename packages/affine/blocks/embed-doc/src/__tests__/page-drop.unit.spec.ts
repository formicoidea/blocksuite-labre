import { SurfaceBlockSchemaExtension } from '@labre/affine-block-surface';
import {
  CalloutBlockSchemaExtension,
  EmbedLinkedDocBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  type PageDropService,
  PageDropProvider,
  pageDropVerdict,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { type BlockModel, type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, it, vi } from 'vitest';

import { dropPage, placePageCard, runUndoHooks } from '../page-drop/page-drop';

/**
 * A page dragged from the host's sidebar into the open page (labre P7,
 * ADR-0045 §7 amended 2026-10-16): the host moves the page, the editor places
 * its card where it was dropped, and one undo takes both back.
 *
 * What it would have caught:
 * - a drop that writes anything without a `PageDropProvider` (the editor must
 *   mount and behave as before without one), or on a read-only document;
 * - a card placed where its schema is refused (inside a callout) instead of
 *   beside the container;
 * - the host's change left in place when Mod+Z removes the card, or not
 *   re-applied by Mod+Shift+Z (the hooks lost on the redo step's fresh meta);
 * - two cards for one drop when an editor nested in another sees the same
 *   bubbling event;
 * - a host refusal (`drop` returning null) that still writes a card.
 */

const DRAG_TYPE = 'application/x-host-page';

let seq = 0;

function pageStore() {
  const workspace = new TestWorkspace({ id: `page-drop-${seq++}` });
  workspace.storeExtensions = [
    RootBlockSchemaExtension,
    SurfaceBlockSchemaExtension,
    NoteBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
    CalloutBlockSchemaExtension,
    EmbedLinkedDocBlockSchemaExtension,
  ];
  workspace.meta.initialize();
  const store = workspace.createDoc('open-page').getStore();
  const ids = { note: '', first: '', second: '', callout: '', inCallout: '' };
  store.load(() => {
    const root = store.addBlock('affine:page', { title: new Text('') });
    store.addBlock('affine:surface', {}, root);
    ids.note = store.addBlock('affine:note', {}, root);
    ids.first = store.addBlock(
      'affine:paragraph',
      { text: new Text('a') },
      ids.note
    );
    ids.second = store.addBlock(
      'affine:paragraph',
      { text: new Text('b') },
      ids.note
    );
    ids.callout = store.addBlock('affine:callout', {}, ids.note);
    ids.inCallout = store.addBlock('affine:paragraph', {}, ids.callout);
  });
  return { store, ids };
}

function stdFor(store: Store, providers: [unknown, unknown][] = []) {
  const map = new Map(providers);
  return {
    store,
    host: { store },
    getOptional: (id: unknown) => map.get(id) ?? null,
  } as unknown as BlockStdScope;
}

function model(store: Store, id: string): BlockModel {
  const block = store.getBlock(id);
  if (!block) throw new Error(`no block ${id}`);
  return block.model;
}

function flavours(store: Store, id: string) {
  return model(store, id).children.map(child => child.flavour);
}

function cardsOf(store: Store) {
  return store
    .getModelsByFlavour('affine:embed-linked-doc')
    .map(card => (card.props as { pageId: string }).pageId);
}

function dragOf(pageId: string) {
  const dataTransfer = new DataTransfer();
  dataTransfer.setData(DRAG_TYPE, pageId);
  return { dataTransfer, clientX: -1000, clientY: -1000 };
}

/** A host that accepts its own drags and records what it did. */
function host(overrides: Partial<PageDropService> = {}) {
  const calls: string[] = [];
  const service: PageDropService = {
    verdict: ({ types }) => (types.includes(DRAG_TYPE) ? 'accept' : 'ignore'),
    drop: ({ dataTransfer, docId }) => {
      const pageId = dataTransfer.getData(DRAG_TYPE);
      calls.push(`move ${pageId} under ${docId}`);
      return {
        pageId,
        undo: () => calls.push(`undo ${pageId}`),
        redo: () => calls.push(`redo ${pageId}`),
      };
    },
    ...overrides,
  };
  return { calls, service };
}

describe('pageDropVerdict', () => {
  it('ignores every drag without a host, and mounts nothing', () => {
    const { store } = pageStore();
    const drag = dragOf('child');
    expect(pageDropVerdict(stdFor(store), drag.dataTransfer)).toBe('ignore');
    expect(dropPage(stdFor(store), drag, false)).toBeNull();
    expect(cardsOf(store)).toEqual([]);
    expect(store.canUndo).toBe(false);
  });

  it("hands the host the drag's types and the open document", () => {
    const { store } = pageStore();
    const verdict = vi.fn(() => 'refuse' as const);
    const std = stdFor(store, [[PageDropProvider, { verdict, drop: vi.fn() }]]);

    expect(pageDropVerdict(std, dragOf('child').dataTransfer)).toBe('refuse');
    expect(verdict).toHaveBeenCalledWith({
      types: [DRAG_TYPE],
      docId: 'open-page',
    });
  });

  it('refuses a drag the host accepts on a read-only document', () => {
    const { store } = pageStore();
    store.readonly = true;
    const { service } = host();
    const std = stdFor(store, [[PageDropProvider, service]]);

    expect(pageDropVerdict(std, dragOf('child').dataTransfer)).toBe('refuse');
    expect(pageDropVerdict(std, new DataTransfer())).toBe('ignore');
  });
});

describe('placePageCard', () => {
  it('puts the card on the drop line, before or after its block', () => {
    const { store, ids } = pageStore();
    const std = stdFor(store);

    placePageCard(std, 'p1', {
      canvas: false,
      line: { model: model(store, ids.second), placement: 'before' },
      point: [0, 0],
    });
    placePageCard(std, 'p2', {
      canvas: false,
      line: { model: model(store, ids.second), placement: 'after' },
      point: [0, 0],
    });

    expect(flavours(store, ids.note)).toEqual([
      'affine:paragraph',
      'affine:embed-linked-doc',
      'affine:paragraph',
      'affine:embed-linked-doc',
      'affine:callout',
    ]);
    expect(cardsOf(store)).toEqual(['p1', 'p2']);
  });

  it('climbs out of a block that cannot hold a card', () => {
    const { store, ids } = pageStore();
    placePageCard(stdFor(store), 'p1', {
      canvas: false,
      line: { model: model(store, ids.inCallout), placement: 'before' },
      point: [0, 0],
    });

    expect(flavours(store, ids.callout)).toEqual(['affine:paragraph']);
    expect(flavours(store, ids.note).at(-1)).toBe('affine:embed-linked-doc');
  });

  it('goes to the end of the last note in the page view without a line', () => {
    const { store, ids } = pageStore();
    const track = vi.fn();
    placePageCard(stdFor(store, [[TelemetryProvider, { track }]]), 'p1', {
      canvas: false,
      line: null,
      point: [0, 0],
    });

    expect(flavours(store, ids.note).at(-1)).toBe('affine:embed-linked-doc');
    expect(track).toHaveBeenCalledWith('BlockCreated', {
      blockType: 'affine:embed-linked-doc',
    });
  });

  it('writes nothing on a read-only document', () => {
    const { store, ids } = pageStore();
    store.readonly = true;
    expect(
      placePageCard(stdFor(store), 'p1', {
        canvas: false,
        line: { model: model(store, ids.first), placement: 'after' },
        point: [0, 0],
      })
    ).toBeNull();
    expect(cardsOf(store)).toEqual([]);
  });
});

describe('dropPage', () => {
  it('asks the host once, places the card, and one undo takes both back', () => {
    const { store, ids } = pageStore();
    const { calls, service } = host();
    const std = stdFor(store, [[PageDropProvider, service]]);
    // The watcher's listener, without mounting an editor.
    const onPopped = (event: {
      stackItem: { meta: Map<unknown, unknown> };
      type: 'undo' | 'redo';
    }) => runUndoHooks(store, event);
    store.history.undoManager.on('stack-item-popped', onPopped);

    const id = dropPage(std, dragOf('child'), false);

    expect(id).not.toBeNull();
    expect(cardsOf(store)).toEqual(['child']);
    expect(flavours(store, ids.note).at(-1)).toBe('affine:embed-linked-doc');
    expect(calls).toEqual(['move child under open-page']);

    store.undo();
    expect(cardsOf(store)).toEqual([]);
    expect(calls.at(-1)).toBe('undo child');

    store.redo();
    expect(cardsOf(store)).toEqual(['child']);
    expect(calls.at(-1)).toBe('redo child');

    store.undo();
    expect(cardsOf(store)).toEqual([]);
    expect(calls).toEqual([
      'move child under open-page',
      'undo child',
      'redo child',
      'undo child',
    ]);
    store.history.undoManager.off('stack-item-popped', onPopped);
  });

  it('places one card when two nested editors see the same event', () => {
    const { store } = pageStore();
    const { calls, service } = host();
    const std = stdFor(store, [[PageDropProvider, service]]);
    const drag = dragOf('child');

    dropPage(std, drag, false);
    expect(dropPage(std, drag, false)).toBeNull();

    expect(cardsOf(store)).toEqual(['child']);
    expect(calls).toHaveLength(1);
  });

  it('writes nothing when the host turns the drop down', () => {
    const { store } = pageStore();
    const { service } = host({ drop: () => null });
    const std = stdFor(store, [[PageDropProvider, service]]);

    expect(dropPage(std, dragOf('child'), false)).toBeNull();
    expect(cardsOf(store)).toEqual([]);
    expect(store.canUndo).toBe(false);
  });

  it('never calls the host for a drag it ignored or refused', () => {
    const { store } = pageStore();
    const drop = vi.fn();
    const std = stdFor(store, [
      [PageDropProvider, { verdict: () => 'refuse', drop }],
    ]);

    expect(dropPage(std, dragOf('child'), false)).toBeNull();
    expect(
      dropPage(std, { ...dragOf('x'), dataTransfer: new DataTransfer() }, false)
    ).toBeNull();
    expect(drop).not.toHaveBeenCalled();
  });
});
