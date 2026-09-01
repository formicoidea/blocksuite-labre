/**
 * The editor's own chrome wordings, as `[key, fallback]` pairs.
 *
 * ## Why they are a table and not forty literals
 *
 * "Copy", "Delete", "Card view" are the SAME word on a dozen toolbars — the
 * bookmark's, the image's, the embed's, the linked doc's — and a literal per
 * call site is a wording a host has to translate a dozen times and can get
 * twelve different answers for. One pair per word, imported where it is
 * rendered, is what makes the manifest's promise ("every key the library can
 * ask for") describe a list a human can actually word.
 *
 * ## The tuple shape is load-bearing
 *
 * `translateKey(std, ...COPY)` spreads into `(std, key, fallback)`, so a call
 * site names the wording once and cannot pair the wrong fallback with the right
 * key. It is also what
 * `packages/affine/all/src/__tests__/translations/manifest.unit.spec.ts` reads:
 * the two adjacent literals below are the pair its drift check confirms the
 * manifest against, which is why the wordings live in literals here rather than
 * being derived from anything.
 *
 * Chrome, so every one of them ships an English default: a standalone
 * playground with no `TranslationProvider` registered must read exactly as it
 * did before these keys existed.
 */

/** A wording the library can ask the host for: its key, and its English default. */
export type ChromeWording = readonly [key: string, fallback: string];

/* ── Toasts ───────────────────────────────────────────────────────────── */

/**
 * The transient messages the editor puts on screen after a gesture.
 *
 * They were the last English strings left in a fully translated host (#182):
 * silent while nobody injected a `NotificationProvider`, and English in the
 * middle of a French UI the moment somebody did.
 */
export const TOAST_COPIED_TO_CLIPBOARD: ChromeWording = [
  'com.labre.toast.copied-to-clipboard',
  'Copied to clipboard',
];

export const TOAST_LINKED_DOC_CREATED: ChromeWording = [
  'com.labre.toast.linked-doc-created',
  'Linked doc created',
];

export const TOAST_NOTE_REMOVED_FROM_PAGE: ChromeWording = [
  'com.labre.toast.note-removed-from-page-mode',
  'Note removed from Page Mode',
];

export const TOAST_FRAME_INSERTED_INTO_PAGE: ChromeWording = [
  'com.labre.toast.frame-inserted-into-page',
  'Frame inserted into Page.',
];

export const TOAST_NO_LINK_FOUND: ChromeWording = [
  'com.labre.toast.no-link-found',
  'No link found',
];

/* ── Toolbars and menus ───────────────────────────────────────────────── */

export const TOOLBAR_BRING_TO_FRONT: ChromeWording = [
  'com.labre.toolbar.bring-to-front',
  'Bring to Front',
];

export const TOOLBAR_SEND_TO_BACK: ChromeWording = [
  'com.labre.toolbar.send-to-back',
  'Send to Back',
];

export const TOOLBAR_COPY: ChromeWording = ['com.labre.toolbar.copy', 'Copy'];

export const TOOLBAR_DUPLICATE: ChromeWording = [
  'com.labre.toolbar.duplicate',
  'Duplicate',
];

export const TOOLBAR_DELETE: ChromeWording = [
  'com.labre.toolbar.delete',
  'Delete',
];

export const TOOLBAR_LOCK: ChromeWording = ['com.labre.toolbar.lock', 'Lock'];

export const TOOLBAR_MORE: ChromeWording = ['com.labre.toolbar.more', 'More'];

export const TOOLBAR_LINK: ChromeWording = ['com.labre.toolbar.link', 'Link'];

export const TOOLBAR_CREATE_LINKED_DOC: ChromeWording = [
  'com.labre.toolbar.create-linked-doc',
  'Create linked doc',
];

export const TOOLBAR_DRAW_CONNECTOR: ChromeWording = [
  'com.labre.toolbar.draw-connector',
  'Draw connector',
];

/**
 * The four wordings of the view switcher — the control that decides whether a
 * link is drawn as words, as a card or as the document itself.
 *
 * One set for every block that offers it (bookmark, attachment, embed, linked
 * doc, synced doc, iframe, the inline link and the inline reference): they are
 * one control with one vocabulary, and a host that had to word "Card view"
 * eight times would end up with eight wordings of it.
 */
export const TOOLBAR_SWITCH_VIEW: ChromeWording = [
  'com.labre.toolbar.switch-view',
  'Switch view',
];

