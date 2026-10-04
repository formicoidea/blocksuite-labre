import { ColorScheme } from '@labre/affine-model';
import { ThemeProvider } from '@labre/affine-shared/services';
import { LifeCycleWatcher } from '@labre/std';
import { type Signal, signal } from '@preact/signals-core';
import {
  createHighlighterCore,
  createOnigurumaEngine,
  type HighlighterCore,
  type MaybeGetter,
} from 'shiki';
import getWasm from 'shiki/wasm';

import { CodeBlockConfigExtension } from './code-block-config.js';
import {
  CODE_BLOCK_DEFAULT_DARK_THEME,
  CODE_BLOCK_DEFAULT_LIGHT_THEME,
} from './highlight/const.js';

export class CodeBlockHighlighter extends LifeCycleWatcher {
  static override key = 'code-block-highlighter';

  private _darkThemeKey: string | undefined;

  private _lightThemeKey: string | undefined;

  highlighter$: Signal<HighlighterCore | null> = signal(null);

  /**
   * In-flight grammar loads, one per language. Per instance rather than
   * static: each editor owns its own shiki core, and a grammar loaded into
   * another editor's core is not loaded into this one.
   */
  private readonly _languageLoads = new Map<string, Promise<void>>();

  get themeKey() {
    const theme = this.std.get(ThemeProvider).theme$.value;
    return theme === ColorScheme.Dark
      ? this._darkThemeKey
      : this._lightThemeKey;
  }

  private readonly _loadTheme = async (
    highlighter: HighlighterCore
  ): Promise<void> => {
    const config = this.std.getOptional(CodeBlockConfigExtension.identifier);
    const darkTheme = config?.theme?.dark ?? CODE_BLOCK_DEFAULT_DARK_THEME;
    const lightTheme = config?.theme?.light ?? CODE_BLOCK_DEFAULT_LIGHT_THEME;
    this._darkThemeKey = (await normalizeGetter(darkTheme)).name;
    this._lightThemeKey = (await normalizeGetter(lightTheme)).name;
    await highlighter.loadTheme(darkTheme, lightTheme);
    this.highlighter$.value = highlighter;
  };

  /**
   * Loads a grammar into the shiki core, sharing the pending promise between
   * concurrent callers (every code block of that language asks at once on
   * first paint). A settled load leaves the map, so a failed one is retried
   * on the next request.
   */
  loadLanguage(
    lang: string,
    input: Parameters<HighlighterCore['loadLanguage']>[0]
  ): Promise<void> {
    const pending = this._languageLoads.get(lang);
    if (pending) return pending;

    const highlighter = this.highlighter$.peek();
    if (!highlighter) {
      return Promise.reject(new Error('Code block highlighter is not ready'));
    }

    const load = highlighter.loadLanguage(input).finally(() => {
      this._languageLoads.delete(lang);
    });
    this._languageLoads.set(lang, load);
    return load;
  }

  override mounted(): void {
    super.mounted();

    createHighlighterCore({
      engine: createOnigurumaEngine(() => getWasm),
    })
      .then(this._loadTheme)
      .catch(console.error);
  }

  override unmounted(): void {
    this.highlighter$.value?.dispose();
  }
}

/**
 * https://github.com/shikijs/shiki/blob/933415cdc154fe74ccfb6bbb3eb6a7b7bf183e60/packages/core/src/internal.ts#L31
 */
export async function normalizeGetter<T>(p: MaybeGetter<T>): Promise<T> {
  return Promise.resolve(typeof p === 'function' ? (p as any)() : p).then(
    r => r.default || r
  );
}
