import {
  ACTION_CANCEL,
  ACTION_CONFIRM,
  type ChromeWording,
  TOOLBAR_CREATE_LINKED_DOC_TITLE,
  TOOLBAR_EDIT,
  TOOLBAR_SETTINGS,
} from '@labre/affine-shared/services';

/**
 * The confirm/cancel pair of the two prompts this package renders — the
 * "create a linked doc" title prompt (`common/render-linked-doc.ts`) and the
 * generic-embed link popup's own confirm button
 * (`embed-iframe-block/components/embed-iframe-link-input-popup.ts`). Both
 * read the exact same two words, so one pair serves both. L7 dedupe: the
 * exact same two words `@labre/affine-components`'s own modals use, so both
 * now alias the shared `chrome.ts` wording.
 */
export const EMBED_CONFIRM = ACTION_CONFIRM;

export const EMBED_CANCEL = ACTION_CANCEL;

/* ── "Create a linked doc" prompt (`common/render-linked-doc.ts`) ────────── */

export const EMBED_PROMPT_TITLE_MESSAGE: ChromeWording = [
  'com.labre.embed.prompt.title-message',
  'Enter a title for the new doc.',
];

export const EMBED_DOC_CREATED_UNDO_MESSAGE: ChromeWording = [
  'com.labre.embed.toast.undo-message',
  'You can click undo to recovery block content',
];

/* ── The HTML embed (`embed-html-block/`) ─────────────────────────────── */

export const EMBED_HTML_EMPTY: ChromeWording = [
  'com.labre.embed.html.empty',
  'Empty',
];

export const EMBED_HTML_SETTINGS_HEADER = TOOLBAR_SETTINGS;

/* ── The generic iframe embed (`embed-iframe-block/`) ─────────────────── */

export const EMBED_IFRAME_SLASH_NAME: ChromeWording = [
  'com.labre.embed.iframe.slash.name',
  'Embed',
];

export const EMBED_IFRAME_SLASH_DESCRIPTION: ChromeWording = [
  'com.labre.embed.iframe.slash.description',
  'For Google Drive, and more.',
];

export const EMBED_IFRAME_ERROR_TITLE: ChromeWording = [
  'com.labre.embed.iframe.error.title',
  'This link couldn’t be loaded.',
];

export const EMBED_IFRAME_ERROR_EDIT = TOOLBAR_EDIT;

/* ── The error card's own sentence (#390) ─────────────────────────────────
 *
 * The card used to render `error.message` raw — a developer sentence thrown
 * by `refreshData`, drawn under a translated title. An `EmbedIframeError`
 * carries a `messageKey` instead (the `InterchangeImportError` pattern,
 * `blocks/surface/src/extensions/interchange.ts`), and the card resolves the
 * key or this fallback, never the raw `message`.
 */

export const EMBED_IFRAME_ERROR_NO_DATA: ChromeWording = [
  'com.labre.embed.iframe.error.no-embed-data',
  'Failed to get embed data',
];

export const EMBED_IFRAME_ERROR_INVALID_URL: ChromeWording = [
  'com.labre.embed.iframe.error.invalid-url',
  'Invalid iframe URL',
];

/**
 * What the card says for any error that declares no key of its own —
 * including the DI wiring failure ("EmbedIframeService or LinkPreviewService
 * not found"), which is never a user-facing fact and stays in the console.
 */
export const EMBED_IFRAME_ERROR_FALLBACK: ChromeWording = [
  'com.labre.embed.iframe.error.message',
  'Failed to load embedded content',
];

export const EMBED_IFRAME_IDLE_TEXT: ChromeWording = [
  'com.labre.embed.iframe.idle.text',
  'Embed anything (Google Drive, Google Docs, Spotify, Miro…)',
];

export const EMBED_IFRAME_INVALID_URL_TITLE: ChromeWording = [
  'com.labre.embed.iframe.invalid-url.title',
  'Invalid URL',
];

export const EMBED_IFRAME_INVALID_URL_MESSAGE: ChromeWording = [
  'com.labre.embed.iframe.invalid-url.message',
  'Please enter a valid URL',
];

export const EMBED_IFRAME_CREATION_ERROR_TITLE: ChromeWording = [
  'com.labre.embed.iframe.creation-error.title',
  'Error in embed iframe creation',
];

export const EMBED_IFRAME_CREATION_ERROR_FALLBACK: ChromeWording = [
  'com.labre.embed.iframe.creation-error.fallback',
  'Please try again',
];

export const EMBED_IFRAME_LINK_POPUP_TITLE: ChromeWording = [
  'com.labre.embed.iframe.link-popup.title',
  'Embed Link',
];

export const EMBED_IFRAME_LINK_POPUP_DESCRIPTION: ChromeWording = [
  'com.labre.embed.iframe.link-popup.description',
  'Works with links of Google Drive, Spotify…',
];

export const EMBED_IFRAME_LINK_POPUP_PLACEHOLDER: ChromeWording = [
  'com.labre.embed.iframe.link-popup.placeholder',
  'Paste the Embed link...',
];

export const EMBED_IFRAME_TOOLBAR_ORIGINAL: ChromeWording = [
  'com.labre.embed.iframe.toolbar.original',
  'Original',
];

/**
 * An alias (L7 dedupe): the same Title Case word as
 * {@link TOOLBAR_CREATE_LINKED_DOC_TITLE}, distinct from the sentence-case
 * `TOOLBAR_CREATE_LINKED_DOC` chrome wording ("Create linked doc").
 */
export const EMBED_IFRAME_TOOLBAR_CREATE_LINKED_DOC =
  TOOLBAR_CREATE_LINKED_DOC_TITLE;

/** The "no link" notification's message (`embed-iframe-block.ts`). */
export const EMBED_IFRAME_NO_LINK_MESSAGE: ChromeWording = [
  'com.labre.embed.iframe.no-link-message',
  'Please set a link to the block',
];

/**
 * This package's contribution to the translation-key manifest, listed in
 * `PACKAGE_WORDINGS` under source `chrome`
 * (`packages/affine/all/src/translations.ts`). The shared verbs it reuses
 * (Caption, Reload, Loading…, Settings, the card-style switcher's four
 * wordings…) travel with `@labre/affine-shared/services` instead, so they
 * are not restated here.
 */
export const EMBED_WORDINGS: readonly ChromeWording[] = [
  EMBED_PROMPT_TITLE_MESSAGE,
  EMBED_DOC_CREATED_UNDO_MESSAGE,
  EMBED_HTML_EMPTY,
  EMBED_IFRAME_SLASH_NAME,
  EMBED_IFRAME_SLASH_DESCRIPTION,
  EMBED_IFRAME_ERROR_TITLE,
  EMBED_IFRAME_ERROR_NO_DATA,
  EMBED_IFRAME_ERROR_INVALID_URL,
  EMBED_IFRAME_ERROR_FALLBACK,
  EMBED_IFRAME_IDLE_TEXT,
  EMBED_IFRAME_INVALID_URL_TITLE,
  EMBED_IFRAME_INVALID_URL_MESSAGE,
  EMBED_IFRAME_CREATION_ERROR_TITLE,
  EMBED_IFRAME_CREATION_ERROR_FALLBACK,
  EMBED_IFRAME_LINK_POPUP_TITLE,
  EMBED_IFRAME_LINK_POPUP_DESCRIPTION,
  EMBED_IFRAME_LINK_POPUP_PLACEHOLDER,
  EMBED_IFRAME_TOOLBAR_ORIGINAL,
  EMBED_IFRAME_NO_LINK_MESSAGE,
];
