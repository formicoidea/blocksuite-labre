# @labre/affine-widget-slash-menu

## 0.43.1

### Patch Changes

- Updated dependencies [2602909]
  - @labre/affine-shared@0.43.1
  - @labre/affine-components@0.43.1
  - @labre/affine-rich-text@0.43.1
  - @labre/affine-ext-loader@0.43.1
  - @labre/global@0.43.1
  - @labre/std@0.43.1
  - @labre/store@0.43.1

## 0.43.0

### Patch Changes

- f1a4af7: Twenty-six strings a French host still read in English now go through the
  translation seam: the colour picker's Heavy row, the slash menu's List and
  Style headers, the five "Other" template tiles, the embed error card's
  sentence, the SVG import's three refusals, the two "Untitled" linked-doc
  titles, and the accessible name of every toolbar menu (which used to read
  "changer le type de forme-menu"). New keys, English fallbacks letter for
  letter what shipped — a host with no catalogue sees no change.

  New keys: `com.labre.palette-name.heavy-{red,orange,yellow,green,blue,purple,magenta}`,
  `com.labre.slash-menu.group.list`,
  `com.labre.template.name.{swot,kanban-board,business-model-canvas,fishbone,gantt-chart}`,
  `com.labre.embed.iframe.error.{no-embed-data,invalid-url,message}`,
  `com.labre.interchange.svg.error.{malformed-xml,not-svg,sanitized-away}`,
  `com.labre.interchange.import.default-name`, `com.labre.menu-aria.style`,
  `com.labre.text-toolbar.alignment-menu`,
  `com.labre.shape.toolbar.switch-type-menu`,
  `com.labre.mindmap.toolbar.layout-menu`,
  `com.labre.connector.toolbar.{start-point-style,end-point-style,shape}-menu`,
  `com.labre.bpmn.import.error.missing-namespace`.

- Updated dependencies [da68dbb]
- Updated dependencies [8f54236]
- Updated dependencies [f1a4af7]
- Updated dependencies [8a927dd]
  - @labre/affine-shared@0.43.0
  - @labre/affine-components@0.43.0
  - @labre/affine-rich-text@0.43.0
  - @labre/affine-ext-loader@0.43.0
  - @labre/global@0.43.0
  - @labre/std@0.43.0
  - @labre/store@0.43.0

## 0.42.0

### Patch Changes

- Updated dependencies [87ef822]
- Updated dependencies [911d143]
- Updated dependencies [0dcd69b]
- Updated dependencies [4899136]
- Updated dependencies [2f5c621]
- Updated dependencies [911d143]
- Updated dependencies [48213e7]
- Updated dependencies [512ab39]
- Updated dependencies [7437481]
- Updated dependencies [2e179bb]
- Updated dependencies [4f5faa3]
- Updated dependencies [f3f412a]
- Updated dependencies [f6ece47]
- Updated dependencies [e2f6ca5]
- Updated dependencies [d1851b1]
- Updated dependencies [5a8ec30]
- Updated dependencies [549056e]
- Updated dependencies [2bb7318]
- Updated dependencies [c73b25f]
- Updated dependencies [911d143]
- Updated dependencies [55d9f13]
  - @labre/std@0.42.0
  - @labre/affine-shared@0.42.0
  - @labre/store@0.42.0
  - @labre/affine-components@0.42.0
  - @labre/global@0.42.0
  - @labre/affine-rich-text@0.42.0
  - @labre/affine-ext-loader@0.42.0

## 0.41.0

### Minor Changes

