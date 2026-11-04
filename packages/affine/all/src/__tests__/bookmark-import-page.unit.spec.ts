/**
 * A link card imported as the page it points at, on a real store (ADR 0048, amendment
 * of 2026-11-04). The host's half is a fake: reading, storing and asking are not the
 * library's.
 *
 * What it would have caught:
 * - a button shown without the host's extension, on a read-only document or on a
 *   citation, whose card its footnote holds;
 * - the host being asked twice by a double press;
 * - a card lost on a refusal, on a cancellation or on a host that rejects;
 * - an attachment written elsewhere than at the card's place, or not in its view;
 * - a version the reader agreed to overwrite left on another block of the document;
 * - an import that takes two undo steps, or leaves the card back without the blocks.
 */
import { canImportPage, importPage } from '@labre/affine-block-bookmark';
import { toast } from '@labre/affine-components/toast';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import type { BookmarkBlockModel } from '@labre/affine-model';
import {
  type HtmlFileConfig,
  HtmlFileConfigExtension,
  type HtmlPageImport,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { type BlockModel, type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';

vi.mock('@labre/affine-components/toast', () => ({ toast: vi.fn() }));

const NEW_SIZE = 12;
const OTHER_SIZE = 2;
const ASSET = {
  sourceId: 'sha-new',
  name: 'report.html',
  type: 'text/html',
  size: NEW_SIZE,
};

let seq = 0;

function board() {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const id = `import-page-${seq++}`;
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();
  const store = collection.createDoc(id).getStore({ id });
  let noteId = '';
  store.load(() => {
    const root = store.addBlock('affine:page', { title: new Text('t') });
    noteId = store.addBlock('affine:note', {}, root);
  });
  return { store, noteId };
}

function stdWith(store: Store, config: HtmlFileConfig | null) {
  return {
    store,
    host: document.createElement('div'),
    selection: {
      create: (_: unknown, value: unknown) => value,
      setGroup: vi.fn(),
    },
    getOptional: (identifier: unknown) =>
      identifier === HtmlFileConfigExtension.identifier ? config : null,
  } as unknown as BlockStdScope;
}

function card(store: Store, noteId: string, url = 'https://example.com/a') {
  const before = store.addBlock(
    'affine:paragraph',
    { text: new Text('before') },
    noteId
  );
  const id = store.addBlock(
    'affine:bookmark',
    { url, style: 'horizontal', caption: 'kept' },
    noteId
  );
  const after = store.addBlock(
    'affine:paragraph',
    { text: new Text('after') },
    noteId
  );
  return {
    model: store.getModelById(id) as BookmarkBlockModel,
    before,
    after,
  };
}

const flavours = (store: Store, noteId: string) =>
  (store.getModelById(noteId) as BlockModel).children.map(m => m.flavour);

afterEach(() => {
  vi.mocked(toast).mockClear();
});

describe('whether a card offers the import', () => {
  test('only when the host provides it', () => {
    const { store, noteId } = board();
    const { model } = card(store, noteId);
    expect(canImportPage(stdWith(store, null), model)).toBe(false);
    expect(canImportPage(stdWith(store, { frameUrl: '/f' }), model)).toBe(
      false
    );
    expect(
      canImportPage(
        stdWith(store, {
          importPage: async () => ({ status: 'cancelled' }),
        }),
        model
      )
    ).toBe(true);
  });

  test('never on a read-only document or a citation', () => {
    const { store, noteId } = board();
    const { model } = card(store, noteId);
    const std = stdWith(store, {
      importPage: async () => ({ status: 'cancelled' }),
    });
    store.updateBlock(model, { footnoteIdentifier: '1' });
    expect(canImportPage(std, model)).toBe(false);
    store.updateBlock(model, { footnoteIdentifier: null });
    store.readonly = true;
    expect(canImportPage(std, model)).toBe(false);
  });
});

describe('importing', () => {
  test('the card makes way for the file, at its place, with its caption', async () => {
    const { store, noteId } = board();
    const { model } = card(store, noteId);
    const importer = vi.fn(
      async (): Promise<HtmlPageImport> => ({
        status: 'imported',
        asset: ASSET,
      })
    );
    const std = stdWith(store, { frameUrl: '/f', importPage: importer });

    const id = await importPage(std, model);

    expect(importer).toHaveBeenCalledWith({
      url: 'https://example.com/a',
      docId: store.id,
    });
    expect(flavours(store, noteId)).toEqual([
      'affine:paragraph',
      'affine:attachment',
      'affine:paragraph',
    ]);
    const attachment = store.getModelById(id ?? '');
    expect(attachment?.props).toMatchObject({
      sourceId: 'sha-new',
      name: 'report.html',
      type: 'text/html',
      size: NEW_SIZE,
      embed: true,
      style: 'html',
      caption: 'kept',
    });
  });

  test('without the frame the file stays a card', async () => {
    const { store, noteId } = board();
    const { model } = card(store, noteId);
    const std = stdWith(store, {
      importPage: async () => ({ status: 'imported', asset: ASSET }),
    });
    const id = await importPage(std, model);
    expect(store.getModelById(id ?? '')?.props).toMatchObject({
      sourceId: 'sha-new',
      embed: false,
    });
  });

  test('a version agreed to be overwritten is replaced everywhere in the document', async () => {
    const { store, noteId } = board();
    const { model } = card(store, noteId);
    const held = store.addBlock(
      'affine:attachment',
      { sourceId: 'sha-old', name: 'old.html', size: 1, type: 'text/html' },
      noteId
    );
    const other = store.addBlock(
      'affine:attachment',
      { sourceId: 'sha-other', name: 'other.pdf', size: OTHER_SIZE },
      noteId
    );
    const std = stdWith(store, {
      importPage: async () => ({
        status: 'imported',
        asset: ASSET,
        replaces: 'sha-old',
      }),
    });

    await importPage(std, model);

    expect(store.getModelById(held)?.props).toMatchObject({
      sourceId: 'sha-new',
      name: 'report.html',
      size: NEW_SIZE,
    });
    expect(store.getModelById(other)?.props).toMatchObject({
      sourceId: 'sha-other',
      name: 'other.pdf',
    });
  });

  test('one gesture, one undo step, the card and the old version back', async () => {
    const { store, noteId } = board();
    const { model } = card(store, noteId);
    const held = store.addBlock(
      'affine:attachment',
      { sourceId: 'sha-old', name: 'old.html', size: 1, type: 'text/html' },
      noteId
    );
    const cardId = model.id;
    const std = stdWith(store, {
      importPage: async () => ({
        status: 'imported',
        asset: ASSET,
        replaces: 'sha-old',
      }),
    });
    store.resetHistory();

    await importPage(std, model);
    expect(store.hasBlock(cardId)).toBe(false);

    store.undo();
    expect(store.hasBlock(cardId)).toBe(true);
    expect(store.getModelById(held)?.props).toMatchObject({
      sourceId: 'sha-old',
    });
    expect(store.getBlocksByFlavour('affine:attachment')).toHaveLength(1);
  });

  test('a press while the host reads asks nothing more', async () => {
    const { store, noteId } = board();
    const { model } = card(store, noteId);
    let answer: (value: HtmlPageImport) => void = () => undefined;
    const importer = vi.fn(
      () =>
        new Promise<HtmlPageImport>(resolve => {
          answer = resolve;
        })
    );
    const std = stdWith(store, { importPage: importer });

    const first = importPage(std, model);
    await expect(importPage(std, model)).resolves.toBeNull();
    expect(importer).toHaveBeenCalledTimes(1);

    answer({ status: 'cancelled' });
    await first;
  });

  test('a card deleted meanwhile writes nothing', async () => {
    const { store, noteId } = board();
    const { model } = card(store, noteId);
    const std = stdWith(store, {
      importPage: async () => {
        store.deleteBlock(model);
        return { status: 'imported', asset: ASSET };
      },
    });
    await expect(importPage(std, model)).resolves.toBeNull();
    expect(store.getBlocksByFlavour('affine:attachment')).toHaveLength(0);
  });
});

describe('what keeps the card', () => {
  test('a cancellation keeps it and says nothing', async () => {
    const { store, noteId } = board();
    const { model } = card(store, noteId);
    const std = stdWith(store, {
      importPage: async () => ({ status: 'cancelled' }),
    });
    await importPage(std, model);
    expect(store.hasBlock(model.id)).toBe(true);
    expect(toast).not.toHaveBeenCalled();
  });

  test('a refusal keeps it and says the message of the host', async () => {
    const { store, noteId } = board();
    const { model } = card(store, noteId);
    const std = stdWith(store, {
      importPage: async () => ({ status: 'refused', message: 'Illisible' }),
    });
    await importPage(std, model);
    expect(store.hasBlock(model.id)).toBe(true);
    expect(toast).toHaveBeenCalledWith(std.host, 'Illisible');
  });

  test('a host that rejects keeps it and says a sentence of the library', async () => {
    const { store, noteId } = board();
    const { model } = card(store, noteId);
    const std = stdWith(store, {
      importPage: () => Promise.reject(new Error('secret detail')),
    });
    await importPage(std, model);
    expect(store.hasBlock(model.id)).toBe(true);
    expect(toast).toHaveBeenCalledWith(
      std.host,
      'This page could not be imported.'
    );
  });
});
