import { SurfaceBlockSchemaExtension } from '@labre/affine-block-surface';
import {
  CalloutBlockSchemaExtension,
  EmbedLinkedDocBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { LINKED_DOC_NOTE_STYLE } from '@labre/affine-shared/consts';
import type { BlockStdScope } from '@labre/std';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, it } from 'vitest';

import { createDocFromSlash } from '../embed-linked-doc-block/configs/new-doc';
import { placePageCard } from '../page-drop/page-drop';

/**
 * The default view of a page's card in a note is the line (labre recette 3
 * P2-7b, ADR-0045 amended 2026-10-27): a child page created by the slash
 * menu's "New Page" or dropped from the host's sidebar arrives as a one-line
 * card (`style: 'list'`, "Small horizontal style"), after the text, instead of
 * the large horizontal card of the model's default.
 *
 * What it would have caught: a creation site writing no style (the model's
 * `horizontal` default then fills it on load), or a site drifting from the
 * shared `LINKED_DOC_NOTE_STYLE`. The default itself is never changed in the
 * model: every stored card already carries `horizontal` (a red zone).
 */

let seq = 0;

function pageStore() {
  const workspace = new TestWorkspace({ id: `card-line-style-${seq++}` });
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
  let line = '';
  store.load(() => {
    const root = store.addBlock('affine:page', { title: new Text('') });
    store.addBlock('affine:surface', {}, root);
    const note = store.addBlock('affine:note', {}, root);
    line = store.addBlock('affine:paragraph', { text: new Text('a') }, note);
  });
  return { store, line };
}

function stdFor(store: Store) {
  return {
    store,
    host: { store },
    getOptional: () => null,
  } as unknown as BlockStdScope;
}

function styles(store: Store) {
  return store
    .getModelsByFlavour('affine:embed-linked-doc')
    .map(card => (card.props as { style: string }).style);
}

describe('a page card placed in a note', () => {
  it('is a line', () => {
    expect(LINKED_DOC_NOTE_STYLE).toBe('list');
  });

  it('is a line from the slash menu "New Page"', () => {
    const { store, line } = pageStore();
    const anchor = store.getBlock(line)?.model;
    if (!anchor) throw new Error('no line');
    createDocFromSlash(stdFor(store), anchor);
    expect(styles(store)).toEqual(['list']);
  });

  it('is a line when dropped beside a block or under the content', () => {
    const { store, line } = pageStore();
    const model = store.getBlock(line)?.model;
    if (!model) throw new Error('no line');
    placePageCard(stdFor(store), 'beside', {
      canvas: false,
      line: { model, placement: 'after' },
      point: [0, 0],
    });
    placePageCard(stdFor(store), 'at-end', {
      canvas: false,
      line: null,
      point: [0, 0],
    });
    expect(styles(store)).toEqual(['list', 'list']);
  });
});
