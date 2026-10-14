import type { ChromeWording } from '@labre/affine-shared/services';
import type { TranslationKeyManifestEntry } from '@labre/std';

/* ── "+ view" (ADR 0035 §1, §9c, B11; labre ADR-0046 §5) ──────────────── */

/** The entry that lists the sources the database's views already read. */
export const DATABASE_ADD_VIEW_EXISTING_SOURCE: ChromeWording = [
  'com.labre.database.add-view.existing-source',
  'On an existing source',
];

/** The entry that asks the host for a new source and adds a table on it. */
export const DATABASE_ADD_VIEW_NEW_SOURCE: ChromeWording = [
  'com.labre.database.add-view.new-source',
  'With a new source',
];

/** A source whose schema block has an empty title. */
export const DATABASE_ADD_VIEW_UNTITLED_SOURCE: ChromeWording = [
  'com.labre.database.add-view.untitled-source',
  'Untitled source',
];

/* ── The full-page database host (ADR 0035 §1, B13) ───────────────────── */

/** The document has no block by the id the host named as the views' host. */
export const DATABASE_PAGE_HOST_MISSING: ChromeWording = [
  'com.labre.database.page.host-missing',
  'This database has no views to show.',
];

const DATABASE_EDITOR_WORDINGS: readonly ChromeWording[] = [
  DATABASE_ADD_VIEW_EXISTING_SOURCE,
  DATABASE_ADD_VIEW_NEW_SOURCE,
  DATABASE_ADD_VIEW_UNTITLED_SOURCE,
  DATABASE_PAGE_HOST_MISSING,
];

/**
 * This package's `com.labre.database.*` wordings, exported from the package
 * root as a framework exports its `…TranslationEntries`: the umbrella lists
 * them in `EDITOR_TRANSLATION_GROUPS` (`packages/affine/all/src/translations.ts`),
 * the bundle script strips that group from core's copy, and a host that
 * installs `@formicoidea/labre-core-database` composes them with core's
 * manifest.
 */
export const databaseEditorTranslationEntries: readonly TranslationKeyManifestEntry[] =
  DATABASE_EDITOR_WORDINGS.map(([key, fallback]) => ({
    key,
    fallback,
    source: 'chrome' as const,
  }));