- 6cfe313: feat(blocks): the translation seam takes interpolation parameters and the host's locale. `TranslationService.t(key, params?)` and `translateKey(std, key, fallback, params?)` carry the values of a sentence with holes in it; fallbacks use i18next placeholders (`{{name}}`), and the library fills them itself when the host has no entry. `hostLocale(std)` gives the host's full language tag for `Intl` formatting. Each package now declares its own wordings, which the key manifest collects. The slash menu resolves `nameWording`, `descriptionWording`, `captionWording` and its group headers against the host's catalogue, and search matches both the translated and the English name. Templates rebuild the text they write into the document in the inserting editor's language (`Template.localize`). With no `TranslationProvider` registered, nothing changes on screen. A host adapter should forward `params`: `t: (key, params) => i18n.exists(key, params) ? i18n.t(key, params) : undefined`.
- c4661f2: feat(blocks): slash-menu and toolbar preview illustrations carry no more baked-in English text. Every `<text>`/`<tspan>` run in a preview SVG (tweet, Linear, attachment, PDF, link, callout, new/linked doc, photo, and the note block's text/heading/code-block/quote/divider/list/bold/italic/strikethrough/underline/todo previews, plus the slash-menu's copy/delete/move/now/today/tomorrow/yesterday previews) is redrawn as a neutral skeleton bar instead, so no illustration will ever need a translation catalogue entry. Nothing else in these SVGs changed (masks, icons, shapes, embedded images are untouched), and no host-visible behavior changes outside the previews themselves. The surface-ref (Frame/Mind Map/Group) previews are unchanged: those labels name canvas elements that will not necessarily be renamed, so the PO kept their text as-is.
- 924f7d6: feat(blocks): the text blocks' and the slash menu's AFFiNE chrome resolves through the translation seam instead of raw English literals. The note block's edgeless surface — the style panel (fill color / shadow / border / corner-radius section titles, the custom-color tab, the "Note Style" button), the shadow/border/display-mode dropdowns, the surface toolbar's slicer/size/display-in-page buttons and their four notifications ("Note displayed in Page Mode", "Content removed/added…", "View in Toc") — now carries `translateKey`/`labelWording`/`tooltipWording` pairs everywhere `std` reaches or the toolbar's own static-config seam applies. The note's slash-menu tooltip captions, its conversion/format item names (`nameWording`, reusing the shared block-type words below), and the "Other Headings" submenu follow the same pattern; the move-up/move-down hotkey config's internal label now reads the shared wording's own fallback instead of restating it, so it can never drift from what the slash menu's own "Actions" group says. The paragraph block's placeholders (the empty-paragraph "Type '/' for commands" and the six heading-level placeholders) resolve through a lookup table a host's custom `getPlaceholder` is free to ignore. `gfx/note`'s "add note" senior tool, its quick-tool row (Image/File/Link, and every block kind offered), and its own shadow/display-mode panels are keyed too — distinct from `blocks/note`'s wording where the two surfaces say different words (e.g. "In Both" vs "Both"), including the pre-existing "Floation shadow" typo, kept letter-for-letter apart from `blocks/note`'s "Floating shadow". The code block's toolbar (copy/caption/comment/duplicate/delete/more, wrap/line-number toggles, the language search placeholder, the "Plain Text" fallback and the copy-failure toast) and the latex block's two slash-menu items (name/description/tooltip intro) and its empty/error placeholders are keyed; language names themselves stay English (proper names). The callout block's single slash-menu item is keyed. Block-type words used in more than one of these packages (Text, Heading 1-6, Code Block, Quote, Divider, Bulleted/Numbered/To-do List) and the note shadow options shared between `blocks/note` and `gfx/note` now live once in `@labre/affine-shared`'s `chrome.ts`. With no catalogue registered every surface reads exactly as it did before this change, letter for letter.

### Patch Changes

- a513f05: Displayed English now says "Canvas" where it said "Edgeless" and "Document" where "Page" named the document mode (display-mode options, note and frame toolbars, toasts, slash-menu group headers, surface-ref placeholders, the frame and mind-map slash-menu previews). Translation keys, identifiers and stored values are unchanged. Three keys that already shipped change their English fallback: `com.labre.embed.synced-doc.empty-preview`, `com.labre.toast.frame-inserted-into-page` and `com.labre.toast.note-removed-from-page-mode`. The mobile keyboard toolbar is left as is.
- Updated dependencies [a513f05]
- Updated dependencies [6cfe313]
- Updated dependencies [5776733]
- Updated dependencies [4ed9484]
- Updated dependencies [6271b11]
- Updated dependencies [924f7d6]
- Updated dependencies [5744cfd]
- Updated dependencies [feca957]
- Updated dependencies [1dac32d]
- Updated dependencies [b2781b5]
- Updated dependencies [223b280]
- Updated dependencies [47d4ac6]
  - @labre/affine-shared@0.41.0
  - @labre/std@0.41.0
  - @labre/affine-components@0.41.0
  - @labre/affine-rich-text@0.41.0
  - @labre/affine-ext-loader@0.41.0
  - @labre/global@0.41.0
  - @labre/store@0.41.0

## 0.40.0

### Patch Changes

- Updated dependencies [95ff0a5]
- Updated dependencies [95ff0a5]
  - @labre/affine-shared@0.40.0
  - @labre/affine-components@0.40.0
  - @labre/affine-rich-text@0.40.0
  - @labre/affine-ext-loader@0.40.0
  - @labre/global@0.40.0
  - @labre/std@0.40.0
  - @labre/store@0.40.0

## 0.39.3

### Patch Changes

