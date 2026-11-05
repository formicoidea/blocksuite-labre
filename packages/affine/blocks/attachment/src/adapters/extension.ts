import type { ExtensionType } from '@labre/store';

import { AttachmentBlockHtmlAdapterExtension } from './html.js';
import { AttachmentBlockMarkdownAdapterExtension } from './markdown.js';
import { AttachmentBlockNotionHtmlAdapterExtension } from './notion-html.js';

export const AttachmentBlockAdapterExtensions: ExtensionType[] = [
  AttachmentBlockHtmlAdapterExtension,
  AttachmentBlockNotionHtmlAdapterExtension,
  AttachmentBlockMarkdownAdapterExtension,
];
