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

/** Walked by `PACKAGE_WORDINGS` in `packages/affine/all/src/translations.ts`. */
export const DATA_VIEW_WORDINGS: readonly ChromeWording[] = [
  VIEW_SHOWN_AS_TABLE,
  VIEW_DUPLICATE_AS_TABLE,
];
