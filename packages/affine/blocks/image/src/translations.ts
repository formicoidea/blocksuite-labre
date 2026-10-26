import { type ChromeWording, IMAGE_LABEL } from '@labre/affine-shared/services';

/**
 * The image's own generic name — the slash-menu item, the block's title
 * used by `resolveStateWith` (page and edgeless), and the `alt`/caption
 * fallback shown when nothing else names the image
 * (`components/page-image-block.ts`, `image-block.ts`,
 * `image-edgeless-block.ts`). One word, one key, reused everywhere it
 * appears verbatim — declared in `chrome.ts` (L7 dedupe: also shared with
 * `gfx/note`'s "add to note" menu and the outline panel's placeholder) and
 * re-exported here under this package's own name.
 */
export { IMAGE_LABEL };

export const IMAGE_SLASH_DESCRIPTION: ChromeWording = [
  'com.labre.image.slash.description',
  'Insert an image.',
];

/** The slash-menu tooltip's own caption, distinct from the item's name. */
export const IMAGE_SLASH_PHOTO_CAPTION: ChromeWording = [
  'com.labre.image.slash.photo-caption',
  'Photo',
];

export const IMAGE_TOOLBAR_TURN_INTO_CARD_VIEW: ChromeWording = [
  'com.labre.image.toolbar.turn-into-card-view',
  'Turn into card view',
];

/**
 * « Rogner » (ADR 0037): the toolbar button, its presets and the way back to
 * the whole picture. The ratios are words too — a host may write « 16/9 ».
 */
export const IMAGE_TOOLBAR_CROP: ChromeWording = [
  'com.labre.image.toolbar.crop',
  'Crop',
];

export const IMAGE_TOOLBAR_CROP_FREE: ChromeWording = [
  'com.labre.image.toolbar.crop.free',
  'Free',
];

export const IMAGE_TOOLBAR_CROP_16_9: ChromeWording = [
  'com.labre.image.toolbar.crop.ratio-16-9',
  '16:9',
];

export const IMAGE_TOOLBAR_CROP_4_3: ChromeWording = [
  'com.labre.image.toolbar.crop.ratio-4-3',
  '4:3',
];

export const IMAGE_TOOLBAR_CROP_1_1: ChromeWording = [
  'com.labre.image.toolbar.crop.ratio-1-1',
  '1:1',
];

export const IMAGE_TOOLBAR_CROP_ORIGINAL: ChromeWording = [
  'com.labre.image.toolbar.crop.original',
  'Original image',
];

export const IMAGE_PREVIEW_TITLE: ChromeWording = [
  'com.labre.image.preview.title',
  'Image Block',
];

/**
 * The upload/download toasts (`utils.ts`) and the resource controller's
 * error message (`components/page-image-block.ts`,
 * `image-edgeless-block.ts`) — all three read the identical literal, so one
 * key serves all three sites.
 */
export const IMAGE_TOAST_DOWNLOAD_FAILED: ChromeWording = [
  'com.labre.image.toast.download-failed',
  'Failed to download image!',
];

export const IMAGE_TOAST_DOWNLOADING: ChromeWording = [
  'com.labre.image.toast.downloading',
  'Downloading image...',
];

export const IMAGE_TOAST_COPIED: ChromeWording = [
  'com.labre.image.toast.copied',
  'Copied image to clipboard',
];

export const IMAGE_TOAST_READ_SIZE_FAILED: ChromeWording = [
  'com.labre.image.toast.read-size-failed',
  'Failed to read image size, please try another image',
];

/**
 * The image toolbar's "Replace" (`configs/replace-action.ts`), offered only
 * with a host asset dialog (`AssetPickerProvider`).
 */
export const IMAGE_TOOLBAR_REPLACE: ChromeWording = [
  'com.labre.image.toolbar.replace',
  'Replace',
];

/**
 * « Replace with image » on a shape and « Replace with shape » on a canvas
 * image (ADR 0044): the toolbar entries and the commands they run share these
 * keys, so the palette and the toolbar say the same words.
 */
export const IMAGE_REPLACE_WITH_IMAGE: ChromeWording = [
  'com.labre.image.replace.with-image',
  'Replace with image',
];

export const IMAGE_REPLACE_WITH_IMAGE_DESCRIPTION: ChromeWording = [
  'com.labre.image.replace.with-image.description',
  'Put a picture in place of this shape, cut to its box.',
];

export const IMAGE_REPLACE_WITH_SHAPE: ChromeWording = [
  'com.labre.image.replace.with-shape',
  'Replace with shape',
];

export const IMAGE_REPLACE_WITH_SHAPE_DESCRIPTION: ChromeWording = [
  'com.labre.image.replace.with-shape.description',
  'Put a rectangle in place of this image.',
];

/**
 * This package's contribution to the translation-key manifest, listed in
 * `PACKAGE_WORDINGS` under source `chrome`
 * (`packages/affine/all/src/translations.ts`). The shared verbs it reuses
 * (Caption, Download, the upload-size-limit toast…) travel with
 * `@labre/affine-shared/services` instead, so they are not restated here.
 */
export const IMAGE_WORDINGS: readonly ChromeWording[] = [
  IMAGE_SLASH_DESCRIPTION,
  IMAGE_SLASH_PHOTO_CAPTION,
  IMAGE_TOOLBAR_TURN_INTO_CARD_VIEW,
  IMAGE_TOOLBAR_CROP,
  IMAGE_TOOLBAR_CROP_FREE,
  IMAGE_TOOLBAR_CROP_16_9,
  IMAGE_TOOLBAR_CROP_4_3,
  IMAGE_TOOLBAR_CROP_1_1,
  IMAGE_TOOLBAR_CROP_ORIGINAL,
  IMAGE_PREVIEW_TITLE,
  IMAGE_TOAST_DOWNLOAD_FAILED,
  IMAGE_TOAST_DOWNLOADING,
  IMAGE_TOAST_COPIED,
  IMAGE_TOAST_READ_SIZE_FAILED,
  IMAGE_TOOLBAR_REPLACE,
  IMAGE_REPLACE_WITH_IMAGE,
  IMAGE_REPLACE_WITH_IMAGE_DESCRIPTION,
  IMAGE_REPLACE_WITH_SHAPE,
  IMAGE_REPLACE_WITH_SHAPE_DESCRIPTION,
];