- Updated dependencies [070e1ec]
  - @labre/affine-components@0.39.3
  - @labre/affine-rich-text@0.39.3
  - @labre/affine-ext-loader@0.39.3
  - @labre/affine-shared@0.39.3
  - @labre/global@0.39.3
  - @labre/std@0.39.3
  - @labre/store@0.39.3

## 0.39.2

### Patch Changes

- Updated dependencies [07b47b8]
  - @labre/affine-shared@0.39.2
  - @labre/affine-components@0.39.2
  - @labre/affine-rich-text@0.39.2
  - @labre/affine-ext-loader@0.39.2
  - @labre/global@0.39.2
  - @labre/std@0.39.2
  - @labre/store@0.39.2

## 0.39.1

### Patch Changes

- @labre/affine-components@0.39.1
- @labre/affine-rich-text@0.39.1
- @labre/affine-shared@0.39.1
- @labre/affine-ext-loader@0.39.1
- @labre/global@0.39.1
- @labre/std@0.39.1
- @labre/store@0.39.1

## 0.39.0

### Patch Changes

- @labre/affine-components@0.39.0
- @labre/affine-ext-loader@0.39.0
- @labre/affine-rich-text@0.39.0
- @labre/affine-shared@0.39.0
- @labre/global@0.39.0
- @labre/std@0.39.0
- @labre/store@0.39.0

## 0.38.2

### Patch Changes

- Updated dependencies [0ffa45b]
  - @labre/std@0.38.2
  - @labre/affine-components@0.38.2
  - @labre/affine-rich-text@0.38.2
  - @labre/affine-shared@0.38.2
  - @labre/affine-ext-loader@0.38.2
  - @labre/global@0.38.2
  - @labre/store@0.38.2

## 0.38.1

### Patch Changes

- @labre/affine-components@0.38.1
- @labre/affine-ext-loader@0.38.1
- @labre/affine-rich-text@0.38.1
- @labre/affine-shared@0.38.1
- @labre/global@0.38.1
- @labre/std@0.38.1
- @labre/store@0.38.1

## 0.38.0

### Patch Changes

- Updated dependencies [6aa0081]
  - @labre/affine-shared@0.38.0
  - @labre/affine-components@0.38.0
  - @labre/affine-rich-text@0.38.0
  - @labre/affine-ext-loader@0.38.0
  - @labre/global@0.38.0
  - @labre/std@0.38.0
  - @labre/store@0.38.0

## 0.37.0

### Patch Changes

- @labre/affine-components@0.37.0
- @labre/affine-ext-loader@0.37.0
- @labre/affine-rich-text@0.37.0
- @labre/affine-shared@0.37.0
- @labre/global@0.37.0
- @labre/std@0.37.0
- @labre/store@0.37.0

## 0.36.0

### Patch Changes

- Updated dependencies [9fa662a]
- Updated dependencies [60fb357]
  - @labre/affine-components@0.36.0
  - @labre/affine-shared@0.36.0
  - @labre/std@0.36.0
  - @labre/affine-rich-text@0.36.0
  - @labre/affine-ext-loader@0.36.0
  - @labre/global@0.36.0
  - @labre/store@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [ea5d249]
- Updated dependencies [de3560d]
- Updated dependencies [7f09608]
- Updated dependencies [cf0d8a1]
  - @labre/affine-components@0.35.0
  - @labre/affine-shared@0.35.0
  - @labre/std@0.35.0
  - @labre/affine-rich-text@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-components@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-rich-text@0.34.2
- @labre/affine-shared@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2
- @labre/store@0.34.2

## 0.34.1

### Patch Changes

- Updated dependencies [6120f7a]
  - @labre/std@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-rich-text@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1
  - @labre/store@0.34.1

## 0.34.0

### Patch Changes

