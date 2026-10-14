import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * The view engine's own wordings. Most of the data-view's chrome is still a
 * deferred surface of the literal ratchet (`DEFERRED_DIRS` in
 * `affine/all/src/__tests__/translations/literals.unit.spec.ts`); what is
 * declared here is what was written after that decision, keyed from the start.
 */

/* ── A view whose mode has no preset here (ADR 0035 §6) ───────────────── */

/** Beside the view's name in its tab: the stored mode is drawn as a table. */
export const VIEW_SHOWN_AS_TABLE: ChromeWording = [
  'com.labre.data-view.view.shown-as-table',
  'Shown as a table',
];

/**
 * The view menu's way out of such a view: a new table view, same name, the
 * stored one left untouched.
 */
export const VIEW_DUPLICATE_AS_TABLE: ChromeWording = [
  'com.labre.data-view.view.duplicate-as-table',
  'Duplicate as table',
];

/* ── The views bar (ADR 0035 B11, labre PRD REQ-DB-7) ─────────────────── */

/** The button standing for the views whose tabs do not fit; `count` of them. */
export const VIEWS_BAR_MORE: ChromeWording = [
  'com.labre.data-view.views-bar.more',
  '{{count}} more',
];

/** The "+" after the tabs, as its label and tooltip. */
export const VIEWS_BAR_ADD_VIEW: ChromeWording = [
  'com.labre.data-view.views-bar.add-view',
  'New view',
];

/** A tab's menu: the name field. */
export const VIEWS_BAR_VIEW_NAME: ChromeWording = [
  'com.labre.data-view.views-bar.view-name',
  'View name',
];

/** A tab's menu: opens the view's settings. */
export const VIEWS_BAR_EDIT_VIEW: ChromeWording = [
  'com.labre.data-view.views-bar.edit-view',
  'Edit view',
];

export const VIEWS_BAR_MOVE_LEFT: ChromeWording = [
  'com.labre.data-view.views-bar.move-left',
  'Move left',
];

export const VIEWS_BAR_MOVE_RIGHT: ChromeWording = [
  'com.labre.data-view.views-bar.move-right',
  'Move right',
];

/** Walked by `PACKAGE_WORDINGS` in `packages/affine/all/src/translations.ts`. */
export const DATA_VIEW_WORDINGS: readonly ChromeWording[] = [
  VIEW_SHOWN_AS_TABLE,
  VIEW_DUPLICATE_AS_TABLE,
  VIEWS_BAR_MORE,
  VIEWS_BAR_ADD_VIEW,
  VIEWS_BAR_VIEW_NAME,
  VIEWS_BAR_EDIT_VIEW,
  VIEWS_BAR_MOVE_LEFT,
  VIEWS_BAR_MOVE_RIGHT,
];
