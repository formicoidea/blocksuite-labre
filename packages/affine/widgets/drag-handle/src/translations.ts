import {
  type ChromeWording,
  EDGELESS_CONTENT_LABEL,
} from '@labre/affine-shared/services';

/**
 * The drag-and-drop preview's own per-flavour labels, shown on the ghost
 * card that follows the pointer while dragging edgeless content.
 */
export const DRAG_PREVIEW_SHAPE: ChromeWording = [
  'com.labre.drag-handle.preview.shape',
  'Canvas shape',
];

export const DRAG_PREVIEW_IMAGE: ChromeWording = [
  'com.labre.drag-handle.preview.image',
  'Image block',
];

export const DRAG_PREVIEW_NOTE: ChromeWording = [
  'com.labre.drag-handle.preview.note',
  'Note block',
];

export const DRAG_PREVIEW_FRAME: ChromeWording = [
  'com.labre.drag-handle.preview.frame',
  'Frame block',
];

export const DRAG_PREVIEW_EMBED: ChromeWording = [
  'com.labre.drag-handle.preview.embed',
  'Embed block',
];

/** An alias (L7 dedupe): the same word as {@link EDGELESS_CONTENT_LABEL}, one key. */
export const DRAG_PREVIEW_GENERIC = EDGELESS_CONTENT_LABEL;

/** Every wording this package declares, in the order it renders them. */
export const DRAG_HANDLE_WORDINGS: readonly ChromeWording[] = [
  DRAG_PREVIEW_SHAPE,
  DRAG_PREVIEW_IMAGE,
  DRAG_PREVIEW_NOTE,
  DRAG_PREVIEW_FRAME,
  DRAG_PREVIEW_EMBED,
];
