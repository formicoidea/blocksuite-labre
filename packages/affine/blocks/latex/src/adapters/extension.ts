import type { ExtensionType } from '@labre/store';

import { LatexBlockHtmlAdapterExtension } from './html.js';
import { LatexMarkdownAdapterExtensions } from './markdown/index.js';
import { LatexBlockNotionHtmlAdapterExtension } from './notion-html.js';
import { LatexBlockPlainTextAdapterExtension } from './plain-text.js';

export const LatexBlockAdapterExtensions: ExtensionType[] = [
  LatexBlockHtmlAdapterExtension,
  LatexMarkdownAdapterExtensions,
  LatexBlockNotionHtmlAdapterExtension,
  LatexBlockPlainTextAdapterExtension,
].flat();