export const TOOLBAR_INLINE_VIEW: ChromeWording = [
  'com.labre.toolbar.inline-view',
  'Inline view',
];

export const TOOLBAR_CARD_VIEW: ChromeWording = [
  'com.labre.toolbar.card-view',
  'Card view',
];

export const TOOLBAR_EMBED_VIEW: ChromeWording = [
  'com.labre.toolbar.embed-view',
  'Embed view',
];

/* ── What a linked-doc card says instead of a preview ─────────────────── */

/**
 * The four states a linked-doc card can be in with nothing to show: deleted,
 * unreadable, empty, and — for the SYNCED card, which frames a page rather
 * than a doc — empty in its own words.
 *
 * All four and not only the two the recette caught (#183): they are one
 * sentence rendered by one ternary, and translating half of it would leave a
 * card that changes language when the document it points at goes missing.
 */
export const LINKED_DOC_DELETED: ChromeWording = [
  'com.labre.embed.linked-doc.deleted',
  'This linked doc is deleted.',
];

export const LINKED_DOC_FAILED: ChromeWording = [
  'com.labre.embed.linked-doc.failed',
  'This linked doc failed to load.',
];

export const LINKED_DOC_EMPTY_PREVIEW: ChromeWording = [
  'com.labre.embed.linked-doc.empty-preview',
  'Preview of the doc will be displayed here.',
];

export const SYNCED_DOC_EMPTY_PREVIEW: ChromeWording = [
  'com.labre.embed.synced-doc.empty-preview',
  'Preview of the page will be displayed here.',
];

/* ── The board toolbars every framework shares ────────────────────────── */

/**
 * The resize toggle, which is the one entry EVERY framework board carries —
 * Wardley, BPMN, C4, EDGY, Cynefin, Estuarine and the two DDD boards all
 * register the same always-on button (`docs/adr/0009`: a stored board must stay
 * usable with its framework switched off).
 *
 * Declared here rather than once per framework because it is not a framework's
 * own word: it names a behaviour of the generic frame primitive, and eight
 * copies of it in eight manifests would be eight keys for one tooltip.
 */
export const BOARD_RESIZE_TOGGLE: ChromeWording = [
  'com.labre.board.toolbar.resize-toggle',
  'Enable / lock resizing',
];

/**
 * The legend button, in the two wordings the boards actually use: the notation
 * boards say "notation", Wardley says "components".
 *
 * Two keys and not one interpolated sentence, for the reason the interchange
 * counts already ran on — the seam has no interpolation, so the smallest honest
 * unit is the whole sentence.
 */
export const BOARD_LEGEND_NOTATION: ChromeWording = [
  'com.labre.board.toolbar.legend',
  'Generate the legend (notation present)',
];

export const BOARD_LEGEND_COMPONENTS: ChromeWording = [
  'com.labre.board.toolbar.legend.components',
  'Generate the legend (components present)',
];

/**
 * Every wording declared above, in declaration order.
 *
 * The manifest (`@labre/affine/translations`) walks this instead of restating
 * the pairs, so a wording added here reaches a host's catalogue with no second
 * edit — the same "declared data, not restated data" rule the roles, the rules
 * and the commands already follow.
 */
export const CHROME_WORDINGS: readonly ChromeWording[] = [
  TOAST_COPIED_TO_CLIPBOARD,
  TOAST_LINKED_DOC_CREATED,
  TOAST_NOTE_REMOVED_FROM_PAGE,
  TOAST_FRAME_INSERTED_INTO_PAGE,
  TOAST_NO_LINK_FOUND,
  TOOLBAR_BRING_TO_FRONT,
  TOOLBAR_SEND_TO_BACK,
  TOOLBAR_COPY,
  TOOLBAR_DUPLICATE,
  TOOLBAR_DELETE,
  TOOLBAR_LOCK,
  TOOLBAR_MORE,
  TOOLBAR_LINK,
  TOOLBAR_CREATE_LINKED_DOC,
  TOOLBAR_DRAW_CONNECTOR,
  TOOLBAR_SWITCH_VIEW,
  TOOLBAR_INLINE_VIEW,
  TOOLBAR_CARD_VIEW,
  TOOLBAR_EMBED_VIEW,
  LINKED_DOC_DELETED,
  LINKED_DOC_FAILED,
  LINKED_DOC_EMPTY_PREVIEW,
  SYNCED_DOC_EMPTY_PREVIEW,
  BOARD_RESIZE_TOGGLE,
  BOARD_LEGEND_NOTATION,
  BOARD_LEGEND_COMPONENTS,
];
