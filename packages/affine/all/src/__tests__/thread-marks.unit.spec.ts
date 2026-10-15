/**
 * GUARD — the "has a thread" seam is assembled, and reads real documents
 * without writing them (ADR 0038).
 *
 * ## What it would have caught
 *
 * - The view extension left out of one scope: no mark or no "Discuss" in the
 *   page view, or on the canvas.
 * - "Discuss" registered under a bare wildcard key: `affine:surface:*` is the
 *   root's built-in canvas module, and a second module there is a
 *   `DuplicateServiceDefinitionError` that stops every editor from opening.
 * - An excerpt that reads a block's id, the canvas note's kind instead of its
 *   text, or a shape's type instead of its label.
 * - Any write to the Y.Doc while computing an excerpt (the seam stores
 *   nothing: labre ADR-0048 §10).
 */
import type { SurfaceBlockModel } from '@labre/affine-block-surface';
import {
  StoreExtensionManager,
  ViewExtensionManager,
} from '@labre/affine-ext-loader';
import {
  ToolbarModuleIdentifier,
  toolbarModuleKey,
} from '@labre/affine-shared/services';
import { Container } from '@labre/global/di';
import { type BlockStdScope, WidgetViewIdentifier } from '@labre/std';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import * as Y from 'yjs';
import { describe, expect, test } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';
import { getInternalViewExtensions } from '../extensions/view.js';
import { threadExcerpt } from '../host-panels.js';

function mount(scope: 'page' | 'edgeless') {
  const manager = new ViewExtensionManager(getInternalViewExtensions({}));
  const container = new Container();
  for (const extension of manager.get(scope)) extension.setup(container);
  return container.provider();
}

function createDoc() {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id: 'thread-marks' });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();
  const store = collection
    .createDoc('thread-marks')
    .getStore({ id: 'thread-marks' });
  const ids = {} as Record<
    'note' | 'first' | 'second' | 'frame' | 'empty' | 'surface',
    string
  >;
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('Plan') });
    ids.surface = store.addBlock('affine:surface', {}, rootId);
    ids.note = store.addBlock('affine:note', {}, rootId);
    ids.first = store.addBlock(
      'affine:paragraph',
      { text: new Text('Pick a   vendor') },
      ids.note
    );
    ids.second = store.addBlock(
      'affine:paragraph',
      { text: new Text('before Q3') },
      ids.note
    );
    ids.empty = store.addBlock('affine:divider', {}, ids.note);
    ids.frame = store.addBlock(
      'affine:frame',
      { title: new Text('Roadmap'), xywh: '[0,0,100,100]' },
      ids.surface
    );
  });
  const surface = store.getBlock(ids.surface)!.model as SurfaceBlockModel;
  const std = {
    store,
    provider: mount('edgeless'),
    getOptional: () => null,
  } as unknown as BlockStdScope;
  return { store, surface, std, ids };
}

describe('the thread-marks seam is assembled', () => {
  test.each(['page', 'edgeless'] as const)(
    'the marks widget and "Discuss" are registered (%s)',
    scope => {
      const provider = mount(scope);
      expect(
        provider
          .getAll(WidgetViewIdentifier)
          .has('affine:page|affine-thread-marks-widget')
      ).toBe(true);
      const variants = [...provider.getAll(ToolbarModuleIdentifier).keys()];
      expect(variants).toContain(toolbarModuleKey('affine:*', 'thread'));
      expect(variants).toContain(
        toolbarModuleKey('affine:surface:*', 'thread')
      );
    }
  );
});

describe('the excerpt handed to openThread', () => {
  test('a block reads its own text, whitespace collapsed', () => {
    const { std, ids } = createDoc();
    expect(
      threadExcerpt(std, { targetType: 'block', targetId: ids.first })
    ).toBe('Pick a vendor');
  });

  test('a canvas note reads its paragraphs, not its kind', () => {
    const { std, ids } = createDoc();
    expect(
      threadExcerpt(std, { targetType: 'block', targetId: ids.note })
    ).toBe('Pick a vendor before Q3');
  });

  test('a frame reads its title; a textless block its kind', () => {
    const { std, ids } = createDoc();
    expect(
      threadExcerpt(std, { targetType: 'block', targetId: ids.frame })
    ).toBe('Roadmap');
    expect(
      threadExcerpt(std, { targetType: 'block', targetId: ids.empty })
    ).not.toBe('');
  });

  test('an element reads its label; an unknown id reads nothing', () => {
    const { std, surface } = createDoc();
    const shape = surface.addElement({
      type: 'shape',
      xywh: '[10,20,100,50]',
      text: new Y.Text('Vendor A'),
    });
    expect(threadExcerpt(std, { targetType: 'element', targetId: shape })).toBe(
      'Vendor A'
    );
    expect(
      threadExcerpt(std, { targetType: 'element', targetId: 'missing' })
    ).toBe('');
    expect(
      threadExcerpt(std, { targetType: 'block', targetId: 'missing' })
    ).toBe('');
  });

  test('a long block is cut to 280 characters', () => {
    const { std, store, ids } = createDoc();
    const long = store.addBlock(
      'affine:paragraph',
      { text: new Text('lorem ipsum '.repeat(100)) },
      ids.note
    );
    const excerpt = threadExcerpt(std, { targetType: 'block', targetId: long });
    expect(Array.from(excerpt)).toHaveLength(280);
    expect(excerpt.endsWith('…')).toBe(true);
  });

  test('reading an excerpt writes nothing to the document', () => {
    const { std, store, surface, ids } = createDoc();
    const shape = surface.addElement({
      type: 'shape',
      xywh: '[10,20,100,50]',
      text: new Y.Text('Vendor A'),
    });
    const before = Y.encodeStateVector(store.doc.spaceDoc);
    for (const targetId of [ids.first, ids.note, ids.frame, ids.empty]) {
      threadExcerpt(std, { targetType: 'block', targetId });
    }
    threadExcerpt(std, { targetType: 'element', targetId: shape });
    expect(Y.encodeStateVector(store.doc.spaceDoc)).toEqual(before);
  });
});
