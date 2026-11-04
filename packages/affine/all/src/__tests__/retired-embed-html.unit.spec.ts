/**
 * GUARD: the `affine:embed-html` block is retired, and a stored one stays readable
 * (ADR 0048, amendment of 2026-11-04).
 *
 * What it would have caught:
 * - dropping the schema with the block. The test at the top measures what an unknown
 *   flavour does: `new Block` throws, the store's `_onBlockAdded` catches it and logs,
 *   and the block is gone from the page with no word to the reader, while the rest of
 *   the document stays. So the reason the schema stays is checked, not remembered;
 * - a clipboard config coming back for this flavour on the canvas, which is the path
 *   a paste or a duplicate uses to write a new block.
 */
import { EdgelessClipboardConfigIdentifier } from '@labre/affine-block-surface';
import {
  StoreExtensionManager,
  ViewExtensionManager,
} from '@labre/affine-ext-loader';
import {
  EmbedHtmlBlockSchema,
  EmbedHtmlBlockSchemaExtension,
} from '@labre/affine-model';
import { Container } from '@labre/global/di';
import { type BlockStdScope, StdIdentifier } from '@labre/std';
import { type ExtensionType, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { getInternalStoreExtensions } from '../extensions/store.js';
import { getInternalViewExtensions } from '../extensions/view.js';

let seq = 0;

function createStore(extensions: ExtensionType[]) {
  const id = `retired-html-${seq++}`;
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = extensions;
  collection.meta.initialize();
  return collection.createDoc(id).getStore({ id });
}

const allStoreExtensions = () =>
  new StoreExtensionManager(getInternalStoreExtensions({})).get('store');

function storeWithBlock() {
  const store = createStore(allStoreExtensions());
  let blockId = '';
  store.load(() => {
    const root = store.addBlock('affine:page', { title: new Text('t') });
    const note = store.addBlock('affine:note', {}, root);
    blockId = store.addBlock(
      'affine:embed-html',
      { html: '<script>window.ran = 1</script>', style: 'html' },
      note
    );
  });
  return { store, blockId };
}

describe('a stored affine:embed-html block', () => {
  test('without its schema the block vanishes in silence, which is why the schema stays', () => {
    const { store, blockId } = storeWithBlock();
    const bytes = Y.encodeStateAsUpdate(store.spaceDoc);

    const flavour = EmbedHtmlBlockSchema.model.flavour;
    const unknown = allStoreExtensions().filter(
      extension => extension !== EmbedHtmlBlockSchemaExtension
    );
    const reader = createStore(unknown);
    expect(reader.schema.flavourSchemaMap.has(flavour)).toBe(false);

    const logged = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    reader.load(() => {
      Y.applyUpdate(reader.spaceDoc, bytes);
    });
    const message = logged.mock.calls.flat().map(String).join(' ');
    logged.mockRestore();

    expect(message).toContain('schema for flavour');
    expect(reader.getBlock(blockId)).toBeFalsy();
    expect(reader.getModelsByFlavour('affine:note')).toHaveLength(1);
    expect(reader.getModelsByFlavour('affine:note')[0]?.children).toHaveLength(
      0
    );
  });

  test('with the schema it loads, and its html stays in the document', () => {
    const { store, blockId } = storeWithBlock();
    const model = store.getModelById(blockId);
    expect(model?.flavour).toBe('affine:embed-html');
    expect((model?.props as { html?: string }).html).toContain('<script>');
  });

  test('a paste or a duplicate on the canvas has no way to write a new one', () => {
    const manager = new ViewExtensionManager(getInternalViewExtensions({}));
    const container = new Container();
    manager.get('edgeless').forEach(extension => extension.setup(container));
    container.addImpl(StdIdentifier, () => ({}) as BlockStdScope);
    const provider = container.provider();

    expect(
      provider.getOptional(
        EdgelessClipboardConfigIdentifier('affine:embed-html')
      )
    ).toBeFalsy();
    expect(
      provider.getOptional(EdgelessClipboardConfigIdentifier('affine:bookmark'))
    ).toBeTruthy();
  });
});
