import {
  type ChromeWording,
  DISPLAY_MODE_EDGELESS,
  EDGELESS_CONTENT_LABEL,
  MINDMAP_NAME,
} from '@labre/affine-shared/services';

/**
 * The "/ Mind Map" slash-menu entry's seeds: the root and child node captions
 * a freshly inserted mindmap is written with (`configs/slash-menu.ts`).
 * Resolved at PLACEMENT and never again — a node renamed by its author keeps
 * its name, and a mindmap inserted before these keys existed keeps the plain
 * text it was given.
 */
export const SURFACE_REF_SEED_MINDMAP_ROOT: ChromeWording = [
  'com.labre.surface-ref.seed.mindmap-root',
  'Mind Map',
];
export const SURFACE_REF_SEED_MINDMAP_NODE: ChromeWording = [
  'com.labre.surface-ref.seed.mindmap-node',
  'Text',
];

/**
 * This package's contribution to the translation-key manifest, listed in
 * `PACKAGE_SEED_WORDINGS` under source `seed`
 * (`packages/affine/all/src/translations.ts`).
 */
export const SURFACE_REF_WORDINGS: readonly ChromeWording[] = [
  SURFACE_REF_SEED_MINDMAP_ROOT,
  SURFACE_REF_SEED_MINDMAP_NODE,
];

/* ── Chrome: the slash-menu items rendered for surface-ref (`configs/slash-menu.ts`) ──
 *
 * These are the ITEM's own chrome name/tooltip, distinct from the SEEDS
 * above: a seed is the text written into a freshly-inserted node, re-keyed
 * even when it happens to read the same as a menu item's name.
 */

/**
 * The "Mind Map" slash-menu item's own name — the item shown in the menu,
 * NOT the root node's seed text (`SURFACE_REF_SEED_MINDMAP_ROOT`), which
 * happens to read the same but is a different concern (see the module doc
 * above).
 */
export const SURFACE_REF_SLASH_MINDMAP_NAME = MINDMAP_NAME;

export const SURFACE_REF_SLASH_MINDMAP_DESCRIPTION: ChromeWording = [
  'com.labre.surface-ref.slash.mindmap.description',
  'Insert a mind map',
];

export const SURFACE_REF_SLASH_FRAME_DESCRIPTION: ChromeWording = [
  'com.labre.surface-ref.slash.frame.description',
  'Insert a blank frame',
];

/** The tooltip caption shared by the mindmap, frame and group list items. */
export const SURFACE_REF_SLASH_TOOLTIP_EDGELESS = DISPLAY_MODE_EDGELESS;

/**
 * The "Frame: {{title}}" / "Group: {{title}}" list items — a placed frame's
 * or group's own entry in the slash menu, named after its live title. Was a
 * string CONCATENATION (`'Frame: ' + frameModel.props.title`) the literal
 * guard could only half-detect (see `literals.unit.spec.ts`'s ponytail
 * note); resolving it through the seam removes the literal outright.
 */
export const SURFACE_REF_SLASH_FRAME_ITEM_NAME: ChromeWording = [
  'com.labre.surface-ref.slash.frame-item.name',
  'Frame: {{title}}',
];

export const SURFACE_REF_SLASH_GROUP_ITEM_NAME: ChromeWording = [
  'com.labre.surface-ref.slash.group-item.name',
  'Group: {{title}}',
];

/* ── Chrome: the placeholder card (`components/placeholder.ts`) and the
 * reference-type table it shares with `utils.ts`'s `TYPE_ICON_MAP` ──────── */

/**
 * The reference kinds' own display names. `frame` reuses the shared
 * `TOOLBAR_FRAME` chrome wording (the frame primitive's name, also used by
 * the `frame` package's own tool and dense-menu entry) rather than a second
 * key for the same word.
 */
export const SURFACE_REF_TYPE_GROUP: ChromeWording = [
  'com.labre.surface-ref.type.group',
  'Group',
];

export const SURFACE_REF_TYPE_MINDMAP: ChromeWording = [
  'com.labre.surface-ref.type.mindmap',
  'Mind map',
];

export const SURFACE_REF_TYPE_EDGELESS = EDGELESS_CONTENT_LABEL;

/** The title shown when the referenced element is missing entirely. */
export const SURFACE_REF_PLACEHOLDER_NOT_AVAILABLE: ChromeWording = [
  'com.labre.surface-ref.placeholder.not-available',
  'This {{type}} not available',
];

/**
 * The body sentence for each kind, once found to be deleted — one full
 * sentence per kind rather than one interpolated onto a lowercased name: the
 * lower-casing is a purely English inflection the fallback needs to
 * reproduce exactly, and a translated host may not have a stable "lowercase"
 * of a translated noun at all (mirrors `BOARD_LEGEND_NOTATION` /
 * `BOARD_LEGEND_COMPONENTS` in `chrome.ts`: a full sentence per case rather
 * than a shared template).
 */
export const SURFACE_REF_PLACEHOLDER_DELETED_FRAME: ChromeWording = [
  'com.labre.surface-ref.placeholder.deleted.frame',
  'The frame is deleted or not in this doc.',
];

