import { SurfaceBlockHtmlAdapterExtension } from './html-adapter/html.js';
import {
  EdgelessSurfaceBlockMarkdownAdapterExtension,
  SurfaceBlockMarkdownAdapterExtension,
} from './markdown/markdown.js';
import {
  EdgelessSurfaceBlockPlainTextAdapterExtension,
  SurfaceBlockPlainTextAdapterExtension,
} from './plain-text/plain-text.js';

export const SurfaceBlockAdapterExtensions = [
  SurfaceBlockPlainTextAdapterExtension,
  SurfaceBlockMarkdownAdapterExtension,
  SurfaceBlockHtmlAdapterExtension,
];

export const EdgelessSurfaceBlockAdapterExtensions = [
  EdgelessSurfaceBlockPlainTextAdapterExtension,
  EdgelessSurfaceBlockMarkdownAdapterExtension,
  SurfaceBlockHtmlAdapterExtension,
];

export * from './markdown/element-adapter/index.js';
export * from './plain-text/element-adapter/index.js';
