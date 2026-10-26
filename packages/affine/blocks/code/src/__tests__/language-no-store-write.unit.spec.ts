/**
 * The code block's language is resolved for display, never written back.
 *
 * `_updateHighlightTokens`, the render effect, used to normalise a stored
 * name or alias to its shiki id (`'TypeScript'` → `'typescript'`) and to set an
 * unknown language to `null`, through the props proxy and without any
 * `store.readonly` check. Every mount of such a block wrote to the document:
 * on a readonly store, from every peer that rendered it, and as an undo entry
 * nobody made. The HTML importers fed it with `'Plain Text'`, which no shiki
 * language matches, so every imported plain block was rewritten on first open.
 *
 * The language is now derived (`resolveCodeLanguage`), the stored value stays
 * what was written, and the picker writes through `captureSync` +
 * `updateBlock`, which refuses a readonly store and is one undo step.
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
import type { BundledLanguageInfo, ThemedToken } from 'shiki';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CodeBlockComponent, resolveCodeLanguage } from '../code-block.js';
import { LanguageListButton } from '../code-toolbar/components/lang-button.js';

const shown = vi.hoisted(() => ({
  options: undefined as FilterableListOptions | undefined,
}));

vi.mock('@labre/affine-components/filterable-list', () => ({
  showPopFilterableList: ({ options }: { options: FilterableListOptions }) => {
    shown.options = options;
  },
}));

const noImport = () => Promise.resolve({ default: [] });

const langs: BundledLanguageInfo[] = [
  {
    id: 'typescript',
    name: 'TypeScript',
    aliases: ['ts'],
    import: noImport,
  },
  { id: 'python', name: 'Python', aliases: ['py'], import: noImport },
];

let seq = 0;

function aCodeBlock(language: string | null): {
  store: Store;
  model: CodeBlockModel;
  writes: () => number;
} {
  const collection = new TestWorkspace({ id: `code-no-write-${seq++}` });
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
      { text: new Text('const x = 1'), language },
      noteId
    );
  });

  let count = 0;
  store.spaceDoc.on('update', () => count++);
  return {
    store,
    model: store.getBlock(codeId)!.model as CodeBlockModel,
    writes: () => count,
  };
}

/**
 * The render effect on a real model, with a fake shiki whose tokens name the
 * language they were computed for. A full mount needs an editor host; the
 * effect is the whole render path that touched the store.
 */
function highlight(model: CodeBlockModel) {
  const core = {
    getLoadedLanguages: () => ['typescript', 'python'],
    codeToTokensBase: (code: string, options: { lang: string }) => [
      [{ content: code, offset: 0, color: options.lang } as ThemedToken],
    ],
  };
  const block = {
    model,
    langs,
    highlighter: {
      highlighter$: signal(core),
      themeKey: 'test-theme',
      loadLanguage: () => Promise.resolve(),
    },
    highlightTokens$: signal<ThemedToken[][]>([]),
    _highlightRequestId: 0,
  };
  CodeBlockComponent.prototype['_updateHighlightTokens'].call(block as never);
  return block.highlightTokens$.value[0]?.[0]?.color;
}

beforeAll(() => {
  customElements.define('test-lang-button-no-write', LanguageListButton);
});

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

describe('code block render path, no store write', () => {
  it('highlights a language stored by name on a readonly store without writing', () => {
    const { store, model, writes } = aCodeBlock('TypeScript');
    store.readonly = true;

    expect(highlight(model)).toBe('typescript');
    expect(model.props.language).toBe('TypeScript');
    expect(writes()).toBe(0);
  });

  it('leaves an alias and an unknown language as stored, writeable store included', () => {
    const alias = aCodeBlock('ts');
    expect(highlight(alias.model)).toBe('typescript');
    expect(alias.model.props.language).toBe('ts');
    expect(alias.writes()).toBe(0);

    const unknown = aCodeBlock('Plain Text');
    expect(highlight(unknown.model)).toBeUndefined();
    expect(unknown.model.props.language).toBe('Plain Text');
    expect(unknown.writes()).toBe(0);
    expect(unknown.store.canUndo).toBe(false);
  });

  it('resolves on id, name and alias; null and unknown are plain text', () => {
    expect(resolveCodeLanguage('typescript', langs)?.id).toBe('typescript');
    expect(resolveCodeLanguage('TypeScript', langs)?.id).toBe('typescript');
    expect(resolveCodeLanguage('ts', langs)?.id).toBe('typescript');
    expect(resolveCodeLanguage(null, langs)).toBeUndefined();
    expect(resolveCodeLanguage('Plain Text', langs)).toBeUndefined();
  });
});

describe('code block language picker, store writes', () => {
  async function openPicker(language: string | null) {
    const fixture = aCodeBlock(language);
    const button = document.createElement(
      'test-lang-button-no-write'
    ) as LanguageListButton;
    button.blockComponent = {
      store: fixture.store,
      model: fixture.model,
      std: { getOptional: () => undefined },
      langs,
      languageName$: signal(''),
    } as never;
    document.body.append(button);
    await button.updateComplete;

    shown.options = undefined;
    button['_clickLangBtn']();
    const options = shown.options!;
    const item = (name: string) =>
      options.items.find(entry => entry.name === name)!;
    return { ...fixture, options, item };
  }

  it('does not modify a store that turned readonly while the list was open', async () => {
    const { store, model, options, item, writes } = await openPicker('python');
    store.readonly = true;

    options.onSelect(item('typescript'));

    expect(model.props.language).toBe('python');
    expect(writes()).toBe(0);
  });

  it('a pick is one undo step', async () => {
    const { store, model, options, item } = await openPicker('python');

    options.onSelect(item('typescript'));
    expect(model.props.language).toBe('typescript');

    store.undo();
    expect(model.props.language).toBe('python');
  });

  it('marks the entry of a language stored by name', async () => {
    const { options, item } = await openPicker('TypeScript');

    expect(options.active?.(item('typescript'))).toBe(true);
  });
});
