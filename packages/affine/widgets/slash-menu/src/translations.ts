import {
  type ChromeWording,
  TOOLBAR_COPY,
  TOOLBAR_DELETE,
  TOOLBAR_DUPLICATE,
  TOOLBAR_MOVE_DOWN,
  TOOLBAR_MOVE_UP,
} from '@labre/affine-shared/services';

/**
 * The slash menu's own wordings — one `ChromeWording` per static config
 * literal (`name`, `description`, a tooltip's `caption`) that
 * `defaultSlashMenuConfig` (`./config.ts`) and `slashMenuToolTips`
 * (`./tooltips/index.ts`) render, plus one per group header the widget draws
 * itself (`./config.ts`'s own `Date` and `Actions` groups).
 *
 * This is the DEMONSTRATOR of the "static config rendered by a widget"
 * pattern (`packages/affine/shared/src/services/translation-service/README.md`):
 * the toolbar precedent resolves `labelWording` / `tooltipWording` in
 * `combine`; the slash menu resolves `nameWording` / `descriptionWording` /
 * `captionWording` in `slash-menu-popover.ts`, at render.
 *
 * Only the items THIS package declares are converted here — every other
 * package's `configs/slash-menu.ts` keeps its own English literals until its
 * own lot converts them, and registers its own table the same way.
 */

/* ── Date group ───────────────────────────────────────────────────────────
 * One wording each: the item's `name` and its tooltip's `caption` say the
 * exact same word ("Today" names the item AND captions its illustration), so
 * one key serves both — the "un mot partagé = une clé" rule applied within a
 * single item rather than across items.
 */

export const SLASH_MENU_TODAY: ChromeWording = [
  'com.labre.slash-menu.date.today',
  'Today',
];

export const SLASH_MENU_TOMORROW: ChromeWording = [
  'com.labre.slash-menu.date.tomorrow',
  'Tomorrow',
];

export const SLASH_MENU_YESTERDAY: ChromeWording = [
  'com.labre.slash-menu.date.yesterday',
  'Yesterday',
];

export const SLASH_MENU_NOW: ChromeWording = [
  'com.labre.slash-menu.date.now',
  'Now',
];

/* ── Actions group ─────────────────────────────────────────────────────── */

/**
 * "Move Up" and "Move Down" are shared with the note block's own move-up/down
 * hotkey config (`packages/affine/blocks/note/src/move-block.ts`) — both this
 * package and `blocks/note` are owned by the same lot, so the word moved to
 * `chrome.ts` (`TOOLBAR_MOVE_UP` / `TOOLBAR_MOVE_DOWN`) rather than being
 * declared here and reused there.
 */
export const SLASH_MENU_MOVE_UP = TOOLBAR_MOVE_UP;
export const SLASH_MENU_MOVE_DOWN = TOOLBAR_MOVE_DOWN;

export const SLASH_MENU_MOVE_UP_DESCRIPTION: ChromeWording = [
  'com.labre.slash-menu.actions.move-up.description',
  'Shift this line up.',
];

export const SLASH_MENU_MOVE_DOWN_DESCRIPTION: ChromeWording = [
  'com.labre.slash-menu.actions.move-down.description',
  'Shift this line down.',
];

/**
 * "Copy", "Duplicate" and "Delete" are the editor's shared verbs, already
 * declared once for every toolbar in `chrome.ts`: one word, one key.
 */
export const SLASH_MENU_COPY = TOOLBAR_COPY;
export const SLASH_MENU_DUPLICATE = TOOLBAR_DUPLICATE;
export const SLASH_MENU_DELETE = TOOLBAR_DELETE;

export const SLASH_MENU_COPY_DESCRIPTION: ChromeWording = [
  'com.labre.slash-menu.actions.copy.description',
  'Copy this line to clipboard.',
];

export const SLASH_MENU_DUPLICATE_DESCRIPTION: ChromeWording = [
  'com.labre.slash-menu.actions.duplicate.description',
  'Create a duplicate of this line.',
];

/**
 * The tooltip Copy and Duplicate share (`config.ts` points both items at
 * `slashMenuToolTips['Copy']`): one caption, one key, reused by both items —
 * exactly the case `CHROME_WORDINGS`' own doc comment describes.
 */
export const SLASH_MENU_COPY_DUPLICATE_CAPTION: ChromeWording = [
  'com.labre.slash-menu.actions.copy-duplicate.caption',
  'Copy / Duplicate',
];

export const SLASH_MENU_DELETE_DESCRIPTION: ChromeWording = [
  'com.labre.slash-menu.actions.delete.description',
  'Remove this line permanently.',
];

