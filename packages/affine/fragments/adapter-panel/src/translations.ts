import {
  type ChromeWording,
  FORMAT_HTML,
  FORMAT_MARKDOWN,
  PREVIEW_LABEL,
} from '@labre/affine-shared/services';

/**
 * The adapter (debug export) panel's own wordings: the source/preview toggle
 * on its HTML tab, and two of the four format names its selector lists —
 * "Markdown" and "HTML" are shared with the "@" menu's import dialog
 * (`FORMAT_MARKDOWN` / `FORMAT_HTML`, `chrome.ts`) rather than restated here.
 *
 * Declared here rather than restated at the call site so the manifest
 * (`@labre/affine/translations`, `PACKAGE_WORDINGS`) can walk them — see
 * `packages/affine/shared/src/services/translation-service/README.md`.
 */
export const ADAPTER_PANEL_SOURCE: ChromeWording = [
  'com.labre.adapter-panel.html.source',
  'Source',
];

export const ADAPTER_PANEL_PREVIEW = PREVIEW_LABEL;

export const ADAPTER_FORMAT_MARKDOWN = FORMAT_MARKDOWN;

export const ADAPTER_FORMAT_PLAINTEXT: ChromeWording = [
  'com.labre.adapter-panel.format.plaintext',
  'PlainText',
];

export const ADAPTER_FORMAT_HTML = FORMAT_HTML;

export const ADAPTER_FORMAT_SNAPSHOT: ChromeWording = [
  'com.labre.adapter-panel.format.snapshot',
  'Snapshot',
];

/**
 * Every wording this package declares, in the order it renders them —
 * `ADAPTER_FORMAT_MARKDOWN` / `ADAPTER_FORMAT_HTML` excluded: they are
 * `CHROME_WORDINGS` entries under their own name, and listing them again
 * here would offer a host the same key twice.
 */
export const ADAPTER_PANEL_WORDINGS: readonly ChromeWording[] = [
  ADAPTER_PANEL_SOURCE,
  ADAPTER_FORMAT_PLAINTEXT,
  ADAPTER_FORMAT_SNAPSHOT,
];
