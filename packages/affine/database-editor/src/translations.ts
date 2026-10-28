import {
  type ChromeWording,
  SAVE_AS_TEMPLATE,
} from '@labre/affine-shared/services';
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

/** The third entry: copy a view of another database (labre REQ-DB-2). */
export const DATABASE_ADD_VIEW_IMPORT: ChromeWording = [
  'com.labre.database.add-view.import',
  'Import a view from another database',
];

/* ── The full-page database host (ADR 0035 §1, B13) ───────────────────── */

/** The document has no block by the id the host named as the views' host. */
export const DATABASE_PAGE_HOST_MISSING: ChromeWording = [
  'com.labre.database.page.host-missing',
  'This database has no views to show.',
];

/* ── The full page's view-menu commands (labre REQ-DB-10) ───────────── */

/**
 * "Layout" and "Group" are the view settings' own entries too: declared once
 * by `@labre/data-view` (`DATA_VIEW_LAYOUT`, `DATA_VIEW_GROUP`), restated
 * here, so not listed below.
 */
export const VIEW_MENU_LAYOUT: ChromeWording = [
  'com.labre.database.view-menu.layout',
  'Layout',
];

export const VIEW_MENU_GROUP: ChromeWording = [
  'com.labre.database.view-menu.group',
  'Group',
];

/**
 * The view settings' own entry (`DATA_VIEW_OPEN_IN`): one chrome word, one
 * key, declared once by `@labre/data-view`, so not listed below. "Properties"
 * is the panel title for the same reason (`PROPERTIES_PANEL_TITLE`).
 */
export const VIEW_MENU_OPEN_IN: ChromeWording = [
  'com.labre.data-view.open-in',
  'Open pages in',
];

/**
 * "Conditional colors" (ADR 0036): the view settings' own entry
 * (`DATA_VIEW_COLOR_RULES`), one chrome word, one key, declared once by
 * `@labre/data-view`, so not listed below.
 */
export const VIEW_MENU_COLOR_RULES: ChromeWording = [
  'com.labre.data-view.color-rules',
  'Conditional colors',
];

/** Shared with the frame toolbar: one chrome word, one key (`SAVE_AS_TEMPLATE`). */
export const VIEW_MENU_SAVE_TEMPLATE = SAVE_AS_TEMPLATE;

export const VIEW_MENU_IMPORT: ChromeWording = [
  'com.labre.database.view-menu.import',
  'Import a view…',
];

/* ── A view's source (ADR 0035 amendment of 2026-10-28) ───────────────── */

/**
 * The view settings' "Source" and the full page's `database.view.source`:
 * one chrome word, one key. Its menu reuses the picker's words
 * (`PICKER_TITLE`, `PICKER_NEW_SOURCE`) and an untitled source reads
 * `DATABASE_ADD_VIEW_UNTITLED_SOURCE`.
 */
export const VIEW_SETTINGS_SOURCE: ChromeWording = [
  'com.labre.database.view-settings.source',
  'Source',
];

/* ── The properties panel (ADR 0035 §9b, issue B10) ────────────────────── */

/**
 * Declared once by `@labre/data-view` (`DATA_VIEW_PROPERTIES`, the list's own
 * title, in its view options popover too), so not listed below. Restated, not
 * imported: this bundle imports core alone (`core-database-boundary`).
 */
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
  DATABASE_ADD_VIEW_EXISTING_SOURCE,
  DATABASE_ADD_VIEW_IMPORT,
  DATABASE_ADD_VIEW_NEW_SOURCE,
  DATABASE_ADD_VIEW_UNTITLED_SOURCE,
  DATABASE_PAGE_HOST_MISSING,
  PICKER_EMPTY,
  PICKER_NEW_DATABASE,
  PICKER_NEW_SOURCE,
  PICKER_TITLE,
  PROPERTIES_PANEL_HIDE_ALL,
  PROPERTIES_PANEL_SHOW_ALL,
  PROPERTIES_PANEL_UNAVAILABLE,
  SLASH_LINKED_VIEW,
  SLASH_LINKED_VIEW_DESCRIPTION,
  VIEW_MENU_IMPORT,
  VIEW_SETTINGS_SOURCE,
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
