import {
  type ChromeWording,
  GROUP_SEED_NAME,
  TOOLBAR_INSERT_INTO_PAGE,
  TOOLBAR_RENAME,
  TOOLBAR_UNGROUP,
} from '@labre/affine-shared/services';

/**
 * The group's own seed — the default title a newly created group is stamped
 * with (`Group 2`), written into the document by `createGroupCommand`.
 *
 * It now LIVES in `@labre/affine-shared`, because the surface block's legend
 * groups the box it draws and cannot import this package (`gfx-group` depends
 * on the surface block, not the other way round). Re-exported here unchanged,
 * and still listed by {@link GROUP_WORDINGS} below, so the key manifest sees
 * exactly the one `seed` entry it always has.
 */
export { GROUP_SEED_NAME };

/**
 * This package's contribution to the translation-key manifest — a single seed,
 * listed in `PACKAGE_SEED_WORDINGS` under source `seed`
 * (`packages/affine/all/src/translations.ts`).
 */
export const GROUP_WORDINGS: readonly ChromeWording[] = [GROUP_SEED_NAME];

/* ── The group contextual toolbar, chrome (re-rendered every open) ────── */

export const GROUP_TOOLBAR_INSERT_INTO_PAGE = TOOLBAR_INSERT_INTO_PAGE;

export const GROUP_TOAST_INSERTED: ChromeWording = [
  'com.labre.group.toast.inserted',
  'Group has been inserted into doc',
];

export const GROUP_TOOLBAR_RENAME = TOOLBAR_RENAME;

export const GROUP_TOOLBAR_UNGROUP = TOOLBAR_UNGROUP;

export const GROUP_CHROME_WORDINGS: readonly ChromeWording[] = [
  GROUP_TOAST_INSERTED,
];