- 8b00f7d: fix(blocks): core toasts, board tooltips, catalogue headers and seed texts cross the translation seam

  A host that wires `TranslationExtension` now gets a catalogue that covers the
  editor, instead of one that covers everything except the parts a user actually
  reads first. Six families of hard-coded English are gone (refs #182, #183);
  every one of them is a `com.labre.*` key with the previous literal as its
  English fallback, so an editor with no `TranslationProvider` registered reads
  exactly what it read before.

  - **Toasts** — "Copied to clipboard", "Linked doc created", "Note removed from
    Page Mode", "Frame inserted into Page.", "No link found".
  - **Board toolbars** — the resize toggle every framework board carries, and the
    two legend wordings, declared once in `@labre/affine-shared` rather than
    eight times.
  - **Editor chrome** — the toolbar verbs (Copy, Duplicate, Delete, Lock, Link,
    More, Bring to Front, Send to Back, Create linked doc, Draw connector), the
    view switcher (Switch / Inline / Card / Embed view) and the linked-doc card's
    four "nothing to show" sentences. `ToolbarAction` gained `labelWording` /
    `tooltipWording`: a declared `[key, English]` pair the toolbar resolves when
    it builds the row, which keeps a call site one line and keeps the row's width
    planning honest about what it is about to say.
  - **Catalogue headers** — every framework now contributes its own
    `com.labre.catalogue.category.*` keys. Core's registry names no framework
    category once `build:bundles` has stripped it, so a bundled host was drawing
    translated entries under English headers.
  - **BPMN import remarks** — the three whose wording is a fixed sentence carry a
    key (`InterchangeNote.messageKey`). The ones that name an element, an id or a
    count of lanes do not: the seam has no interpolation.
  - **Seed texts** — the caption a placed BPMN or EDGY artefact is given, and a
    C4 board's name, are resolved AT PLACEMENT. What lands in the document is
    content the author owns from that moment on and is never re-translated.

  `getTranslationKeyManifest()` gains all of it, including a new `'seed'` source
  for the words a framework writes onto the canvas.

  Three surfaces are deliberately left English, and each one is a refusal rather
  than an oversight. The **C4 component tier seeds** (`NODE_LABEL`,
  `C4_TYPE_PLACEHOLDER`, `DESCRIPTION_PLACEHOLDER`) are read back as SENTINELS by
  the morph and by the mermaid exporter, which is a pure function of the board
  and has no `std` to re-resolve them with — translating them would change what
  an export writes. The **code block's "⋮"** is a `MenuItemGroup` rendered over a
  generic context that carries no `std`. The **slash menu** and the **mobile
  keyboard toolbar** item names are their own vocabularies, untouched apart from
  the toasts they raise.

- Updated dependencies [881d3f5]
- Updated dependencies [6c1bdfb]
- Updated dependencies [8b00f7d]
- Updated dependencies [5f76ab3]
- Updated dependencies [f09d68c]
  - @labre/std@0.34.0
  - @labre/affine-shared@0.34.0
  - @labre/affine-components@0.34.0
  - @labre/affine-rich-text@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Patch Changes

- Updated dependencies [3fbf69c]
- Updated dependencies [f929e12]
- Updated dependencies [13360cd]
- Updated dependencies [32e4d45]
- Updated dependencies [b03132c]
- Updated dependencies [5737a56]
- Updated dependencies [9022c92]
- Updated dependencies [edfaba2]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-components@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-rich-text@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Patch Changes

- 5a61fb2: fix(blocks): a slash menu that found nothing survives the next letter

  Typing `/eeee`, deleting back to `/` and typing `h` used to close the slash
  menu instead of showing the headings. The menu closes on the first key that
  follows an empty result, and the query state behind that verdict is refreshed
  asynchronously — so the `h` was judged against a `no_result` that the deletion
  had already made obsolete.

  A key that adds a character to the query now keeps the menu open and refreshes
  it. Everything else closes it exactly as before: space, `Escape`, `Enter`, the
  arrows, and any character pressed with a modifier.

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [9e23b5b]
- Updated dependencies [90a9168]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [50ab9ae]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [5ac0c68]
- Updated dependencies [1fa46c1]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [492bac6]
- Updated dependencies [72b334c]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [3c5c97e]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [c7612da]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [48e90f4]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [025d6f5]
- Updated dependencies [b1ed4ef]
- Updated dependencies [985a92f]
- Updated dependencies [b889326]
- Updated dependencies [1efc6d5]
- Updated dependencies [4162e4a]
- Updated dependencies [fad4c08]
- Updated dependencies [7b66d8d]
- Updated dependencies [4bb44ef]
- Updated dependencies [30061cb]
- Updated dependencies [77b0100]
- Updated dependencies [8d33c60]
- Updated dependencies [7a3458a]
  - @labre/std@0.32.0
  - @labre/affine-shared@0.32.0
  - @labre/store@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-components@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-rich-text@0.30.2
- @labre/affine-shared@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-components@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-rich-text@0.30.1
- @labre/affine-shared@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-components@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-rich-text@0.29.1
- @labre/affine-shared@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- Updated dependencies [6795191]
  - @labre/affine-components@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.24.0

### Patch Changes

- @labre/affine-components@0.24.0
- @labre/affine-ext-loader@0.24.0
- @labre/affine-rich-text@0.24.0
- @labre/affine-shared@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/affine-rich-text@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/affine-rich-text@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/affine-rich-text@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
  - @labre/affine-shared@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
