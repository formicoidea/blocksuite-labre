/**
 * Clicking "Cancel line number" twice — upstream #14804.
 *
 * The more-menu was rendered once into a portal and never again, so the click
 * handler kept the value it had read at render time. The first click turned
 * line numbers off; every click after that wrote the same value, and the entry
 * looked dead. The handlers now read the current state when they fire.
 */
import {
  CodeBlockSchemaExtension,
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
  type CodeBlockModel,
} from '@labre/affine-model';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, it } from 'vitest';

import { toggleGroup } from '../code-toolbar/config.js';

let seq = 0;

function aCodeBlock(): { store: Store; model: CodeBlockModel } {
  const collection = new TestWorkspace({ id: `code-toggles-${seq++}` });
  collection.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    CodeBlockSchemaExtension,
  ];
  collection.meta.initialize();

  const store = collection.createDoc().getStore();
  let codeId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('') });
    const noteId = store.addBlock('affine:note', {}, rootId);
    codeId = store.addBlock(
      'affine:code',
      { text: new Text('const a = 1;') },
      noteId
    );
  });

  return { store, model: store.getBlock(codeId)!.model as CodeBlockModel };
}

/** The slice of CodeBlockComponent the toggle entries actually touch. */
function stubComponent(store: Store, model: CodeBlockModel) {
  return {
    model,
    store,
    get showLineNumbers() {
      return model.props.lineNumber ?? true;
    },
    setWrap(wrap: boolean) {
      store.updateBlock(model, { wrap });
    },
  };
}

/**
 * The click handler of an entry as the portal holds it: taken from a single
 * render, then fired again and again without the menu ever re-rendering.
 */
function clickHandlerOf(type: string, blockComponent: unknown): () => void {
  const item = toggleGroup.items.find(entry => entry.type === type)!;
  const part = item.generate!({ blockComponent } as never)!;
  const handler = part
    .render!(part as never)
    .values.find(value => typeof value === 'function');
  return handler as () => void;
}

describe('code toolbar toggles, clicked more than once', () => {
  it('turns line numbers off, then on again', () => {
    const { store, model } = aCodeBlock();
    const click = clickHandlerOf('line-number', stubComponent(store, model));

    click();
    expect(model.props.lineNumber).toBe(false);
    click();
    expect(model.props.lineNumber).toBe(true);
    click();
    expect(model.props.lineNumber).toBe(false);
  });

  it('turns wrapping on, then off again', () => {
    const { store, model } = aCodeBlock();
    const click = clickHandlerOf('wrap', stubComponent(store, model));

    click();
    expect(model.props.wrap).toBe(true);
    click();
    expect(model.props.wrap).toBe(false);
  });
});
