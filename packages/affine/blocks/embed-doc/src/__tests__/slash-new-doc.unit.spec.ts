import { SurfaceBlockSchemaExtension } from '@labre/affine-block-surface';
import {
  CalloutBlockSchemaExtension,
  EmbedLinkedDocBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { insertContent } from '@labre/affine-rich-text';
import { REFERENCE_NODE } from '@labre/affine-shared/consts';
import {
  LinkedDocCreationProvider,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { type BlockModel, type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, it, vi } from 'vitest';

import {
  canCreateDocHere,
  createDocFromSlash,
} from '../embed-linked-doc-block/configs/new-doc';

/**
 * The slash menu's "New Page" (Labre ADR-0045 §9, host side).
 *
 * It used to make a bare in-workspace doc and leave an inline MENTION, so the
 * Labre host overrode the whole `LinkedDocSlashMenuConfigIdentifier` config to
 * create the page through its page tree and leave a CARD. The entry now asks
 * the host's `LinkedDocCreationProvider` for the page (the same seam as the
 * edgeless "Create linked page"), writes a blank page into it, and leaves an
 * `affine:embed-linked-doc` card in place of the line the gesture emptied.
 * These specs hold that contract, with and without a host.
 */

vi.mock('@labre/affine-rich-text', () => ({ insertContent: vi.fn() }));

let seq = 0;

function pageStore() {
  const workspace = new TestWorkspace({ id: `slash-new-doc-${seq++}` });
  workspace.storeExtensions = [
    RootBlockSchemaExtension,
    SurfaceBlockSchemaExtension,
    NoteBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
    CalloutBlockSchemaExtension,
    EmbedLinkedDocBlockSchemaExtension,
  ];
  workspace.meta.initialize();
  const store = workspace.createDoc('page').getStore();
  const ids = { note: '', typed: '', empty: '', inCallout: '' };
  store.load(() => {
    const root = store.addBlock('affine:page', { title: new Text('') });
    store.addBlock('affine:surface', {}, root);
    ids.note = store.addBlock('affine:note', {}, root);
    ids.typed = store.addBlock(
      'affine:paragraph',
      { text: new Text('a') },
      ids.note
    );
    ids.empty = store.addBlock('affine:paragraph', {}, ids.note);
    const callout = store.addBlock('affine:callout', {}, ids.note);
    ids.inCallout = store.addBlock('affine:paragraph', {}, callout);
  });
  return { workspace, store, ids };
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

describe('slash "New Page"', () => {
  it('replaces the emptied line by a card of the host-created page, one undo step', () => {
    const { workspace, store, ids } = pageStore();
    const capture = vi.spyOn(store, 'captureSync');
    const track = vi.fn();
    const created = workspace.createDoc('host-page').getStore();
    const createLinkedDoc = vi.fn(() => created);
    const std = stdFor(store, [
      [LinkedDocCreationProvider, { createLinkedDoc }],
      [TelemetryProvider, { track }],
    ]);

    const pageId = createDocFromSlash(std, model(store, ids.empty));

    expect(pageId).toBe('host-page');
    expect(createLinkedDoc).toHaveBeenCalledWith(std.host, '');
    expect(flavours(store, ids.note)).toEqual([
      'affine:paragraph',
      'affine:embed-linked-doc',
      'affine:callout',
    ]);
    const card = model(store, ids.note).children[1] as unknown as {
      props: { pageId: string };
    };
    expect(card.props.pageId).toBe('host-page');
    expect(capture).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('BlockCreated', {
      blockType: 'affine:embed-linked-doc',
    });
    // The host's store was left unloaded: the lib wrote a blank page into it.
    expect(created.root?.flavour).toBe('affine:page');
    const note = created.getModelsByFlavour('affine:note')[0];
    expect(note?.children.map(child => child.flavour)).toEqual([
      'affine:paragraph',
    ]);
    expect(created.canUndo).toBe(false);
  });

  it('keeps a typed line and puts the card after it', () => {
    const { store, ids } = pageStore();
    createDocFromSlash(stdFor(store), model(store, ids.typed));

    expect(flavours(store, ids.note)).toEqual([
      'affine:paragraph',
      'affine:embed-linked-doc',
      'affine:paragraph',
      'affine:callout',
    ]);
  });

  it('creates the page in the workspace when no host provides one', () => {
    const { workspace, store, ids } = pageStore();
    const pageId = createDocFromSlash(stdFor(store), model(store, ids.empty));

    expect(pageId).not.toBeNull();
    const doc = workspace.getDoc(pageId ?? '')?.getStore();
    expect(doc?.root?.flavour).toBe('affine:page');
    expect(flavours(store, ids.note)).toContain('affine:embed-linked-doc');
  });

  it('falls back on a mention where the parent refuses a card', () => {
    const { store, ids } = pageStore();
    const anchor = model(store, ids.inCallout);
    const callout = store.getParent(anchor);
    const std = stdFor(store);

    const pageId = createDocFromSlash(std, anchor);

    expect(callout?.children.map(child => child.flavour)).toEqual([
      'affine:paragraph',
    ]);
    expect(insertContent).toHaveBeenCalledWith(std, anchor, REFERENCE_NODE, {
      reference: { type: 'LinkedPage', pageId },
    });
  });

  it('writes nothing on a read-only store', () => {
    const { store, ids } = pageStore();
    store.readonly = true;
    const createLinkedDoc = vi.fn();
    const std = stdFor(store, [
      [LinkedDocCreationProvider, { createLinkedDoc }],
    ]);

    expect(createDocFromSlash(std, model(store, ids.empty))).toBeNull();
    expect(createLinkedDoc).not.toHaveBeenCalled();
    expect(flavours(store, ids.note)).toHaveLength(3);
  });

  it('accepts a provider of the 0.47 shape, without canCreateLinkedDoc', () => {
    // Type-level guard: the seam only widens in a minor (docs/lessons.md 33).
    const previous: LinkedDocCreationProvider = {
      createLinkedDoc: (host, _title) => host.store,
    };
    const { store, ids } = pageStore();
    expect(
      canCreateDocHere(
        stdFor(store, [[LinkedDocCreationProvider, previous]]),
        model(store, ids.empty)
      )
    ).toBe(true);
  });

  it('is offered unless the host refuses creation on this editor', () => {
    const { store, ids } = pageStore();
    const anchor = model(store, ids.empty);
    const createLinkedDoc = vi.fn();

    expect(canCreateDocHere(stdFor(store), anchor)).toBe(true);
    expect(
      canCreateDocHere(
        stdFor(store, [[LinkedDocCreationProvider, { createLinkedDoc }]]),
        anchor
      )
    ).toBe(true);
    const canCreateLinkedDoc = vi.fn(() => false);
    const std = stdFor(store, [
      [LinkedDocCreationProvider, { createLinkedDoc, canCreateLinkedDoc }],
    ]);
    expect(canCreateDocHere(std, anchor)).toBe(false);
    expect(canCreateLinkedDoc).toHaveBeenCalledWith(std.host);
  });
});
