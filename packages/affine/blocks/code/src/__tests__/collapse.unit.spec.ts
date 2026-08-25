/**
 * Collapsing a code block — upstream #14884.
 *
 * A long snippet used to push everything below it off the screen with no way
 * to fold it. The toolbar now carries a collapse toggle, and the fold has to
 * survive a reload: it is stored on the block, not in the component.
 */
import {
  CodeBlockSchemaExtension,
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
  type CodeBlockModel,
} from '@labre/affine-model';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { computed } from '@preact/signals-core';
import { describe, expect, it } from 'vitest';

import { PRIMARY_GROUPS } from '../code-toolbar/config.js';

let seq = 0;

function aCodeBlock(): { store: Store; model: CodeBlockModel } {
  const collection = new TestWorkspace({ id: `code-collapse-${seq++}` });
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

/** The slice of CodeBlockComponent the toolbar item actually touches. */
function stubComponent(store: Store, model: CodeBlockModel) {
  return {
    model,
    store,
    collapsed$: computed(() => !!model.props.collapsed$.value),
    setCollapsed(collapsed: boolean) {
      store.updateBlock(model, { collapsed });
    },
  };
}

const collapseItem = PRIMARY_GROUPS.flatMap(group => group.items).find(
  item => item.type === 'collapse'
)!;

describe('code block collapse', () => {
  it('leaves a freshly created block unfolded', () => {
    const { model } = aCodeBlock();
    expect(model.props.collapsed).toBeUndefined();
  });

  it('offers the toggle in the toolbar', () => {
    expect(collapseItem).toBeDefined();
    expect(collapseItem.when?.({ doc: { readonly: false } } as never)).toBe(
      true
    );
    expect(collapseItem.when?.({ doc: { readonly: true } } as never)).toBe(
      false
    );
  });

  it('writes the fold onto the model, so it survives a reload', () => {
    const { store, model } = aCodeBlock();
    const blockComponent = stubComponent(store, model);

    const part = collapseItem.generate!({ blockComponent } as never)!;
    part.action();
    expect(model.props.collapsed).toBe(true);

    part.action();
    expect(model.props.collapsed).toBe(false);
  });

  it('renames itself once the block is folded', () => {
    const { store, model } = aCodeBlock();
    const blockComponent = stubComponent(store, model);

    const part = collapseItem.generate!({ blockComponent } as never)!;
    expect(part.render!(part as never).values).toContain('Collapse code');

    part.action();
    expect(part.render!(part as never).values).toContain('Expand code');
  });
});
