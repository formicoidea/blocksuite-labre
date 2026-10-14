import type { ChromeWording } from '@labre/affine-shared/services';
import type { TranslationKeyManifestEntry } from '@labre/std';

/* ── The properties panel (ADR 0035 §9b, issue B10) ────────────────────── */

export const PROPERTIES_PANEL_TITLE: ChromeWording = [
  'com.labre.database.properties-panel.title',
  'Properties',
];

/** The panel's "Show all" over the view's hidden properties. */
export const PROPERTIES_PANEL_SHOW_ALL: ChromeWording = [
  'com.labre.database.properties-panel.show-all',
  'Show all',
];

export const PROPERTIES_PANEL_HIDE_ALL: ChromeWording = [
  'com.labre.database.properties-panel.hide-all',
  'Hide all',
];

/** The panel names a database this editor does not show (yet). */
export const PROPERTIES_PANEL_UNAVAILABLE: ChromeWording = [
  'com.labre.database.properties-panel.unavailable',
  'This database is not shown on the page.',
];

/**
 * The same word on the same kind of side panel as the catalogue's and the
 * selection pane's "Close": one chrome word, one key, declared once by the
 * catalogue, so not listed below.
 */
export const PROPERTIES_PANEL_CLOSE: ChromeWording = [
  'com.labre.catalogue.close',
  'Close',
];

/* ── The data-source picker (ADR 0035 §9c, issue B12) ──────────────────── */

export const PICKER_TITLE: ChromeWording = [
  'com.labre.database.picker.title',
  'Choose a source',
];

export const PICKER_NEW_SOURCE: ChromeWording = [
  'com.labre.database.picker.new-source',
  'New source',
];

export const PICKER_NEW_DATABASE: ChromeWording = [
  'com.labre.database.picker.new-database',
  'New database',
];

/** The picker on a host that lists no database and creates none. */
export const PICKER_EMPTY: ChromeWording = [
  'com.labre.database.picker.empty',
  'No database to show',
];

export const SLASH_LINKED_VIEW: ChromeWording = [
  'com.labre.database.slash.linked-view',
  'Linked view of a database',
];

export const SLASH_LINKED_VIEW_DESCRIPTION: ChromeWording = [
  'com.labre.database.slash.linked-view.description',
  'Show a view of an existing database.',
];

const DATABASE_EDITOR_WORDINGS: readonly ChromeWording[] = [
  PICKER_EMPTY,
  PICKER_NEW_DATABASE,
  PICKER_NEW_SOURCE,
  PICKER_TITLE,
  PROPERTIES_PANEL_HIDE_ALL,
  PROPERTIES_PANEL_SHOW_ALL,
  PROPERTIES_PANEL_TITLE,
  PROPERTIES_PANEL_UNAVAILABLE,
  SLASH_LINKED_VIEW,
  SLASH_LINKED_VIEW_DESCRIPTION,
];

/**
 * This package's `com.labre.database.*` wordings, exported from the package
 * root as a framework exports its `…TranslationEntries`: the umbrella lists
 * them in `EDITOR_TRANSLATION_GROUPS` (`packages/affine/all/src/translations.ts`),
 * the bundle script strips that group from core's copy, and a host that
 * installs `@formicoidea/labre-core-database` composes them with core's
 * manifest. Each wording joins this list as it is drawn.
 */
export const databaseEditorTranslationEntries: readonly TranslationKeyManifestEntry[] =
  DATABASE_EDITOR_WORDINGS.map(([key, fallback]) => ({
    key,
    fallback,
    source: 'chrome' as const,
  }));
