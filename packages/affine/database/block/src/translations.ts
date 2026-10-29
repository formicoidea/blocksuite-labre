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

export const DATABASE_WORDINGS: readonly ChromeWording[] = [
  DATABASE_CREATION_TITLE,
  DATABASE_NEW_RECORD_MORE,
  DATABASE_SOURCE_MISSING,
  DATABASE_SOURCE_MISSING_HINT,
  DATABASE_SOURCE_REQUIRED,
  DATABASE_SOURCE_REQUIRED_HINT,
  DATABASE_SOURCE_REQUIRED_READ_ONLY,
  DATABASE_VALUES_ERROR,
  DATABASE_VALUES_LOADING,
];
