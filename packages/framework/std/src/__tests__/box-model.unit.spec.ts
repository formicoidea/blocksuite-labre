/**
 * GUARD — the library draws in the border box without a host reset.
 *
 * What it would have caught (labre recette of 2.1, 2026-10-30): the library
 * was only ever drawn under the playground's `* { box-sizing: border-box }`;
 * labre has no such reset, so widths that count their padding ran past their
 * parents (a full page's root by its gutters, a menu's field by 5px).
 * `EditorHost` now sets the border box on itself and everything inside it;
 * the test page has no global reset, as labre.
 */
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test } from 'vitest';

import { effects } from '../effects.js';
import { TestEditorContainer } from './test-editor.js';
import {
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
} from './test-schema.js';
import { testSpecs } from './test-spec.js';

effects();

describe('the editor host', () => {
  test('sizes every element inside it in the border box', async () => {
    const collection = new TestWorkspace({
      id: 'box-model',
      idGenerator: createAutoIncrementIdGenerator(),
    });
    collection.meta.initialize();
    const doc = collection.createDoc('home');
    const store = doc.getStore({
      extensions: [RootBlockSchemaExtension, NoteBlockSchemaExtension],
    });
    doc.load();
    store.addBlock('test:page');

    const container = new TestEditorContainer();
    container.doc = store;
    container.specs = testSpecs;
    document.body.append(container);
    await new Promise(resolve => setTimeout(resolve, 50));

    const host = container.querySelector('editor-host');
    expect(host).not.toBeNull();
    const probe = document.createElement('div');
    probe.style.cssText = 'width: 100px; padding: 10px; border: 1px solid;';
    host!.append(probe);
    expect(getComputedStyle(probe).boxSizing).toBe('border-box');
    expect(probe.getBoundingClientRect().width).toBe(100);

    // Outside the editor the host's own rules apply.
    const outside = document.createElement('div');
    outside.style.cssText = 'width: 100px; padding: 10px;';
    document.body.append(outside);
    expect(outside.getBoundingClientRect().width).toBe(120);

    probe.remove();
    outside.remove();
    container.remove();
  });
});
