/**
 * "Plain Text" in the code block's language picker — issue #417, upstream
 * AFFiNE#15492.
 *
 * A code block's `language` is nullable and `null` means no highlighting, but
 * the picker only listed the bundled shiki languages: once a language was
 * picked, nothing in the UI could set it back to `null`. The picker now leads
 * with a Plain Text entry that writes `null`, carries the active mark when the
 * block has no language, and takes part in the recently-used order persisted
 * in localStorage like any other entry. Its list name is a sentinel that never
 * reaches the model.
 */
import type { FilterableListOptions } from '@labre/affine-components/filterable-list';
import {
  type CodeBlockModel,
  CodeBlockSchemaExtension,
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageListButton } from '../code-toolbar/components/lang-button.js';

const shown = vi.hoisted(() => ({
  options: undefined as FilterableListOptions | undefined,
}));

// The popup itself is the filterable list's business (its own spec); here we
// only need the options the button hands it.
vi.mock('@labre/affine-components/filterable-list', () => ({
  showPopFilterableList: ({ options }: { options: FilterableListOptions }) => {
    shown.options = options;
  },
}));

const STORAGE_KEY = 'blocksuite:code-block:lang-list';

let seq = 0;

function aCodeBlock(language: string | null): {
  store: Store;
  model: CodeBlockModel;
} {
  const collection = new TestWorkspace({ id: `code-plain-text-${seq++}` });
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
      { text: new Text('x = 1'), language },
      noteId
    );
  });

  return { store, model: store.getBlock(codeId)!.model as CodeBlockModel };
}

/** Mounts the button on a stubbed block and opens its language list. */
async function openPicker(language: string | null) {
  const { store, model } = aCodeBlock(language);
  const blockComponent = {
    store,
    model,
    // No TranslationProvider, no telemetry: English fallbacks, nothing sent.
    std: { getOptional: () => undefined },
    langs: [
      { id: 'python', name: 'Python', aliases: ['py'] },
      { id: 'javascript', name: 'JavaScript', aliases: ['js'] },
    ],
    languageName$: signal(''),
  };
  const button = document.createElement(
    'test-language-list-button'
  ) as LanguageListButton;
  button.blockComponent = blockComponent as never;
  document.body.append(button);
  await button.updateComplete;

  shown.options = undefined;
  button['_clickLangBtn']();
  const options = shown.options!;
  const item = (name: string) =>
    options.items.find(entry => entry.name === name)!;
  return { button, model, options, item };
}

beforeAll(() => {
  customElements.define('test-language-list-button', LanguageListButton);
});

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

describe('code block language picker, Plain Text', () => {
  it('lists Plain Text first, searchable by plain, text and none', async () => {
    const { options } = await openPicker('python');

    const [first] = options.items;
    expect(first.label).toBe('Plain Text');
    expect(first.aliases).toEqual(
      expect.arrayContaining(['plain', 'text', 'none'])
    );
  });

  it('selecting it sets the language to null', async () => {
    const { model, options } = await openPicker('python');

    options.onSelect(options.items[0]);

    expect(model.props.language).toBeNull();
  });

  it('carries the active mark when the block has no language', async () => {
    const plain = await openPicker(null);
    expect(plain.options.active?.(plain.options.items[0])).toBe(true);
    expect(plain.options.active?.(plain.item('python'))).toBe(false);

    const python = await openPicker('python');
    expect(python.options.active?.(python.options.items[0])).toBe(false);
    expect(python.options.active?.(python.item('python'))).toBe(true);
  });

  it('joins the recently-used order persisted in localStorage', async () => {
    const { button, options, item } = await openPicker('python');
    const plainText = options.items[0];

    options.onSelect(item('javascript'));
    expect(options.items[0].name).toBe('javascript');
    options.onSelect(plainText);
    expect(options.items[0]).toBe(plainText);
    button.remove();

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      name: string;
    }[];
    expect(persisted.map(entry => entry.name)).toEqual([
      plainText.name,
      'javascript',
      'python',
    ]);

    const reopened = await openPicker('python');
    expect(reopened.options.items[0].label).toBe('Plain Text');
  });

  it('adds itself to a list persisted before it existed', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { name: 'javascript', label: 'JavaScript', aliases: ['js'] },
        { name: 'python', label: 'Python', aliases: ['py'] },
      ])
    );

    const { options } = await openPicker('python');

    expect(options.items.map(entry => entry.label)).toEqual([
      'Plain Text',
      'JavaScript',
      'Python',
    ]);
  });
});
