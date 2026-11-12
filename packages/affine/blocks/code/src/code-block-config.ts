import { ConfigExtensionFactory } from '@labre/std';
import type { BundledLanguageInfo, ThemeInput } from 'shiki';

export interface CodeBlockConfig {
  theme?: {
    dark?: ThemeInput;
    light?: ThemeInput;
  };
  langs?: BundledLanguageInfo[];

  /**
   * Whether to show line numbers in the code block.
   * @default true
   */
  showLineNumbers?: boolean;

  /**
   * The regex engine of the highlighter. `oniguruma` is WebAssembly, which a
   * Content-Security-Policy without `'wasm-unsafe-eval'` blocks; `javascript`
   * is shiki's pure-JS engine, loaded only when asked for, which skips the few
   * patterns it cannot run. The canvas viewer of a public page asks for it
   * (ADR 0050).
   * @default 'oniguruma'
   */
  engine?: 'oniguruma' | 'javascript';
}

export const CodeBlockConfigExtension =
  ConfigExtensionFactory<CodeBlockConfig>('affine:code');
