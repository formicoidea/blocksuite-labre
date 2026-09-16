import {
  type ChromeWording,
  TOOL_NAME_FRAME,
  TOOL_NAME_NOTE,
  TOOL_NAME_TEXT,
} from '@labre/affine-shared/services';

/**
 * The "+" auto-complete panel's own wordings. `TOOL_NAME_TEXT` /
 * `TOOL_NAME_NOTE` / `TOOL_NAME_FRAME` are declared once in `chrome.ts`
 * (shared with `gfx/mindmap` and `gfx/shape`'s own tool buttons) and
 * re-exported here under this package's own name.
 */
export const AUTO_COMPLETE_TEXT = TOOL_NAME_TEXT;
export const AUTO_COMPLETE_NOTE = TOOL_NAME_NOTE;
export const AUTO_COMPLETE_FRAME = TOOL_NAME_FRAME;

/** The button that duplicates the currently selected element. */
export const AUTO_COMPLETE_ADD_SAME_OBJECT: ChromeWording = [
  'com.labre.auto-complete.add-same-object',
  'Add a same object',
];

/** The floating "open link" button drawn over a linked element. */
export const EDGELESS_LINK_OPEN_DOC: ChromeWording = [
  'com.labre.edgeless-element-link.open-doc',
  'Open linked doc',
];

export const EDGELESS_LINK_OPEN_LINK: ChromeWording = [
  'com.labre.edgeless-element-link.open-link',
  'Open link',
];

/** Every wording this package DECLARES (see `SHAPE_WORDINGS`'s own note). */
export const EDGELESS_SELECTED_RECT_WORDINGS: readonly ChromeWording[] = [
  AUTO_COMPLETE_ADD_SAME_OBJECT,
  EDGELESS_LINK_OPEN_DOC,
  EDGELESS_LINK_OPEN_LINK,
];