/* ── Group headers ─────────────────────────────────────────────────────── */

/**
 * One `ChromeWording` per group header the slash menu can draw — a closed
 * set inventoried across every `configs/slash-menu.ts` in the repo (`group:
 * '<n>_<Name>@<i>'`, the `<Name>` between `_` and `@`):
 *
 * - `Basic` — callout, latex, note (paragraph/heading/list/quote/divider).
 * - `Content & Media` — attachment, bookmark, image, latex, the generic embed
 *   (iframe) block, and (postponed, `blocks/table`) table.
 * - `Page` — the linked-doc embed block.
 * - `Edgeless Element` — surface-ref.
 * - `Date`, `Actions` — this package's own groups (`./config.ts`).
 *
 * NOT included: `Database`, used only by the postponed `blocks/database` and
 * `blocks/data-view` — the PO's decision excludes those surfaces, and
 * `Database` has no other user today. A framework or a later lot that adds a
 * group name not in this table is unaffected: `slashMenuGroupWording` returns
 * `undefined` and the header renders the raw group name, same as before any
 * of this existed.
 */
export const SLASH_MENU_GROUP_BASIC: ChromeWording = [
  'com.labre.slash-menu.group.basic',
  'Basic',
];

export const SLASH_MENU_GROUP_CONTENT_MEDIA: ChromeWording = [
  'com.labre.slash-menu.group.content-media',
  'Content & Media',
];

export const SLASH_MENU_GROUP_PAGE: ChromeWording = [
  'com.labre.slash-menu.group.page',
  'Page',
];

export const SLASH_MENU_GROUP_EDGELESS_ELEMENT: ChromeWording = [
  'com.labre.slash-menu.group.edgeless-element',
  'Edgeless Element',
];

export const SLASH_MENU_GROUP_DATE: ChromeWording = [
  'com.labre.slash-menu.group.date',
  'Date',
];

export const SLASH_MENU_GROUP_ACTIONS: ChromeWording = [
  'com.labre.slash-menu.group.actions',
  'Actions',
];

/** The group table, keyed by the raw group name `parseGroup` extracts. */
const SLASH_MENU_GROUP_WORDINGS: Readonly<Record<string, ChromeWording>> = {
  Basic: SLASH_MENU_GROUP_BASIC,
  'Content & Media': SLASH_MENU_GROUP_CONTENT_MEDIA,
  Page: SLASH_MENU_GROUP_PAGE,
  'Edgeless Element': SLASH_MENU_GROUP_EDGELESS_ELEMENT,
  Date: SLASH_MENU_GROUP_DATE,
  Actions: SLASH_MENU_GROUP_ACTIONS,
};

/**
 * The wording for a group header, or `undefined` for a group name outside the
 * closed set above — rendered raw, same as before this table existed.
 */
export function slashMenuGroupWording(
  groupName: string
): ChromeWording | undefined {
  return SLASH_MENU_GROUP_WORDINGS[groupName];
}

/**
 * Every wording declared above, in declaration order — walked by
 * `PACKAGE_WORDINGS` in `packages/affine/all/src/translations.ts` rather than
 * restated there.
 *
 * `SLASH_MENU_MOVE_UP` / `_MOVE_DOWN` (aliases of the chrome table's
 * `TOOLBAR_MOVE_UP` / `_MOVE_DOWN`) are deliberately NOT listed here, exactly
 * like `SLASH_MENU_COPY` / `_DUPLICATE` / `_DELETE` above: an alias is walked
 * once, from `CHROME_WORDINGS`, and listing it again here would offer a host
 * the same key twice.
 */
export const SLASH_MENU_WORDINGS: readonly ChromeWording[] = [
  SLASH_MENU_TODAY,
  SLASH_MENU_TOMORROW,
  SLASH_MENU_YESTERDAY,
  SLASH_MENU_NOW,
  SLASH_MENU_MOVE_UP_DESCRIPTION,
  SLASH_MENU_MOVE_DOWN_DESCRIPTION,
  SLASH_MENU_COPY_DESCRIPTION,
  SLASH_MENU_DUPLICATE_DESCRIPTION,
  SLASH_MENU_COPY_DUPLICATE_CAPTION,
  SLASH_MENU_DELETE_DESCRIPTION,
  SLASH_MENU_GROUP_BASIC,
  SLASH_MENU_GROUP_CONTENT_MEDIA,
  SLASH_MENU_GROUP_PAGE,
  SLASH_MENU_GROUP_EDGELESS_ELEMENT,
  SLASH_MENU_GROUP_DATE,
  SLASH_MENU_GROUP_ACTIONS,
];
