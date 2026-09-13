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
 * The two block-reorder verbs of a line-oriented block: the slash menu's own
 * "Actions" group (`packages/affine/widgets/slash-menu`) and the note block's
 * move-up/down hotkey config (`packages/affine/blocks/note/src/move-block.ts`)
 * say the exact same word — one key, shared rather than declared twice.
 */
export const TOOLBAR_MOVE_UP: ChromeWording = [
  'com.labre.toolbar.move-up',
  'Move Up',
];

export const TOOLBAR_MOVE_DOWN: ChromeWording = [
  'com.labre.toolbar.move-down',
  'Move Down',
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

/* ── Note shadow styles ────────────────────────────────────────────────
 * The note block's own shadow options, shared verbatim between the surface
 * toolbar's style panel (blocks/note) and the edgeless senior menu's shadow
 * panel (gfx/note) — five of the six read identically in both; the sixth
 * ("Floating shadow" there, "Floation shadow" here, a pre-existing typo in
 * gfx/note) is kept apart precisely because the fallback must stay the
 * literal on screen, letter for letter.
 */
export const NOTE_SHADOW_NONE: ChromeWording = [
  'com.labre.note.shadow.none',
  'No shadow',
];

export const NOTE_SHADOW_BOX: ChromeWording = [
  'com.labre.note.shadow.box',
  'Box shadow',
];

export const NOTE_SHADOW_STICKER: ChromeWording = [
  'com.labre.note.shadow.sticker',
  'Sticker shadow',
];

export const NOTE_SHADOW_PAPER: ChromeWording = [
  'com.labre.note.shadow.paper',
  'Paper shadow',
];

export const NOTE_SHADOW_FILM: ChromeWording = [
  'com.labre.note.shadow.film',
  'Film shadow',
];

/* ── Documents ────────────────────────────────────────────────────────── */

/**
 * A document with no title, wherever its name is shown instead of one — the
 * "@" menu's linked-doc list AND the outline panel's own preview of a linked
 * doc both say it, hence a shared key rather than a package-local one.
 */
export const DOC_UNTITLED: ChromeWording = [
  'com.labre.doc.untitled',
  'Untitled',
];

/* ── Export / import formats ────────────────────────────────────────────── */

/**
 * File-format names shown by more than one picker (the adapter/debug panel's
 * format selector, the "@" menu's import dialog) — proper nouns the glossary
 * convention keeps in English even in the French proposal.
 */
export const FORMAT_MARKDOWN: ChromeWording = [
  'com.labre.format.markdown',
  'Markdown',
];

export const FORMAT_HTML: ChromeWording = ['com.labre.format.html', 'HTML'];

/* ── Canvas element style ──────────────────────────────────────────────── */

/**
 * The sketch/general toggle every canvas element's style panel offers
 * (shape's border, a framework board's own "trait esquissé" switch) — one
 * pair of words, shared by every drawer of that control rather than declared
 * once per element type.
 */
export const STYLE_GENERAL: ChromeWording = [
  'com.labre.style.general',
  'General',
];

export const STYLE_SCRIBBLED: ChromeWording = [
  'com.labre.style.scribbled',
  'Scribbled',
];

/** The menu label naming that same toggle (shape's, a mindmap's). */
export const STYLE_MENU_LABEL: ChromeWording = [
  'com.labre.style.menu-label',
  'Style',
];

/* ── Font weight / style ────────────────────────────────────────────────── */

/**
 * The three font weights and the one non-default font style a text toolbar
 * offers — said identically by the toolbar's own "current selection" label
 * (`gfx/text`) and by the popup menu that picks them
 * (`widgets/edgeless-toolbar`).
 */
export const FONT_WEIGHT_LIGHT: ChromeWording = [
  'com.labre.font.weight.light',
  'Light',
];

export const FONT_WEIGHT_REGULAR: ChromeWording = [
  'com.labre.font.weight.regular',
  'Regular',
];

export const FONT_WEIGHT_SEMIBOLD: ChromeWording = [
  'com.labre.font.weight.semibold',
  'Semibold',
];

export const FONT_STYLE_ITALIC: ChromeWording = [
  'com.labre.font.style.italic',
  'Italic',
];

/* ── Canvas tool names ──────────────────────────────────────────────────── */

/**
 * A canvas tool's own name, said identically by its senior button, its quick
 * button and the "+" auto-complete panel that offers it as a follow-up —
 * `mindmap`, `shape` and `edgeless-selected-rect` all draw at least one of
 * these from the same table rather than wording a tool's name once per
 * drawer.
 */
export const TOOL_NAME_TEXT: ChromeWording = ['com.labre.tool.text', 'Text'];

export const TOOL_NAME_NOTE: ChromeWording = ['com.labre.tool.note', 'Note'];

export const TOOL_NAME_FRAME: ChromeWording = ['com.labre.tool.frame', 'Frame'];

export const TOOL_NAME_SHAPE: ChromeWording = ['com.labre.tool.shape', 'Shape'];

/**
 * The font-size dropdown's own label — said identically by every text
 * toolbar that offers it (`gfx/text`'s shared `createTextActions`, and
 * `blocks/edgeless-text`'s own scale-driven variant of the same control).
 */
export const FONT_SIZE_LABEL: ChromeWording = [
  'com.labre.font.size-label',
  'Font size',
];

/**
 * The border-style dropdown's own trigger label — rendered identically by
 * `edgeless-shape-color-picker` (`@labre/affine-components`, this lot) and by
 * `edgeless-note-border-dropdown-menu` (`blocks/note`, a different lot): the
 * exact same button on a shape and on a note. Declared here so either can
 * import it rather than one minting a second key for the same word.
 */
export const BOARD_BORDER_STYLE_LABEL: ChromeWording = [
  'com.labre.board.toolbar.border-style',
  'Border style',
];

/**
 * The LaTeX empty-state and KaTeX-error placeholders — rendered identically
 * by the inline equation (`inlines/latex`, this lot) and the LaTeX BLOCK
 * (`blocks/latex`, a different lot): the same two words either way an
 * equation fails to show.
 */
export const EQUATION_EMPTY_LABEL: ChromeWording = [
  'com.labre.latex.equation-empty',
  'Equation',
];
export const EQUATION_ERROR_LABEL: ChromeWording = [
  'com.labre.latex.equation-error',
  'Error equation',
];

/**
 * The untitled-document fallback — `'Untitled'` is scattered across roughly
 * two dozen files repo-wide (adapters, embeds, the outline panel, data-view…),
 * most of them behind `DEFAULT_DOC_NAME` (`shared/src/consts/text.ts`) or
 * `DocDisplayMetaProvider`'s own internal substitution, neither of which this
 * lot owns. Declared here so the ONE call site this lot touches
 * (`inlines/reference/src/reference-node/configs/toolbar.ts`, a defensive
 * fallback for a title `DocDisplayMetaProvider` already never returns empty)
 * has a key, and so a later lot revisiting the others finds one key already
 * waiting rather than a second one to invent.
 */
/** An alias: the same word as {@link DOC_UNTITLED}, one key. */
export const UNTITLED_DOC_LABEL = DOC_UNTITLED;

/* ── Block types ──────────────────────────────────────────────────────── */

/**
 * The text-block primitive names and descriptions — `rich-text/src/conversion.ts`'s
 * `textConversionConfigs`, the ONE list that names "Heading 1", "Bulleted
 * List", "Quote"... for both the slash menu and the format bar's "Turn into"
 * conversion menu.
 *
 * Declared here rather than in `rich-text`'s own `translations.ts` because
 * both `@labre/affine-rich-text` (L6c, this lot) and the text-block packages
 * `blocks/note` / `blocks/paragraph` / `blocks/list` / `widgets/slash-menu`
 * (L6a, a different lot) read the very same words: `conversion.ts` names them
 * once, the slash menu's own config repeats the same name/description for the
 * items it derives from `textConversionConfigs`. One key per word here is what
 * lets both lots point at the SAME constant instead of minting two keys for
 * "Heading 1".
 */
export const BLOCK_TYPE_TEXT: ChromeWording = [
  'com.labre.block-type.text',
  'Text',
];
export const BLOCK_TYPE_TEXT_DESCRIPTION: ChromeWording = [
  'com.labre.block-type.text.description',
  'Start typing with plain text.',
];

export const BLOCK_TYPE_HEADING_1: ChromeWording = [
  'com.labre.block-type.heading-1',
  'Heading 1',
];
export const BLOCK_TYPE_HEADING_1_DESCRIPTION: ChromeWording = [
  'com.labre.block-type.heading-1.description',
  'Headings in the largest font.',
];

export const BLOCK_TYPE_HEADING_2: ChromeWording = [
  'com.labre.block-type.heading-2',
  'Heading 2',
];
export const BLOCK_TYPE_HEADING_2_DESCRIPTION: ChromeWording = [
  'com.labre.block-type.heading-2.description',
  'Headings in the 2nd font size.',
];

export const BLOCK_TYPE_HEADING_3: ChromeWording = [
  'com.labre.block-type.heading-3',
  'Heading 3',
];
export const BLOCK_TYPE_HEADING_3_DESCRIPTION: ChromeWording = [
  'com.labre.block-type.heading-3.description',
  'Headings in the 3rd font size.',
];

export const BLOCK_TYPE_HEADING_4: ChromeWording = [
  'com.labre.block-type.heading-4',
  'Heading 4',
];
export const BLOCK_TYPE_HEADING_4_DESCRIPTION: ChromeWording = [
  'com.labre.block-type.heading-4.description',
  'Headings in the 4th font size.',
];

export const BLOCK_TYPE_HEADING_5: ChromeWording = [
  'com.labre.block-type.heading-5',
  'Heading 5',
];
export const BLOCK_TYPE_HEADING_5_DESCRIPTION: ChromeWording = [
  'com.labre.block-type.heading-5.description',
  'Headings in the 5th font size.',
];

export const BLOCK_TYPE_HEADING_6: ChromeWording = [
  'com.labre.block-type.heading-6',
  'Heading 6',
];
export const BLOCK_TYPE_HEADING_6_DESCRIPTION: ChromeWording = [
  'com.labre.block-type.heading-6.description',
  'Headings in the 6th font size.',
];

export const BLOCK_TYPE_BULLETED_LIST: ChromeWording = [
  'com.labre.block-type.bulleted-list',
  'Bulleted List',
];
export const BLOCK_TYPE_BULLETED_LIST_DESCRIPTION: ChromeWording = [
  'com.labre.block-type.bulleted-list.description',
  'Create a bulleted list.',
];

export const BLOCK_TYPE_NUMBERED_LIST: ChromeWording = [
  'com.labre.block-type.numbered-list',
  'Numbered List',
];
export const BLOCK_TYPE_NUMBERED_LIST_DESCRIPTION: ChromeWording = [
  'com.labre.block-type.numbered-list.description',
  'Create a numbered list.',
];

export const BLOCK_TYPE_TODO_LIST: ChromeWording = [
  'com.labre.block-type.todo-list',
  'To-do List',
];
export const BLOCK_TYPE_TODO_LIST_DESCRIPTION: ChromeWording = [
  'com.labre.block-type.todo-list.description',
  'Add tasks to a to-do list.',
];

export const BLOCK_TYPE_CODE_BLOCK: ChromeWording = [
  'com.labre.block-type.code-block',
  'Code Block',
];
export const BLOCK_TYPE_CODE_BLOCK_DESCRIPTION: ChromeWording = [
  'com.labre.block-type.code-block.description',
  'Code snippet with formatting.',
];

export const BLOCK_TYPE_QUOTE: ChromeWording = [
  'com.labre.block-type.quote',
  'Quote',
];
export const BLOCK_TYPE_QUOTE_DESCRIPTION: ChromeWording = [
  'com.labre.block-type.quote.description',
  'Add a blockquote for emphasis.',
];

export const BLOCK_TYPE_DIVIDER: ChromeWording = [
  'com.labre.block-type.divider',
  'Divider',
];
export const BLOCK_TYPE_DIVIDER_DESCRIPTION: ChromeWording = [
  'com.labre.block-type.divider.description',
  'Visually separate content.',
];

/**
 * The auto-legend BOX title every framework's `createAutoLegend` draws
 * (`AutoLegendSpec.title`, `@labre/affine-gfx-ddd-shared`) — "Legend" itself,
 * distinct from the {@link BOARD_LEGEND_NOTATION} / {@link BOARD_LEGEND_COMPONENTS}
 * toolbar BUTTONS that create it. Declared here because it is the same word on
 * every board that has one: the three DDD tools, EDGY and C4 alike.
 */
export const BOARD_LEGEND_TITLE: ChromeWording = [
  'com.labre.board.legend.title',
  'Legend',
];

/* ── Undo, wherever a quick-tool or a notification offers it ──────────── */

/**
 * "Undo" said by the link package's quick-tool button (dense + full) and by
 * the generic notification's own undo action
 * (`services/notification-service.ts`) — the SAME word in two packages, one
 * key.
 */
export const TOOLBAR_UNDO: ChromeWording = ['com.labre.toolbar.undo', 'Undo'];

/* ── The block comment toolbar button ─────────────────────────────────── */

export const TOOLBAR_COMMENT: ChromeWording = [
  'com.labre.toolbar.comment',
  'Comment',
];

/* ── A document with no title ─────────────────────────────────────────── */

/**
 * "Untitled" — `DEFAULT_DOC_NAME` (`shared/src/consts/text.ts`) and the PNG
 * export's own fallback filename (`blocks/surface`'s `export-manager.ts`) say
 * the exact same word for the exact same situation (a doc with no title),
 * so one key serves both.
 */
export const CHROME_UNTITLED = DOC_UNTITLED;

/** The doc-display-meta service's own fallback for a doc that no longer exists. */
export const CHROME_DELETED_DOC: ChromeWording = [
  'com.labre.doc.deleted',
  'Deleted doc',
];

/* ── Palette swatch names (default theme) ──────────────────────────────
 *
 * A colour picker (`edgeless-color-panel`, `@labre/affine-components`) draws
 * `palette.key` as the swatch's visible name AND its aria-label — a plain
 * `Palette` (`packages/affine/model`, RED ZONE) carries no wording of its
 * own, only `{ key, value }`, so every shape / note / connector / brush
 * colour panel that iterates `DefaultTheme.Palettes` (or one of its sibling
 * tables — `NoteBackgroundColorPalettes`, `StrokeColorShortPalettes`,
 * `FillColorShortPalettes`, `ShapeTextColorPalettes`,
 * `ShapeTextColorShortPalettes`) was, until now, showing an untranslatable
 * English identifier.
 *
 * One wording per DISTINCT `key` string the default theme's tables produce
 * (`buildPalettes`'s `${prefix}${key}` — `'LightRed'`, `'MediumBlue'`,
 * `'Grey'`…), not one per colour word: the fallback must be the literal
 * already on screen, letter for letter, and `'LightRed'` is that literal —
 * decomposing it into a prefix key plus a colour key would produce a
 * DIFFERENT string (`'Light' + 'Red'` needs a space `translateKey` has no
 * grammar to insert) the moment a host actually translates one half.
 *
 * Deliberately NOT the same keys as {@link COLOR_NAME_WORDINGS}
 * (`com.labre.color-name.*`, added by an earlier lot for the highlight menu
 * and the icon picker's tint swatches, in `@labre/affine-components`): those
 * fallbacks are lower-case (`'red'`), and the literal on screen here is
 * title-case (`'Red'`, `'LightRed'`). Reusing the same key for two different
 * literals would make the manifest's drift check fail the moment either
 * call site's casing changed independently, so this is its own table under
 * its own keys.
 *
 * A FRAMEWORK's own palette (Wardley's "Wonder" / "Peace" / "War", EDGY's
 * "Identity" / "Architecture"…) does NOT live here: this table is for the
 * one editor-wide default, and a framework names its own swatches through
 * `NamedPalette.labelWording` (`@labre/affine-components/color-picker`)
 * instead — see `resolvePaletteLabel` in the same package, which checks a
 * swatch's own `labelWording` first and falls back to this table only when
 * the swatch declares none (which is exactly the default-theme case).
 */
export const PALETTE_NAME_RED: ChromeWording = [
  'com.labre.palette-name.red',
  'Red',
];
export const PALETTE_NAME_ORANGE: ChromeWording = [
  'com.labre.palette-name.orange',
  'Orange',
];
export const PALETTE_NAME_YELLOW: ChromeWording = [
  'com.labre.palette-name.yellow',
  'Yellow',
];
export const PALETTE_NAME_GREEN: ChromeWording = [
  'com.labre.palette-name.green',
  'Green',
];
export const PALETTE_NAME_BLUE: ChromeWording = [
  'com.labre.palette-name.blue',
  'Blue',
];
export const PALETTE_NAME_PURPLE: ChromeWording = [
  'com.labre.palette-name.purple',
  'Purple',
];
export const PALETTE_NAME_MAGENTA: ChromeWording = [
  'com.labre.palette-name.magenta',
  'Magenta',
];
export const PALETTE_NAME_GREY: ChromeWording = [
  'com.labre.palette-name.grey',
  'Grey',
];
export const PALETTE_NAME_WHITE: ChromeWording = [
  'com.labre.palette-name.white',
  'White',
];
export const PALETTE_NAME_BLACK: ChromeWording = [
  'com.labre.palette-name.black',
  'Black',
];
export const PALETTE_NAME_TRANSPARENT: ChromeWording = [
  'com.labre.palette-name.transparent',
  'Transparent',
];

export const PALETTE_NAME_LIGHT_RED: ChromeWording = [
  'com.labre.palette-name.light-red',
  'LightRed',
];
export const PALETTE_NAME_LIGHT_ORANGE: ChromeWording = [
  'com.labre.palette-name.light-orange',
  'LightOrange',
];
export const PALETTE_NAME_LIGHT_YELLOW: ChromeWording = [
  'com.labre.palette-name.light-yellow',
  'LightYellow',
];
export const PALETTE_NAME_LIGHT_GREEN: ChromeWording = [
  'com.labre.palette-name.light-green',
  'LightGreen',
];
export const PALETTE_NAME_LIGHT_BLUE: ChromeWording = [
  'com.labre.palette-name.light-blue',
  'LightBlue',
];
export const PALETTE_NAME_LIGHT_PURPLE: ChromeWording = [
  'com.labre.palette-name.light-purple',
  'LightPurple',
];
export const PALETTE_NAME_LIGHT_MAGENTA: ChromeWording = [
  'com.labre.palette-name.light-magenta',
  'LightMagenta',
];
export const PALETTE_NAME_LIGHT_GREY: ChromeWording = [
  'com.labre.palette-name.light-grey',
  'LightGrey',
];

export const PALETTE_NAME_MEDIUM_RED: ChromeWording = [
  'com.labre.palette-name.medium-red',
  'MediumRed',
];
export const PALETTE_NAME_MEDIUM_ORANGE: ChromeWording = [
  'com.labre.palette-name.medium-orange',
  'MediumOrange',
];
export const PALETTE_NAME_MEDIUM_YELLOW: ChromeWording = [
  'com.labre.palette-name.medium-yellow',
  'MediumYellow',
];
export const PALETTE_NAME_MEDIUM_GREEN: ChromeWording = [
  'com.labre.palette-name.medium-green',
  'MediumGreen',
];
export const PALETTE_NAME_MEDIUM_BLUE: ChromeWording = [
  'com.labre.palette-name.medium-blue',
  'MediumBlue',
];
export const PALETTE_NAME_MEDIUM_PURPLE: ChromeWording = [
  'com.labre.palette-name.medium-purple',
  'MediumPurple',
];
export const PALETTE_NAME_MEDIUM_MAGENTA: ChromeWording = [
  'com.labre.palette-name.medium-magenta',
  'MediumMagenta',
];
export const PALETTE_NAME_MEDIUM_GREY: ChromeWording = [
  'com.labre.palette-name.medium-grey',
  'MediumGrey',
];

/**
 * Keyed by the exact `Palette.key` string the default theme's tables produce
 * (`buildPalettes`, `packages/affine/model/src/themes/{default,utils}.ts`) —
 * the one lookup `resolvePaletteLabel` (`@labre/affine-components/color-picker`)
 * falls back to when a swatch declares no `labelWording` of its own.
 */
export const PALETTE_NAME_WORDINGS: Readonly<Record<string, ChromeWording>> = {
  Red: PALETTE_NAME_RED,
  Orange: PALETTE_NAME_ORANGE,
  Yellow: PALETTE_NAME_YELLOW,
  Green: PALETTE_NAME_GREEN,
  Blue: PALETTE_NAME_BLUE,
  Purple: PALETTE_NAME_PURPLE,
  Magenta: PALETTE_NAME_MAGENTA,
  Grey: PALETTE_NAME_GREY,
  White: PALETTE_NAME_WHITE,
  Black: PALETTE_NAME_BLACK,
  Transparent: PALETTE_NAME_TRANSPARENT,
  LightRed: PALETTE_NAME_LIGHT_RED,
  LightOrange: PALETTE_NAME_LIGHT_ORANGE,
  LightYellow: PALETTE_NAME_LIGHT_YELLOW,
  LightGreen: PALETTE_NAME_LIGHT_GREEN,
  LightBlue: PALETTE_NAME_LIGHT_BLUE,
  LightPurple: PALETTE_NAME_LIGHT_PURPLE,
  LightMagenta: PALETTE_NAME_LIGHT_MAGENTA,
  LightGrey: PALETTE_NAME_LIGHT_GREY,
  MediumRed: PALETTE_NAME_MEDIUM_RED,
  MediumOrange: PALETTE_NAME_MEDIUM_ORANGE,
  MediumYellow: PALETTE_NAME_MEDIUM_YELLOW,
  MediumGreen: PALETTE_NAME_MEDIUM_GREEN,
  MediumBlue: PALETTE_NAME_MEDIUM_BLUE,
  MediumPurple: PALETTE_NAME_MEDIUM_PURPLE,
  MediumMagenta: PALETTE_NAME_MEDIUM_MAGENTA,
  MediumGrey: PALETTE_NAME_MEDIUM_GREY,
};

/* ── Clipboard size-limit toasts (adapters/clipboard/utils.ts) ────────── */

export const CHROME_CLIPBOARD_FILE_TOO_LARGE: ChromeWording = [
  'com.labre.clipboard.file-too-large',
  'File is too large to be copied',
];

export const CHROME_CLIPBOARD_SIZE_LIMIT: ChromeWording = [
  'com.labre.clipboard.size-limit',
  'File cannot be copied due to the clipboard size limit',
];

/* ── Media / documents / embeds / frames chrome (lot L6b) ─────────────────
 *
 * Words rendered by at least two of the attachment / bookmark / image /
 * embed / embed-doc / surface-ref / frame / frame-panel packages (or shared
 * with a package outside that group, e.g. `frame` and `frame-panel`): one key
 * each, per the "un mot partagé = une clé" rule. A word used by only ONE of
 * those packages stays declared in that package's own `translations.ts`.
 */

export const TOOLBAR_CAPTION: ChromeWording = [
  'com.labre.toolbar.caption',
  'Caption',
];

export const TOOLBAR_DOWNLOAD: ChromeWording = [
  'com.labre.toolbar.download',
  'Download',
];

export const TOOLBAR_RELOAD: ChromeWording = [
  'com.labre.toolbar.reload',
  'Reload',
];

export const TOOLBAR_RENAME: ChromeWording = [
  'com.labre.toolbar.rename',
  'Rename',
];

/**
 * The frame primitive's own name — the edgeless tool, its dense-menu entry,
 * and the surface-ref slash menu's "insert a blank frame" item all name the
 * same thing.
 */
export const TOOLBAR_FRAME: ChromeWording = [
  'com.labre.toolbar.frame',
  'Frame',
];

export const TOOLBAR_SETTINGS: ChromeWording = [
  'com.labre.toolbar.settings',
  'Settings',
];

export const TOOLBAR_HIDE_TOOLBAR: ChromeWording = [
  'com.labre.toolbar.hide-toolbar',
  'Hide toolbar',
];

export const TOOLBAR_PLAYBACK_SETTINGS: ChromeWording = [
  'com.labre.toolbar.playback-settings',
  'Playback Settings',
];

export const TOOLBAR_OPEN_THIS_DOC: ChromeWording = [
  'com.labre.toolbar.open-this-doc',
  'Open this doc',
];

/**
 * The card-style switcher's four wordings — the bookmark's, the linked-doc
 * embed's and the generic embed's (github) style menus all offer the same
 * four choices in the same words.
 */
export const TOOLBAR_LARGE_HORIZONTAL_STYLE: ChromeWording = [
  'com.labre.toolbar.style.large-horizontal',
  'Large horizontal style',
];

export const TOOLBAR_SMALL_HORIZONTAL_STYLE: ChromeWording = [
  'com.labre.toolbar.style.small-horizontal',
  'Small horizontal style',
];

export const TOOLBAR_LARGE_VERTICAL_STYLE: ChromeWording = [
  'com.labre.toolbar.style.large-vertical',
  'Large vertical style',
];

export const TOOLBAR_SMALL_VERTICAL_STYLE: ChromeWording = [
  'com.labre.toolbar.style.small-vertical',
  'Small vertical style',
];

export const TOAST_DOWNLOAD_IN_PROGRESS: ChromeWording = [
  'com.labre.toast.download-in-progress',
  'Download in progress...',
];

/** `{{size}}` is a formatted size (`formatSize`), not a plural count. */
export const TOAST_UPLOAD_SIZE_LIMIT: ChromeWording = [
  'com.labre.toast.upload-size-limit',
  'You can only upload files less than {{size}}',
];

export const CHROME_LOADING: ChromeWording = [
  'com.labre.chrome.loading',
  'Loading...',
];

/**
 * Every wording declared above, in declaration order.
 *
 * The manifest (`@labre/affine/translations`) walks this instead of restating
 * the pairs, so a wording added here reaches a host's catalogue with no second
 * edit — the same "declared data, not restated data" rule the roles, the rules
 * and the commands already follow.
 */
/**
 * Aliases kept for the prose-chrome call sites (note, paragraph, gfx/note):
 * the same words as the BLOCK_TYPE_* wordings above, one key per word.
 */
export const BLOCK_NAME_TEXT = BLOCK_TYPE_TEXT;
export const BLOCK_NAME_HEADING_1 = BLOCK_TYPE_HEADING_1;
export const BLOCK_NAME_HEADING_2 = BLOCK_TYPE_HEADING_2;
export const BLOCK_NAME_HEADING_3 = BLOCK_TYPE_HEADING_3;
export const BLOCK_NAME_HEADING_4 = BLOCK_TYPE_HEADING_4;
export const BLOCK_NAME_HEADING_5 = BLOCK_TYPE_HEADING_5;
export const BLOCK_NAME_HEADING_6 = BLOCK_TYPE_HEADING_6;
export const BLOCK_NAME_CODE_BLOCK = BLOCK_TYPE_CODE_BLOCK;
export const BLOCK_NAME_QUOTE = BLOCK_TYPE_QUOTE;
export const BLOCK_NAME_DIVIDER = BLOCK_TYPE_DIVIDER;
export const BLOCK_NAME_BULLETED_LIST = BLOCK_TYPE_BULLETED_LIST;
export const BLOCK_NAME_NUMBERED_LIST = BLOCK_TYPE_NUMBERED_LIST;
export const BLOCK_NAME_TODO_LIST = BLOCK_TYPE_TODO_LIST;

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
  TOOLBAR_MOVE_UP,
  TOOLBAR_MOVE_DOWN,
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
  NOTE_SHADOW_NONE,
  NOTE_SHADOW_BOX,
  NOTE_SHADOW_STICKER,
  NOTE_SHADOW_PAPER,
  NOTE_SHADOW_FILM,

  DOC_UNTITLED,
  FORMAT_MARKDOWN,
  FORMAT_HTML,
  STYLE_GENERAL,
  STYLE_SCRIBBLED,
  STYLE_MENU_LABEL,
  FONT_WEIGHT_LIGHT,
  FONT_WEIGHT_REGULAR,
  FONT_WEIGHT_SEMIBOLD,
  FONT_STYLE_ITALIC,
  TOOL_NAME_TEXT,
  TOOL_NAME_NOTE,
  TOOL_NAME_FRAME,
  TOOL_NAME_SHAPE,
  FONT_SIZE_LABEL,
  BOARD_BORDER_STYLE_LABEL,
  EQUATION_EMPTY_LABEL,
  EQUATION_ERROR_LABEL,

  BLOCK_TYPE_TEXT,
  BLOCK_TYPE_TEXT_DESCRIPTION,
  BLOCK_TYPE_HEADING_1,
  BLOCK_TYPE_HEADING_1_DESCRIPTION,
  BLOCK_TYPE_HEADING_2,
  BLOCK_TYPE_HEADING_2_DESCRIPTION,
  BLOCK_TYPE_HEADING_3,
  BLOCK_TYPE_HEADING_3_DESCRIPTION,
  BLOCK_TYPE_HEADING_4,
  BLOCK_TYPE_HEADING_4_DESCRIPTION,
  BLOCK_TYPE_HEADING_5,
  BLOCK_TYPE_HEADING_5_DESCRIPTION,
  BLOCK_TYPE_HEADING_6,
  BLOCK_TYPE_HEADING_6_DESCRIPTION,
  BLOCK_TYPE_BULLETED_LIST,
  BLOCK_TYPE_BULLETED_LIST_DESCRIPTION,
  BLOCK_TYPE_NUMBERED_LIST,
  BLOCK_TYPE_NUMBERED_LIST_DESCRIPTION,
  BLOCK_TYPE_TODO_LIST,
  BLOCK_TYPE_TODO_LIST_DESCRIPTION,
  BLOCK_TYPE_CODE_BLOCK,
  BLOCK_TYPE_CODE_BLOCK_DESCRIPTION,
  BLOCK_TYPE_QUOTE,
  BLOCK_TYPE_QUOTE_DESCRIPTION,
  BLOCK_TYPE_DIVIDER,
  BLOCK_TYPE_DIVIDER_DESCRIPTION,
  BOARD_LEGEND_TITLE,
  TOOLBAR_UNDO,
  TOOLBAR_COMMENT,

  CHROME_DELETED_DOC,
  CHROME_CLIPBOARD_FILE_TOO_LARGE,
  CHROME_CLIPBOARD_SIZE_LIMIT,
  TOOLBAR_CAPTION,
  TOOLBAR_DOWNLOAD,
  TOOLBAR_RELOAD,
  TOOLBAR_RENAME,
  TOOLBAR_FRAME,
  TOOLBAR_SETTINGS,
  TOOLBAR_HIDE_TOOLBAR,
  TOOLBAR_PLAYBACK_SETTINGS,
  TOOLBAR_OPEN_THIS_DOC,
  TOOLBAR_LARGE_HORIZONTAL_STYLE,
  TOOLBAR_SMALL_HORIZONTAL_STYLE,
  TOOLBAR_LARGE_VERTICAL_STYLE,
  TOOLBAR_SMALL_VERTICAL_STYLE,
  TOAST_DOWNLOAD_IN_PROGRESS,
  TOAST_UPLOAD_SIZE_LIMIT,
  CHROME_LOADING,

  PALETTE_NAME_RED,
  PALETTE_NAME_ORANGE,
  PALETTE_NAME_YELLOW,
  PALETTE_NAME_GREEN,
  PALETTE_NAME_BLUE,
  PALETTE_NAME_PURPLE,
  PALETTE_NAME_MAGENTA,
  PALETTE_NAME_GREY,
  PALETTE_NAME_WHITE,
  PALETTE_NAME_BLACK,
  PALETTE_NAME_TRANSPARENT,
  PALETTE_NAME_LIGHT_RED,
  PALETTE_NAME_LIGHT_ORANGE,
  PALETTE_NAME_LIGHT_YELLOW,
  PALETTE_NAME_LIGHT_GREEN,
  PALETTE_NAME_LIGHT_BLUE,
  PALETTE_NAME_LIGHT_PURPLE,
  PALETTE_NAME_LIGHT_MAGENTA,
  PALETTE_NAME_LIGHT_GREY,
  PALETTE_NAME_MEDIUM_RED,
  PALETTE_NAME_MEDIUM_ORANGE,
  PALETTE_NAME_MEDIUM_YELLOW,
  PALETTE_NAME_MEDIUM_GREEN,
  PALETTE_NAME_MEDIUM_BLUE,
  PALETTE_NAME_MEDIUM_PURPLE,
  PALETTE_NAME_MEDIUM_MAGENTA,
  PALETTE_NAME_MEDIUM_GREY,
];
