import {
  type ChromeWording,
  TOOLBAR_INSERT_INTO_PAGE,
  TOOLBAR_RENAME,
  TOOLBAR_UNGROUP,
} from '@labre/affine-shared/services';

/**
 * The group's own seed: the default title a newly created group is stamped
 * with (`Group 2`), written into the document at creation
 * (`createGroupCommand`). Resolved at PLACEMENT and never again — a group
 * renamed by its author keeps its name, and a group created before this key
 * existed keeps the plain text it was given.
 *
 * `{{n}}` is the group's 1-based ordinal among the groups already on the doc;
 * see the translation-service README on why a count carries a param rather
 * than its own key.
 */
export const GROUP_SEED_NAME: ChromeWording = [
  'com.labre.group.seed.name',
  'Group {{n}}',
];

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
