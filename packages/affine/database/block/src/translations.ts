import type { ChromeWording } from '@labre/affine-shared/services';

/* ── A hosted source (ADR 0035 §7, issue B1) ───────────────────────────── */

/** Drawn in place of a view whose `sourceId` the host cannot resolve. */
export const DATABASE_SOURCE_MISSING: ChromeWording = [
  'com.labre.database.source-missing',
  'Source not found',
];

export const DATABASE_SOURCE_MISSING_HINT: ChromeWording = [
  'com.labre.database.source-missing.hint',
  'The source this view reads was deleted or cannot be reached. Pick another view.',
];

/**
 * Drawn in place of a database that waits for its source, when the host
 * requires one (`requireSource`, ADR 0035 amendment of 2026-10-29).
 */
export const DATABASE_SOURCE_REQUIRED: ChromeWording = [
  'com.labre.database.source-required',
  'No source connected',
];

export const DATABASE_SOURCE_REQUIRED_HINT: ChromeWording = [
  'com.labre.database.source-required.hint',
  'Connect a source to show its rows here.',
];

/** Over native rows shown read-only, under the same host. */
export const DATABASE_SOURCE_REQUIRED_READ_ONLY: ChromeWording = [
  'com.labre.database.source-required.read-only',
  'This table has no source: its rows are read-only.',
];

/**
 * The creation popover's title (`@labre/affine-database-editor`) and the
 * button of a database waiting for its source: one chrome word, one key,
 * declared in core, the lowest reader.
 */
export const DATABASE_CREATION_TITLE: ChromeWording = [
  'com.labre.database.creation.title',
  'Connect a source',
];

/* ── Turning a table into a source (ADR 0035, amendment of 2026-10-29) ── */

/** Over native rows shown read-only: moves them into a new host database. */
export const DATABASE_MOVE_INTO_SOURCE: ChromeWording = [
  'com.labre.database.turn-into.move',
  'Move into a database',
];

export const DATABASE_TURN_INTO_FAILED: ChromeWording = [
  'com.labre.database.turn-into.failed',
  'The table could not be created. Nothing was changed.',
];

export const DATABASE_TURN_INTO_NESTED: ChromeWording = [
  'com.labre.database.turn-into.nested',
  'Rows with nested blocks cannot be moved here. Nothing was changed.',
];

/* ── Cell hydration (ADR 0035 §9e, issue B2) ───────────────────────────── */

/** After 3 s of loading (`VALUES_SLOW_AFTER_MS`). */
export const DATABASE_VALUES_LOADING: ChromeWording = [
  'com.labre.database.values.loading',
  'Values are still loading…',
];

export const DATABASE_VALUES_ERROR: ChromeWording = [
  'com.labre.database.values.error',
  'Values could not be loaded. Nothing was changed.',
];

// Retry is the resource status's own word (`RESOURCE_STATUS_RETRY`,
// `@labre/affine-components/translations`): one chrome word, one key.

/* ── The host menu beside "New" (ADR 0035, amendment of 2026-10-14) ──── */

/** The chevron beside "New", as its label and tooltip. */
export const DATABASE_NEW_RECORD_MORE: ChromeWording = [
  'com.labre.database.new-record.more',
  'Templates and options',
];

/* ── Database chrome keyed at the recette of 1.1 (#572) ── */

export const DATABASE_TYPE_CREATED_TIME: ChromeWording = [
  'com.labre.database.property-type.created-time',
  'Created Time',
];

export const DATABASE_TYPE_LINK: ChromeWording = [
  'com.labre.database.property-type.link',
  'Link',
];

export const DATABASE_TYPE_TEXT: ChromeWording = [
  'com.labre.database.property-type.text',
  'Text',
];

export const DATABASE_TYPE_TITLE: ChromeWording = [
  'com.labre.database.property-type.title',
  'Title',
];

export const DATABASE_SLASH_TABLE_DESCRIPTION: ChromeWording = [
  'com.labre.database.slash.table.description',
  'Display items in a table format.',
];

export const DATABASE_SLASH_KANBAN_DESCRIPTION: ChromeWording = [
  'com.labre.database.slash.kanban.description',
  'Visualize data in a dashboard.',
];

export const DATABASE_TITLE_LABEL: ChromeWording = [
  'com.labre.database.title.label',
  'Database title',
];

export const DATABASE_DELETE: ChromeWording = [
  'com.labre.database.delete',
  'Delete Database',
];

export const DATABASE_DRAG_PREVIEW: ChromeWording = [
  'com.labre.database.drag-preview',
  'Database Block',
];

export const DATABASE_DETAIL_EMPTY_HINT: ChromeWording = [
  'com.labre.database.detail.empty-hint',
  'Click to create a linked doc in center peek.',
];

/* ── The data-view block's slash entry ── */

export const DATABASE_SLASH_TODO: ChromeWording = [
  'com.labre.database.slash.todo',
  'Todo',
];

export const DATABASE_WORDINGS: readonly ChromeWording[] = [
  DATABASE_CREATION_TITLE,
  DATABASE_MOVE_INTO_SOURCE,
  DATABASE_NEW_RECORD_MORE,
  DATABASE_SOURCE_MISSING,
  DATABASE_SOURCE_MISSING_HINT,
  DATABASE_SOURCE_REQUIRED,
  DATABASE_SOURCE_REQUIRED_HINT,
  DATABASE_SOURCE_REQUIRED_READ_ONLY,
  DATABASE_TURN_INTO_FAILED,
  DATABASE_TURN_INTO_NESTED,
  DATABASE_VALUES_ERROR,
  DATABASE_VALUES_LOADING,
  DATABASE_TYPE_CREATED_TIME,
  DATABASE_TYPE_LINK,
  DATABASE_TYPE_TEXT,
  DATABASE_TYPE_TITLE,
  DATABASE_SLASH_TABLE_DESCRIPTION,
  DATABASE_SLASH_KANBAN_DESCRIPTION,
  DATABASE_TITLE_LABEL,
  DATABASE_DELETE,
  DATABASE_DRAG_PREVIEW,
  DATABASE_DETAIL_EMPTY_HINT,
  DATABASE_SLASH_TODO,
];
