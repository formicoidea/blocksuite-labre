/**
 * A grammar load that lands after the language changed — issue #416, upstream
 * AFFiNE#15593.
 *
 * `_updateHighlightTokens` starts a dynamic shiki grammar import when the
 * block's language is not loaded yet, and its `.then` used to write
 * `highlightTokens$` unconditionally. Switching language (or back to plain
 * text) while that import was in flight let the late callback repaint the
 * block with the previous language's tokens. A request counter now drops a
 * stale result, and the highlighter service shares one in-flight load per
 * language so two blocks asking for the same grammar do not import it twice.
 */
import { signal } from '@preact/signals-core';
import type { HighlighterCore, LanguageRegistration, ThemedToken } from 'shiki';
import { describe, expect, it, vi } from 'vitest';

import { CodeBlockComponent } from '../code-block.js';
import { CodeBlockHighlighter } from '../code-block-service.js';

type LangImport = () => Promise<LanguageRegistration[]>;

/**
 * A shiki core whose grammar loads stay pending until the test finishes them,
 * and whose tokens name the language they were computed for.
 */
function aFakeShiki() {
  const loaded = new Set<string>(['javascript']);
  const pending = new Map<LangImport, () => void>();
  const core = {
    getLoadedLanguages: () => [...loaded],
    loadLanguage: vi.fn(
      (input: LangImport) =>
        new Promise<void>(resolve => pending.set(input, resolve))
    ),
    codeToTokensBase: (code: string, options: { lang: string }) => [
      [{ content: code, offset: 0, color: options.lang } as ThemedToken],
    ],
  };
  return {
    core,
    async finish(input: LangImport, id: string) {
      loaded.add(id);
      pending.get(input)?.();
      // Let the block's `.then` run.
      await new Promise(resolve => setTimeout(resolve, 0));
    },
  };
}

const pythonImport: LangImport = () => Promise.resolve([]);
const javascriptImport: LangImport = () => Promise.resolve([]);

const langs = [
  { id: 'python', name: 'Python', import: pythonImport },
  { id: 'javascript', name: 'JavaScript', import: javascriptImport },
];

/** The slice of CodeBlockComponent `_updateHighlightTokens` reads. */
function aCodeBlock(core: ReturnType<typeof aFakeShiki>['core']) {
  const block = {
    model: {
      props: {
        language$: signal<string | null>('python'),
        text: { deltas$: signal([]), toString: () => 'x = 1' },
      },
    },
    langs,
    highlighter: {
      highlighter$: signal(core),
      themeKey: 'test-theme',
      loadLanguage: (_lang: string, input: LangImport) =>
        core.loadLanguage(input),
    },
    highlightTokens$: signal<ThemedToken[][]>([]),
    // The field initializer of the real component; a stub runs none.
    _highlightRequestId: 0,
  };
  const update = () =>
    CodeBlockComponent.prototype['_updateHighlightTokens'].call(block as never);
  const paintedLanguage = () => block.highlightTokens$.value[0]?.[0]?.color;
  return { block, update, paintedLanguage };
}

describe('code block highlighting, grammar loaded late', () => {
  it('a late load does not overwrite the tokens of a newer language', async () => {
    const shiki = aFakeShiki();
    const { block, update, paintedLanguage } = aCodeBlock(shiki.core);

    update(); // python: grammar load pending
    block.model.props.language$.value = 'javascript';
    update(); // javascript: already loaded, painted at once
    expect(paintedLanguage()).toBe('javascript');

    await shiki.finish(pythonImport, 'python');

    expect(paintedLanguage()).toBe('javascript');
  });

  it('a late load does not bring highlighting back after plain text', async () => {
    const shiki = aFakeShiki();
    const { block, update } = aCodeBlock(shiki.core);

    update();
    block.model.props.language$.value = null;
    update();
    expect(block.highlightTokens$.value).toEqual([]);

    await shiki.finish(pythonImport, 'python');

    expect(block.highlightTokens$.value).toEqual([]);
  });

  it('still paints when the load it waited for is the current one', async () => {
    const shiki = aFakeShiki();
    const { update, paintedLanguage } = aCodeBlock(shiki.core);

    update();
    await shiki.finish(pythonImport, 'python');

    expect(paintedLanguage()).toBe('python');
  });
});

describe('code block highlighter, concurrent grammar loads', () => {
  function aHighlighter() {
    const shiki = aFakeShiki();
    const service = new CodeBlockHighlighter({} as never);
    service.highlighter$.value = shiki.core as unknown as HighlighterCore;
    return { service, shiki };
  }

  it('two loads of the same language share one promise', async () => {
    const { service, shiki } = aHighlighter();

    const first = service.loadLanguage('python', pythonImport);
    const second = service.loadLanguage('python', pythonImport);

    expect(second).toBe(first);
    expect(shiki.core.loadLanguage).toHaveBeenCalledTimes(1);

    await shiki.finish(pythonImport, 'python');
    await first;
  });

  it('forgets a failed load so the next request tries again', async () => {
    const { service, shiki } = aHighlighter();
    shiki.core.loadLanguage.mockImplementationOnce(() =>
      Promise.reject(new Error('network down'))
    );

    await expect(service.loadLanguage('python', pythonImport)).rejects.toThrow(
      'network down'
    );

    const retry = service.loadLanguage('python', pythonImport);
    expect(shiki.core.loadLanguage).toHaveBeenCalledTimes(2);
    await shiki.finish(pythonImport, 'python');
    await retry;
  });
});
