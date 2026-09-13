import {
  type ChromeWording,
  TOOL_NAME_FRAME,
  TOOLBAR_CREATE_LINKED_DOC_TITLE,
  TOOLBAR_RELOAD,
  TOOLBAR_REMOVE_LINK,
} from '@labre/affine-shared/services';

/**
 * This package's own wordings, joined into `PACKAGE_WORDINGS` /
 * `PACKAGE_SEED_WORDINGS` in `@labre/affine/translations` — see that file and
 * `packages/affine/shared/src/services/translation-service/README.md`.
 */

/* ── The block contextual toolbar (`configs/toolbar.ts`) ──────────────── */

export const ROOT_TOOLBAR_CONVERSIONS_ARIA: ChromeWording = [
  'com.labre.root.toolbar.conversions',
  'Conversions',
];

export const ROOT_TOOLBAR_TURN_INTO: ChromeWording = [
  'com.labre.root.toolbar.turn-into',
  'Turn into',
];

export const ROOT_TOOLBAR_CREATE_TABLE: ChromeWording = [
  'com.labre.root.toolbar.create-table',
  'Create Table',
];

/**
 * An alias (L7 dedupe): the same Title Case word as
 * {@link TOOLBAR_CREATE_LINKED_DOC_TITLE}, distinct from the shared
 * sentence-case `TOOLBAR_CREATE_LINKED_DOC` chrome wording
 * (`com.labre.toolbar.create-linked-doc`, "Create linked doc").
 */
export const ROOT_TOOLBAR_CREATE_LINKED_DOC = TOOLBAR_CREATE_LINKED_DOC_TITLE;

/* ── The edgeless alignment menu (`edgeless/configs/toolbar/alignment.ts`) ── */

export const ROOT_ALIGNMENT_MENU_ARIA: ChromeWording = [
  'com.labre.root.toolbar.alignment-menu',
  'alignment-menu',
];

export const ROOT_ALIGN_LEFT: ChromeWording = [
  'com.labre.root.toolbar.align-left',
  'Align left',
];
export const ROOT_ALIGN_HORIZONTALLY: ChromeWording = [
  'com.labre.root.toolbar.align-horizontally',
  'Align horizontally',
];
export const ROOT_ALIGN_RIGHT: ChromeWording = [
  'com.labre.root.toolbar.align-right',
  'Align right',
];
export const ROOT_DISTRIBUTE_HORIZONTALLY: ChromeWording = [
  'com.labre.root.toolbar.distribute-horizontally',
  'Distribute horizontally',
];
export const ROOT_ALIGN_TOP: ChromeWording = [
  'com.labre.root.toolbar.align-top',
  'Align top',
];
export const ROOT_ALIGN_VERTICALLY: ChromeWording = [
  'com.labre.root.toolbar.align-vertically',
  'Align vertically',
];
export const ROOT_ALIGN_BOTTOM: ChromeWording = [
  'com.labre.root.toolbar.align-bottom',
  'Align bottom',
];
export const ROOT_DISTRIBUTE_VERTICALLY: ChromeWording = [
  'com.labre.root.toolbar.distribute-vertically',
  'Distribute vertically',
];
export const ROOT_AUTO_ARRANGE: ChromeWording = [
  'com.labre.root.toolbar.auto-arrange',
  'Auto arrange',
];
export const ROOT_RESIZE_AND_ALIGN: ChromeWording = [
  'com.labre.root.toolbar.resize-and-align',
  'Resize & Align',
];

/* ── The edgeless misc contextual toolbar (`edgeless/configs/toolbar/misc.ts`) ── */

export const ROOT_TOOLBAR_RELEASE_FROM_GROUP: ChromeWording = [
  'com.labre.root.toolbar.release-from-group',
  'Release from group',
];
export const ROOT_TOOLBAR_FRAME = TOOL_NAME_FRAME;
export const ROOT_TOOLBAR_GROUP: ChromeWording = [
  'com.labre.root.toolbar.group',
  'Group',
];
export const ROOT_TOOLBAR_ALIGN_OBJECTS: ChromeWording = [
  'com.labre.root.toolbar.align-objects',
  'Align objects',
];
export const ROOT_TOOLBAR_CLICK_TO_UNLOCK: ChromeWording = [
  'com.labre.root.toolbar.click-to-unlock',
  'Click to unlock',
];

/* ── The edgeless "More" sub-menu (`edgeless/configs/toolbar/more.ts`) ─── */

