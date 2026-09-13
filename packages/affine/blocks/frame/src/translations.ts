import {
  type ChromeWording,
  TOOLBAR_INSERT_INTO_PAGE,
  TOOLBAR_UNGROUP,
} from '@labre/affine-shared/services';

/**
 * The frame's own seed: the default title a newly created frame is stamped
 * with (`Frame 3`), written into the document at creation
 * (`EdgelessFrameManager._addFrameBlock`, `FrameTool.dragMove`). Resolved at
 * PLACEMENT and never again — a frame renamed by its author keeps its name,
 * and a frame created before this key existed keeps the plain text it was
 * given.
 *
 * `{{n}}` is the frame's 1-based ordinal among the frames already on the doc;
 * the host interpolates it, and the fallback keeps it neutral for the same
 * reason a count never gets its own key (see the translation-service README).
 */
export const FRAME_SEED_NAME: ChromeWording = [
  'com.labre.frame.seed.name',
  'Frame {{n}}',
];

/**
 * This package's contribution to the translation-key manifest — a single seed,
 * listed in `PACKAGE_SEED_WORDINGS` under source `seed`
 * (`packages/affine/all/src/translations.ts`).
 */
export const FRAME_WORDINGS: readonly ChromeWording[] = [FRAME_SEED_NAME];

/* ── Chrome: the edgeless toolbar's frame dense-menu (`edgeless-toolbar/`) ── */

/**
 * "Custom" (pick the freeform frame tool rather than a preset ratio) —
 * reused verbatim by both the dense menu (`frame-dense-menu.ts`) and the
 * slide-out menu (`frame-menu.ts`).
 */
export const FRAME_DENSE_MENU_CUSTOM: ChromeWording = [
  'com.labre.frame.dense-menu.custom',
  'Custom',
];

/** `{{name}}` is a preset ratio ("1:1", "16:9"), not translated. */
export const FRAME_DENSE_MENU_SLIDE: ChromeWording = [
  'com.labre.frame.dense-menu.slide',
  'Slide {{name}}',
];

/* ── Chrome: the frame's own surface toolbar (`frame-toolbar.ts`) ────────── */

export const FRAME_TOOLBAR_INSERT_INTO_PAGE = TOOLBAR_INSERT_INTO_PAGE;

/**
 * The success notification's message body AND the standalone-playground
 * fallback (`toast(...)`, when no `NotificationProvider` is registered) —
 * the exact same sentence, one key for both.
 */
export const FRAME_TOAST_INSERTED_MESSAGE: ChromeWording = [
  'com.labre.frame.toast.inserted-message',
  'Frame has been inserted into doc',
];

export const FRAME_TOOLBAR_UNGROUP = TOOLBAR_UNGROUP;

export const FRAME_TOOLBAR_BACKGROUND: ChromeWording = [
  'com.labre.frame.toolbar.background',
  'Background',
];

/* ── Chrome: presentation mode (`present/`) ──────────────────────────────── */

export const FRAME_PRESENT_TOOL_TOOLTIP: ChromeWording = [
  'com.labre.frame.present.tool-tooltip',
  'Present',
];

export const FRAME_PRESENT_PREVIOUS: ChromeWording = [
  'com.labre.frame.present.previous',
  'Previous',
];

export const FRAME_PRESENT_NEXT: ChromeWording = [
  'com.labre.frame.present.next',
  'Next',
];

export const FRAME_PRESENT_EXIT_FULLSCREEN: ChromeWording = [
  'com.labre.frame.present.exit-fullscreen',
  'Exit Full Screen',
];

export const FRAME_PRESENT_ENTER_FULLSCREEN: ChromeWording = [
  'com.labre.frame.present.enter-fullscreen',
  'Enter Full Screen',
];

export const FRAME_PRESENT_REACHED_LAST: ChromeWording = [
  'com.labre.frame.present.reached-last',
  'You have reached the last frame',
];

export const FRAME_PRESENT_REACHED_FIRST: ChromeWording = [
  'com.labre.frame.present.reached-first',
  'You have reached the first frame',
];

export const FRAME_PRESENT_REQUIRES_ONE_FRAME: ChromeWording = [
  'com.labre.frame.present.requires-one-frame',
  'The presentation requires at least 1 frame. You can firstly create a frame.',
];

/** The frame navigator's title placeholder before any frame exists. */
export const FRAME_PRESENT_NO_FRAME_TITLE: ChromeWording = [
  'com.labre.frame.present.no-frame-title',
  'no frame',
];

/**
 * The frame-order button's tooltip AND its section header in the settings
 * menu (`present/frame-order-button.ts`, `present/navigator-setting-button.ts`)
 * — the exact same word, one key for both.
 */
export const FRAME_PRESENT_FRAME_ORDER: ChromeWording = [
  'com.labre.frame.present.frame-order',
  'Frame Order',
];

export const FRAME_PRESENT_BLACK_BACKGROUND: ChromeWording = [
  'com.labre.frame.present.black-background',
  'Black background',
];

/**
 * This package's CHROME contribution to the translation-key manifest, listed
 * in `PACKAGE_WORDINGS` under source `chrome`
 * (`packages/affine/all/src/translations.ts`) — separate from
 * {@link FRAME_WORDINGS} above, which stays under `PACKAGE_SEED_WORDINGS`
 * (source `seed`). The shared verbs it reuses (Rename, Frame, Settings,
 * Hide toolbar, Playback Settings…) travel with
 * `@labre/affine-shared/services` instead, so they are not restated here.
 */
export const FRAME_CHROME_WORDINGS: readonly ChromeWording[] = [
  FRAME_DENSE_MENU_CUSTOM,
  FRAME_DENSE_MENU_SLIDE,
  FRAME_TOAST_INSERTED_MESSAGE,
  FRAME_TOOLBAR_BACKGROUND,
  FRAME_PRESENT_TOOL_TOOLTIP,
  FRAME_PRESENT_PREVIOUS,
  FRAME_PRESENT_NEXT,
  FRAME_PRESENT_EXIT_FULLSCREEN,
  FRAME_PRESENT_ENTER_FULLSCREEN,
  FRAME_PRESENT_REACHED_LAST,
  FRAME_PRESENT_REACHED_FIRST,
  FRAME_PRESENT_REQUIRES_ONE_FRAME,
  FRAME_PRESENT_NO_FRAME_TITLE,
  FRAME_PRESENT_FRAME_ORDER,
  FRAME_PRESENT_BLACK_BACKGROUND,
];