export const SURFACE_REF_PLACEHOLDER_DELETED_GROUP: ChromeWording = [
  'com.labre.surface-ref.placeholder.deleted.group',
  'The group is deleted or not in this doc.',
];

export const SURFACE_REF_PLACEHOLDER_DELETED_MINDMAP: ChromeWording = [
  'com.labre.surface-ref.placeholder.deleted.mindmap',
  'The mind map is deleted or not in this doc.',
];

export const SURFACE_REF_PLACEHOLDER_DELETED_EDGELESS: ChromeWording = [
  'com.labre.surface-ref.placeholder.deleted.edgeless',
  'The canvas content is deleted or not in this doc.',
];

export const SURFACE_REF_PLACEHOLDER_CANNOT_DISPLAY_FRAME: ChromeWording = [
  'com.labre.surface-ref.placeholder.cannot-display.frame',
  'The frame is inserted but cannot display in canvas mode. Switch to document mode to view the block.',
];

export const SURFACE_REF_PLACEHOLDER_CANNOT_DISPLAY_GROUP: ChromeWording = [
  'com.labre.surface-ref.placeholder.cannot-display.group',
  'The group is inserted but cannot display in canvas mode. Switch to document mode to view the block.',
];

export const SURFACE_REF_PLACEHOLDER_CANNOT_DISPLAY_MINDMAP: ChromeWording = [
  'com.labre.surface-ref.placeholder.cannot-display.mindmap',
  'The mind map is inserted but cannot display in canvas mode. Switch to document mode to view the block.',
];

export const SURFACE_REF_PLACEHOLDER_CANNOT_DISPLAY_EDGELESS: ChromeWording = [
  'com.labre.surface-ref.placeholder.cannot-display.edgeless',
  'The canvas content is inserted but cannot display in canvas mode. Switch to document mode to view the block.',
];

/**
 * Per-kind table joining the two placeholder sentences above to the
 * `refFlavour` / `TYPE_ICON_MAP` key they answer for
 * (`components/placeholder.ts`). The kind's NAME itself is
 * `TYPE_ICON_MAP[key].wording` (`utils.ts`) — not repeated here.
 */
export const SURFACE_REF_TYPE_SENTENCE_WORDINGS: Readonly<
  Record<string, { deleted: ChromeWording; cannotDisplay: ChromeWording }>
> = {
  'affine:frame': {
    deleted: SURFACE_REF_PLACEHOLDER_DELETED_FRAME,
    cannotDisplay: SURFACE_REF_PLACEHOLDER_CANNOT_DISPLAY_FRAME,
  },
  group: {
    deleted: SURFACE_REF_PLACEHOLDER_DELETED_GROUP,
    cannotDisplay: SURFACE_REF_PLACEHOLDER_CANNOT_DISPLAY_GROUP,
  },
  mindmap: {
    deleted: SURFACE_REF_PLACEHOLDER_DELETED_MINDMAP,
    cannotDisplay: SURFACE_REF_PLACEHOLDER_CANNOT_DISPLAY_MINDMAP,
  },
  edgeless: {
    deleted: SURFACE_REF_PLACEHOLDER_DELETED_EDGELESS,
    cannotDisplay: SURFACE_REF_PLACEHOLDER_CANNOT_DISPLAY_EDGELESS,
  },
};

/**
 * This package's CHROME contribution to the translation-key manifest,
 * listed in `PACKAGE_WORDINGS` under source `chrome`
 * (`packages/affine/all/src/translations.ts`) — separate from
 * {@link SURFACE_REF_WORDINGS} above, which stays under `PACKAGE_SEED_WORDINGS`
 * (source `seed`). `TOOLBAR_FRAME` travels with
 * `@labre/affine-shared/services` instead, so it is not restated here.
 */
export const SURFACE_REF_CHROME_WORDINGS: readonly ChromeWording[] = [
  SURFACE_REF_SLASH_MINDMAP_DESCRIPTION,
  SURFACE_REF_SLASH_FRAME_DESCRIPTION,
  SURFACE_REF_SLASH_FRAME_ITEM_NAME,
  SURFACE_REF_SLASH_GROUP_ITEM_NAME,
  SURFACE_REF_TYPE_GROUP,
  SURFACE_REF_TYPE_MINDMAP,
  SURFACE_REF_PLACEHOLDER_NOT_AVAILABLE,
  SURFACE_REF_PLACEHOLDER_DELETED_FRAME,
  SURFACE_REF_PLACEHOLDER_DELETED_GROUP,
  SURFACE_REF_PLACEHOLDER_DELETED_MINDMAP,
  SURFACE_REF_PLACEHOLDER_DELETED_EDGELESS,
  SURFACE_REF_PLACEHOLDER_CANNOT_DISPLAY_FRAME,
  SURFACE_REF_PLACEHOLDER_CANNOT_DISPLAY_GROUP,
  SURFACE_REF_PLACEHOLDER_CANNOT_DISPLAY_MINDMAP,
  SURFACE_REF_PLACEHOLDER_CANNOT_DISPLAY_EDGELESS,
];
