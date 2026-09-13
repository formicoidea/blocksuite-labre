import {
  type ChromeWording,
  NEW_DOC_LABEL,
} from '@labre/affine-shared/services';

/* ── The linked-doc embed's own slash-menu items ─────────────────────────
 * (`embed-linked-doc-block/configs/slash-menu.ts`)
 */

export const EMBED_DOC_SLASH_NEW_DOC_NAME = NEW_DOC_LABEL;

export const EMBED_DOC_SLASH_NEW_DOC_DESCRIPTION: ChromeWording = [
  'com.labre.embed-doc.slash.new-doc.description',
  'Start a new document.',
];

export const EMBED_DOC_SLASH_LINKED_DOC_NAME: ChromeWording = [
  'com.labre.embed-doc.slash.linked-doc.name',
  'Linked Doc',
];

/** The tooltip's own word — distinct from the item's name above. */
export const EMBED_DOC_SLASH_LINKED_DOC_CAPTION: ChromeWording = [
  'com.labre.embed-doc.slash.linked-doc.caption',
  'Link Doc',
];

export const EMBED_DOC_SLASH_LINKED_DOC_DESCRIPTION: ChromeWording = [
  'com.labre.embed-doc.slash.linked-doc.description',
  'Link to another document.',
];

/* ── Toolbar chrome shared by the linked-doc and synced-doc toolbars ───── */

/**
 * The "Open doc" dropdown button — its own `aria-label`/`tooltip` AND the
 * dropdown's single entry label, in both `embed-linked-doc-block/configs/toolbar.ts`
 * and `embed-synced-doc-block/configs/toolbar.ts`.
 */
export const EMBED_DOC_OPEN_DOC: ChromeWording = [
  'com.labre.embed-doc.toolbar.open-doc',
  'Open doc',
];

/** The card's "last updated" date label (`components/embed-synced-doc-card.ts`, `embed-linked-doc-block.ts`). */
export const EMBED_DOC_UPDATED_LABEL: ChromeWording = [
  'com.labre.embed-doc.card.updated',
  'Updated',
];

export const EMBED_DOC_INSERT_TO_PAGE: ChromeWording = [
  'com.labre.embed-doc.toolbar.insert-to-page',
  'Insert to page',
];

export const EMBED_DOC_DUPLICATE_AS_NOTE: ChromeWording = [
  'com.labre.embed-doc.toolbar.duplicate-as-note',
  'Duplicate as note',
];

export const EMBED_DOC_DUPLICATE_AS_NOTE_TOOLTIP: ChromeWording = [
  'com.labre.embed-doc.toolbar.duplicate-as-note.tooltip',
  'Duplicate as note to create an editable copy, the original remains unchanged.',
];

/**
 * The nested-editor empty state — the exact same sentence in both the page
 * and the edgeless synced-doc view (`embed-synced-doc-block.ts`,
 * `embed-edgeless-synced-doc-block.ts`).
 */
export const EMBED_DOC_CARD_EMPTY_CONTENT: ChromeWording = [
  'com.labre.embed-doc.card.empty-content',
  'This is a linked doc, you can add content here.',
];

/**
 * This package's contribution to the translation-key manifest, listed in
 * `PACKAGE_WORDINGS` under source `chrome`
 * (`packages/affine/all/src/translations.ts`). The shared verbs it reuses
 * (Caption, Reload, Loading…, Untitled, the card-style switcher's four
 * wordings, Open this doc…) travel with `@labre/affine-shared/services`
 * instead, so they are not restated here.
 *
 * The three export adapters' own "untitled" fallback
 * (`adapters/html.ts`/`markdown.ts`/`plain-text.ts`) is deliberately left
 * untouched: per the L2b lot's changeset, the paste/import pipeline's
 * `Transformer` carries an optional `provider` that is never wired to the
 * editor's `TranslationProvider` by any existing caller, so resolving a key
 * there would be dead code, not a real translation path.
 */
export const EMBED_DOC_WORDINGS: readonly ChromeWording[] = [
  EMBED_DOC_SLASH_NEW_DOC_DESCRIPTION,
  EMBED_DOC_SLASH_LINKED_DOC_NAME,
  EMBED_DOC_SLASH_LINKED_DOC_CAPTION,
  EMBED_DOC_SLASH_LINKED_DOC_DESCRIPTION,
  EMBED_DOC_OPEN_DOC,
  EMBED_DOC_UPDATED_LABEL,
  EMBED_DOC_INSERT_TO_PAGE,
  EMBED_DOC_DUPLICATE_AS_NOTE,
  EMBED_DOC_DUPLICATE_AS_NOTE_TOOLTIP,
  EMBED_DOC_CARD_EMPTY_CONTENT,
];