export const ROOT_TOOLBAR_FRAME_SECTION: ChromeWording = [
  'com.labre.root.toolbar.frame-section',
  'Frame section',
];
export const ROOT_TOOLBAR_GROUP_SECTION: ChromeWording = [
  'com.labre.root.toolbar.group-section',
  'Group section',
];
export const ROOT_TOOLBAR_BRING_FORWARD: ChromeWording = [
  'com.labre.root.toolbar.bring-forward',
  'Bring Forward',
];
export const ROOT_TOOLBAR_SEND_BACKWARD: ChromeWording = [
  'com.labre.root.toolbar.send-backward',
  'Send Backward',
];
export const ROOT_TOOLBAR_RELOAD = TOOLBAR_RELOAD;
export const ROOT_TOOLBAR_TURN_INTO_LINKED_DOC: ChromeWording = [
  'com.labre.root.toolbar.turn-into-linked-doc',
  'Turn into linked doc',
];
export const ROOT_TOOLBAR_EDIT_LINK: ChromeWording = [
  'com.labre.root.toolbar.edit-link',
  'Edit link',
];
export const ROOT_TOOLBAR_REMOVE_LINK = TOOLBAR_REMOVE_LINK;

/* ── The edgeless keyboard shortcuts (`edgeless/edgeless-keyboard.ts`) ─── */

export const ROOT_TOAST_ZOOM_TO_SELECTION: ChromeWording = [
  'com.labre.root.toast.zoom-to-selection',
  'Zoom to selection',
];

/**
 * The Tab/Enter mindmap shortcuts' seed for a freshly added node — the same
 * word `MindmapElementModel.addNode`'s own default falls back to (that
 * default is model/red-zone, left untouched: the creation site now passes
 * this text explicitly instead of relying on it). Declared here rather than
 * in `@labre/affine-gfx-mindmap` because that package's own translations
 * table does not carry this key yet (see that lot's own translations.ts,
 * owned by a different lot — imported, never edited, per this lot's brief).
 */
export const ROOT_MINDMAP_SEED_NEW_NODE: ChromeWording = [
  'com.labre.mindmap.seed.new-node',
  'New node',
];

/**
 * This package's own CHROME wordings — L7 dedupe aliased
 * `ROOT_TOOLBAR_CREATE_LINKED_DOC`, `ROOT_TOOLBAR_FRAME`, `ROOT_TOOLBAR_RELOAD`
 * and `ROOT_TOOLBAR_REMOVE_LINK` to `chrome.ts` wordings — not listed again
 * here, same rule the note/slash-menu packages' own chrome aliases already
 * follow.
 */
export const ROOT_CHROME_WORDINGS: readonly ChromeWording[] = [
  ROOT_TOOLBAR_CONVERSIONS_ARIA,
  ROOT_TOOLBAR_TURN_INTO,
  ROOT_TOOLBAR_CREATE_TABLE,
  ROOT_ALIGNMENT_MENU_ARIA,
  ROOT_ALIGN_LEFT,
  ROOT_ALIGN_HORIZONTALLY,
  ROOT_ALIGN_RIGHT,
  ROOT_DISTRIBUTE_HORIZONTALLY,
  ROOT_ALIGN_TOP,
  ROOT_ALIGN_VERTICALLY,
  ROOT_ALIGN_BOTTOM,
  ROOT_DISTRIBUTE_VERTICALLY,
  ROOT_AUTO_ARRANGE,
  ROOT_RESIZE_AND_ALIGN,
  ROOT_TOOLBAR_RELEASE_FROM_GROUP,
  ROOT_TOOLBAR_GROUP,
  ROOT_TOOLBAR_ALIGN_OBJECTS,
  ROOT_TOOLBAR_CLICK_TO_UNLOCK,
  ROOT_TOOLBAR_FRAME_SECTION,
  ROOT_TOOLBAR_GROUP_SECTION,
  ROOT_TOOLBAR_BRING_FORWARD,
  ROOT_TOOLBAR_SEND_BACKWARD,
  ROOT_TOOLBAR_TURN_INTO_LINKED_DOC,
  ROOT_TOOLBAR_EDIT_LINK,
  ROOT_TOAST_ZOOM_TO_SELECTION,
];

/** This package's own seed, joined into `PACKAGE_SEED_WORDINGS`. */
export const ROOT_SEED_WORDINGS: readonly ChromeWording[] = [
  ROOT_MINDMAP_SEED_NEW_NODE,
];
