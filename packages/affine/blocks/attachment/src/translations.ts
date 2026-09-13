import {
  ATTACHMENT_LABEL,
  type ChromeWording,
} from '@labre/affine-shared/services';

/**
 * The slash-menu "Attachment" item: `nameWording` doubles as its tooltip's
 * `captionWording` (`configs/slash-menu.ts`, `configs/tooltips.ts`) — the same
 * word names the item and captions the illustration. Declared in `chrome.ts`
 * (L7 dedupe: also shared with the outline panel's own placeholder for an
 * untitled attachment) and re-exported here under this package's own name.
 */
export const ATTACHMENT_SLASH_NAME = ATTACHMENT_LABEL;

export const ATTACHMENT_SLASH_DESCRIPTION: ChromeWording = [
  'com.labre.attachment.slash.description',
  'Attach a file to document.',
];

/** The slash-menu "PDF" item, same pattern as {@link ATTACHMENT_SLASH_NAME}. */
export const ATTACHMENT_SLASH_PDF_NAME: ChromeWording = [
  'com.labre.attachment.slash.pdf.name',
  'PDF',
];

export const ATTACHMENT_SLASH_PDF_DESCRIPTION: ChromeWording = [
  'com.labre.attachment.slash.pdf.description',
  'Upload a PDF to document.',
];

/** The toolbar's "Replace attachment" tooltip (`configs/toolbar.ts`). */
export const ATTACHMENT_TOOLBAR_REPLACE: ChromeWording = [
  'com.labre.attachment.toolbar.replace',
  'Replace attachment',
];

/**
 * The surface toolbar's two style labels — plain, unlike the "Large / Small"
 * pairs the card-style switchers of bookmark / embed / embed-doc share
 * (`TOOLBAR_LARGE_HORIZONTAL_STYLE`…): the attachment card has only the two
 * cube styles, so its own words stay here rather than in `chrome.ts`.
 */
export const ATTACHMENT_TOOLBAR_HORIZONTAL_STYLE: ChromeWording = [
  'com.labre.attachment.toolbar.style.horizontal',
  'Horizontal style',
];

export const ATTACHMENT_TOOLBAR_VERTICAL_STYLE: ChromeWording = [
  'com.labre.attachment.toolbar.style.vertical',
  'Vertical style',
];

/** The rename modal's empty-name toast (`components/rename-model.ts`). */
export const ATTACHMENT_RENAME_EMPTY_NAME: ChromeWording = [
  'com.labre.attachment.rename.empty-name',
  'File name cannot be empty',
];

/**
 * The download toasts (`utils.ts`), named with the (possibly shortened) file
 * name — `{{name}}` is that name, not a count, so the host translates the
 * sentence around it rather than pluralising anything.
 */
export const ATTACHMENT_TOAST_DOWNLOADING: ChromeWording = [
  'com.labre.attachment.toast.downloading',
  'Downloading {{name}}',
];

export const ATTACHMENT_TOAST_DOWNLOAD_FAILED: ChromeWording = [
  'com.labre.attachment.toast.download-failed',
  'Failed to download {{name}}!',
];

/**
 * The resource-state buttons (`attachment-block.ts`). `label` there also
 * feeds `AttachmentReloadedEvent`'s telemetry `control` field, so it stays a
 * stable lowercase English identifier — only the RENDERED text goes through
 * `translateKey`, via these separate wordings.
 */
export const ATTACHMENT_BUTTON_UPGRADE: ChromeWording = [
  'com.labre.attachment.button.upgrade',
  'Upgrade',
];

export const ATTACHMENT_BUTTON_RETRY: ChromeWording = [
  'com.labre.attachment.button.retry',
  'retry',
];

export const ATTACHMENT_BUTTON_RELOAD: ChromeWording = [
  'com.labre.attachment.button.reload',
  'reload',
];

/**
 * This package's contribution to the translation-key manifest, listed in
 * `PACKAGE_WORDINGS` under source `chrome`
 * (`packages/affine/all/src/translations.ts`). The shared verbs it reuses
 * (Caption, Download, Rename…) travel with `@labre/affine-shared/services`
 * instead, so they are not restated here.
 */
export const ATTACHMENT_WORDINGS: readonly ChromeWording[] = [
  ATTACHMENT_SLASH_DESCRIPTION,
  ATTACHMENT_SLASH_PDF_NAME,
  ATTACHMENT_SLASH_PDF_DESCRIPTION,
  ATTACHMENT_TOOLBAR_REPLACE,
  ATTACHMENT_TOOLBAR_HORIZONTAL_STYLE,
  ATTACHMENT_TOOLBAR_VERTICAL_STYLE,
  ATTACHMENT_RENAME_EMPTY_NAME,
  ATTACHMENT_TOAST_DOWNLOADING,
  ATTACHMENT_TOAST_DOWNLOAD_FAILED,
  ATTACHMENT_BUTTON_UPGRADE,
  ATTACHMENT_BUTTON_RETRY,
  ATTACHMENT_BUTTON_RELOAD,
];
