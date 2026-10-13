import {
  type ChromeWording,
  IMAGE_LABEL,
  NOTE_SHADOW_BOX,
  NOTE_SHADOW_FILM,
  NOTE_SHADOW_NONE,
  NOTE_SHADOW_PAPER,
  NOTE_SHADOW_STICKER,
  TOOL_NAME_NOTE,
  TOOLBAR_LINK,
} from '@labre/affine-shared/services';

/**
 * This package's own wordings, declared beside the code that renders them —
 * the edgeless "add note" senior tool and its shadow/display-mode panels.
 * Words this package shares with `blocks/note` (the shadow options, other
 * than the typo below) live in `chrome.ts` and are re-exported here.
 */

export {
  NOTE_SHADOW_BOX,
  NOTE_SHADOW_FILM,
  NOTE_SHADOW_NONE,
  NOTE_SHADOW_PAPER,
  NOTE_SHADOW_STICKER,
  TOOLBAR_LINK as GFX_NOTE_MENU_LINK,
};

/**
 * `./components/note-shadow-panel.ts`'s own copy of the "floating" shadow —
 * spelt "Floation" there, a pre-existing typo distinct from `blocks/note`'s
 * "Floating shadow". The fallback must stay the literal on screen, so it
 * keeps its own key rather than reusing `blocks/note`'s `NOTE_SHADOW_FLOATING`.
 */
export const GFX_NOTE_SHADOW_FLOATION: ChromeWording = [
  'com.labre.note.shadow.floation',
  'Floation shadow',
];

/* ── `./components/note-display-mode-panel.ts` ────────────────────────────
 * A different wording from `blocks/note`'s own display-mode dropdown (which
 * says "Both" / "Edgeless" / "Page"): this panel's labels read "In Both" /
 * "In Page Only" / "In Canvas Only", so they get their own keys.
 */

export const GFX_NOTE_DISPLAY_MODE_BOTH: ChromeWording = [
  'com.labre.gfx-note.display-mode.in-both',
  'In Both',
];

export const GFX_NOTE_DISPLAY_MODE_PAGE_ONLY: ChromeWording = [
  'com.labre.gfx-note.display-mode.in-page-only',
  'In Page Only',
];

export const GFX_NOTE_DISPLAY_MODE_EDGELESS_ONLY: ChromeWording = [
  'com.labre.gfx-note.display-mode.in-edgeless-only',
  'In Canvas Only',
];

/* ── `./toolbar/note-menu.ts` — the "add to note" quick-tool row ────────── */

export const GFX_NOTE_MENU_IMAGE = IMAGE_LABEL;

export const GFX_NOTE_MENU_FILE: ChromeWording = [
  'com.labre.gfx-note.menu.file',
  'File',
];

/* ── The note senior tool's own name ───────────────────────────────────────
 * Said in three places (the senior-tool row's tooltip via `labelKey`, the
 * senior button's own shortcut tooltip, and the quick-tool button's shortcut
 * tooltip) — one wording for all three.
 */
export const GFX_NOTE_TOOL_LABEL = TOOL_NAME_NOTE;

/**
 * Every wording DECLARED IN THIS FILE (not re-exported from `chrome.ts`), in
 * declaration order — walked by `PACKAGE_WORDINGS` in
 * `packages/affine/all/src/translations.ts`.
 */
export const GFX_NOTE_WORDINGS: readonly ChromeWording[] = [
  GFX_NOTE_SHADOW_FLOATION,
  GFX_NOTE_DISPLAY_MODE_BOTH,
  GFX_NOTE_DISPLAY_MODE_PAGE_ONLY,
  GFX_NOTE_DISPLAY_MODE_EDGELESS_ONLY,
  GFX_NOTE_MENU_FILE,
];
