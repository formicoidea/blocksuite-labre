# @labre/affine-block-note

## 0.42.0

### Patch Changes

- 5a8ec30: Tab, Shift-Tab and Enter pressed on a native control such as the collapse button act on that control, in every block keymap and not only in the root fallback.
- Updated dependencies [87ef822]
- Updated dependencies [90ddf64]
- Updated dependencies [f294deb]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [0dcd69b]
- Updated dependencies [911d143]
- Updated dependencies [a441d96]
- Updated dependencies [4899136]
- Updated dependencies [2f5c621]
- Updated dependencies [911d143]
- Updated dependencies [9ecfc77]
- Updated dependencies [48213e7]
- Updated dependencies [512ab39]
- Updated dependencies [f5acc9b]
- Updated dependencies [7437481]
- Updated dependencies [2e179bb]
- Updated dependencies [911d143]
- Updated dependencies [4f5faa3]
- Updated dependencies [e5d0e6e]
- Updated dependencies [911d143]
- Updated dependencies [f3f412a]
- Updated dependencies [d756a4a]
- Updated dependencies [6bc897b]
- Updated dependencies [f6ece47]
- Updated dependencies [ef0e3da]
- Updated dependencies [e2f6ca5]
- Updated dependencies [d1851b1]
- Updated dependencies [5a8ec30]
- Updated dependencies [549056e]
- Updated dependencies [2bb7318]
- Updated dependencies [c73b25f]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [55d9f13]
  - @labre/std@0.42.0
  - @labre/affine-block-surface@0.42.0
  - @labre/affine-model@0.42.0
  - @labre/affine-shared@0.42.0
  - @labre/store@0.42.0
  - @labre/affine-inline-preset@0.42.0
  - @labre/affine-block-embed@0.42.0
  - @labre/affine-components@0.42.0
  - @labre/global@0.42.0
  - @labre/affine-fragment-doc-title@0.42.0
  - @labre/affine-gfx-turbo-renderer@0.42.0
  - @labre/affine-rich-text@0.42.0
  - @labre/affine-widget-slash-menu@0.42.0
  - @labre/affine-ext-loader@0.42.0

## 0.41.0

### Minor Changes

- c4661f2: feat(blocks): slash-menu and toolbar preview illustrations carry no more baked-in English text. Every `<text>`/`<tspan>` run in a preview SVG (tweet, Linear, attachment, PDF, link, callout, new/linked doc, photo, and the note block's text/heading/code-block/quote/divider/list/bold/italic/strikethrough/underline/todo previews, plus the slash-menu's copy/delete/move/now/today/tomorrow/yesterday previews) is redrawn as a neutral skeleton bar instead, so no illustration will ever need a translation catalogue entry. Nothing else in these SVGs changed (masks, icons, shapes, embedded images are untouched), and no host-visible behavior changes outside the previews themselves. The surface-ref (Frame/Mind Map/Group) previews are unchanged: those labels name canvas elements that will not necessarily be renamed, so the PO kept their text as-is.
- 924f7d6: feat(blocks): the text blocks' and the slash menu's AFFiNE chrome resolves through the translation seam instead of raw English literals. The note block's edgeless surface — the style panel (fill color / shadow / border / corner-radius section titles, the custom-color tab, the "Note Style" button), the shadow/border/display-mode dropdowns, the surface toolbar's slicer/size/display-in-page buttons and their four notifications ("Note displayed in Page Mode", "Content removed/added…", "View in Toc") — now carries `translateKey`/`labelWording`/`tooltipWording` pairs everywhere `std` reaches or the toolbar's own static-config seam applies. The note's slash-menu tooltip captions, its conversion/format item names (`nameWording`, reusing the shared block-type words below), and the "Other Headings" submenu follow the same pattern; the move-up/move-down hotkey config's internal label now reads the shared wording's own fallback instead of restating it, so it can never drift from what the slash menu's own "Actions" group says. The paragraph block's placeholders (the empty-paragraph "Type '/' for commands" and the six heading-level placeholders) resolve through a lookup table a host's custom `getPlaceholder` is free to ignore. `gfx/note`'s "add note" senior tool, its quick-tool row (Image/File/Link, and every block kind offered), and its own shadow/display-mode panels are keyed too — distinct from `blocks/note`'s wording where the two surfaces say different words (e.g. "In Both" vs "Both"), including the pre-existing "Floation shadow" typo, kept letter-for-letter apart from `blocks/note`'s "Floating shadow". The code block's toolbar (copy/caption/comment/duplicate/delete/more, wrap/line-number toggles, the language search placeholder, the "Plain Text" fallback and the copy-failure toast) and the latex block's two slash-menu items (name/description/tooltip intro) and its empty/error placeholders are keyed; language names themselves stay English (proper names). The callout block's single slash-menu item is keyed. Block-type words used in more than one of these packages (Text, Heading 1-6, Code Block, Quote, Divider, Bulleted/Numbered/To-do List) and the note shadow options shared between `blocks/note` and `gfx/note` now live once in `@labre/affine-shared`'s `chrome.ts`. With no catalogue registered every surface reads exactly as it did before this change, letter for letter.

### Patch Changes

- a513f05: Displayed English now says "Canvas" where it said "Edgeless" and "Document" where "Page" named the document mode (display-mode options, note and frame toolbars, toasts, slash-menu group headers, surface-ref placeholders, the frame and mind-map slash-menu previews). Translation keys, identifiers and stored values are unchanged. Three keys that already shipped change their English fallback: `com.labre.embed.synced-doc.empty-preview`, `com.labre.toast.frame-inserted-into-page` and `com.labre.toast.note-removed-from-page-mode`. The mobile keyboard toolbar is left as is.
- b2781b5: refactor(blocks): one chrome word, one key. Where several packages declared the same English interface word under different keys (Copy-style verbs, text formats, display modes, Reload, Rename, Settings…), they now share one wording from `@labre/affine-shared/services`, and the key manifest carries 52 fewer entries. Nothing changes on screen, and no key that existed in a previous release is removed: the merged keys were all introduced by this release's translation work. The manifest spec now fails when a new interface word is declared under a second key (real homonyms such as « Light » or « Left » are allow-listed with a reason).
- Updated dependencies [a513f05]
- Updated dependencies [6cfe313]
- Updated dependencies [5776733]
- Updated dependencies [4ed9484]
- Updated dependencies [c4661f2]
- Updated dependencies [6271b11]
- Updated dependencies [924f7d6]
- Updated dependencies [5744cfd]
- Updated dependencies [feca957]
- Updated dependencies [1dac32d]
- Updated dependencies [b2781b5]
- Updated dependencies [223b280]
- Updated dependencies [47d4ac6]
  - @labre/affine-shared@0.41.0
  - @labre/affine-widget-slash-menu@0.41.0
  - @labre/affine-block-embed@0.41.0
  - @labre/affine-block-surface@0.41.0
  - @labre/std@0.41.0
  - @labre/affine-components@0.41.0
  - @labre/affine-rich-text@0.41.0
  - @labre/affine-inline-preset@0.41.0
  - @labre/affine-fragment-doc-title@0.41.0
  - @labre/affine-gfx-turbo-renderer@0.41.0
  - @labre/affine-model@0.41.0
  - @labre/affine-ext-loader@0.41.0
  - @labre/global@0.41.0
  - @labre/store@0.41.0

## 0.40.0

### Minor Changes

- 95ff0a5: feat(blocks): Labre owns its document heading scale (`HEADING_SCALE` in `@labre/affine-shared/consts`). H1 32 / H2 26 / H3 20 / H4 18 / H5 16 / H6 15px step down about 1.25× from the 40px doc title, so the first three levels read clearly apart and H1 never competes with the title. The callout emoji, the slash-menu previews and inline code in headings derive from the same table; the hover affordances (drag-handle grabber, heading-level icon) keep their upstream tuning. Document headings no longer follow the upstream `--affine-font-h-*` theme variables.

### Patch Changes

- Updated dependencies [5b41d83]
- Updated dependencies [95ff0a5]
- Updated dependencies [95ff0a5]
  - @labre/affine-inline-preset@0.40.0
  - @labre/affine-shared@0.40.0
  - @labre/affine-block-surface@0.40.0
  - @labre/affine-block-embed@0.40.0
  - @labre/affine-components@0.40.0
  - @labre/affine-fragment-doc-title@0.40.0
  - @labre/affine-rich-text@0.40.0
  - @labre/affine-widget-slash-menu@0.40.0
  - @labre/affine-ext-loader@0.40.0
  - @labre/affine-gfx-turbo-renderer@0.40.0
  - @labre/affine-model@0.40.0
  - @labre/global@0.40.0
  - @labre/std@0.40.0
  - @labre/store@0.40.0

## 0.39.3

### Patch Changes

- Updated dependencies [4ab8a5b]
- Updated dependencies [070e1ec]
  - @labre/affine-block-surface@0.39.3
  - @labre/affine-components@0.39.3
  - @labre/affine-block-embed@0.39.3
  - @labre/affine-fragment-doc-title@0.39.3
  - @labre/affine-inline-preset@0.39.3
  - @labre/affine-rich-text@0.39.3
  - @labre/affine-widget-slash-menu@0.39.3
  - @labre/affine-ext-loader@0.39.3
  - @labre/affine-gfx-turbo-renderer@0.39.3
  - @labre/affine-model@0.39.3
  - @labre/affine-shared@0.39.3
  - @labre/global@0.39.3
  - @labre/std@0.39.3
  - @labre/store@0.39.3

## 0.39.2

### Patch Changes

- Updated dependencies [07b47b8]
  - @labre/affine-shared@0.39.2
  - @labre/affine-block-surface@0.39.2
  - @labre/affine-block-embed@0.39.2
  - @labre/affine-components@0.39.2
  - @labre/affine-fragment-doc-title@0.39.2
  - @labre/affine-inline-preset@0.39.2
  - @labre/affine-rich-text@0.39.2
  - @labre/affine-widget-slash-menu@0.39.2
  - @labre/affine-ext-loader@0.39.2
  - @labre/affine-gfx-turbo-renderer@0.39.2
  - @labre/affine-model@0.39.2
  - @labre/global@0.39.2
  - @labre/std@0.39.2
  - @labre/store@0.39.2

## 0.39.1

### Patch Changes

- Updated dependencies [00eab3d]
  - @labre/affine-model@0.39.1
  - @labre/affine-fragment-doc-title@0.39.1
  - @labre/affine-block-embed@0.39.1
  - @labre/affine-block-surface@0.39.1
  - @labre/affine-components@0.39.1
  - @labre/affine-inline-preset@0.39.1
  - @labre/affine-rich-text@0.39.1
  - @labre/affine-shared@0.39.1
  - @labre/affine-widget-slash-menu@0.39.1
  - @labre/affine-ext-loader@0.39.1
  - @labre/affine-gfx-turbo-renderer@0.39.1
  - @labre/global@0.39.1
  - @labre/std@0.39.1
  - @labre/store@0.39.1

## 0.39.0

### Patch Changes

- @labre/affine-block-embed@0.39.0
- @labre/affine-block-surface@0.39.0
- @labre/affine-components@0.39.0
- @labre/affine-ext-loader@0.39.0
- @labre/affine-fragment-doc-title@0.39.0
- @labre/affine-gfx-turbo-renderer@0.39.0
- @labre/affine-inline-preset@0.39.0
- @labre/affine-model@0.39.0
- @labre/affine-rich-text@0.39.0
- @labre/affine-shared@0.39.0
- @labre/affine-widget-slash-menu@0.39.0
- @labre/global@0.39.0
- @labre/std@0.39.0
- @labre/store@0.39.0

## 0.38.2

### Patch Changes

- Updated dependencies [0ffa45b]
  - @labre/std@0.38.2
  - @labre/affine-block-embed@0.38.2
  - @labre/affine-block-surface@0.38.2
  - @labre/affine-components@0.38.2
  - @labre/affine-fragment-doc-title@0.38.2
  - @labre/affine-gfx-turbo-renderer@0.38.2
  - @labre/affine-inline-preset@0.38.2
  - @labre/affine-model@0.38.2
  - @labre/affine-rich-text@0.38.2
  - @labre/affine-shared@0.38.2
  - @labre/affine-widget-slash-menu@0.38.2
  - @labre/affine-ext-loader@0.38.2
  - @labre/global@0.38.2
  - @labre/store@0.38.2

## 0.38.1

### Patch Changes

- @labre/affine-block-embed@0.38.1
- @labre/affine-block-surface@0.38.1
- @labre/affine-components@0.38.1
- @labre/affine-ext-loader@0.38.1
- @labre/affine-fragment-doc-title@0.38.1
- @labre/affine-gfx-turbo-renderer@0.38.1
- @labre/affine-inline-preset@0.38.1
- @labre/affine-model@0.38.1
- @labre/affine-rich-text@0.38.1
- @labre/affine-shared@0.38.1
- @labre/affine-widget-slash-menu@0.38.1
- @labre/global@0.38.1
- @labre/std@0.38.1
- @labre/store@0.38.1

## 0.38.0

### Patch Changes

- Updated dependencies [28c0609]
- Updated dependencies [206b5a1]
- Updated dependencies [6a7c31a]
- Updated dependencies [90a23e1]
- Updated dependencies [b202320]
- Updated dependencies [6aa0081]
- Updated dependencies [f28a24f]
- Updated dependencies [13d17cf]
- Updated dependencies [65bfe30]
- Updated dependencies [dd22937]
- Updated dependencies [2b18c93]
  - @labre/affine-block-surface@0.38.0
  - @labre/affine-model@0.38.0
  - @labre/affine-shared@0.38.0
  - @labre/affine-block-embed@0.38.0
  - @labre/affine-fragment-doc-title@0.38.0
  - @labre/affine-components@0.38.0
  - @labre/affine-inline-preset@0.38.0
  - @labre/affine-rich-text@0.38.0
  - @labre/affine-widget-slash-menu@0.38.0
  - @labre/affine-ext-loader@0.38.0
  - @labre/affine-gfx-turbo-renderer@0.38.0
  - @labre/global@0.38.0
  - @labre/std@0.38.0
  - @labre/store@0.38.0

## 0.37.0

### Patch Changes

- Updated dependencies [9c7947d]
  - @labre/affine-block-surface@0.37.0
  - @labre/affine-block-embed@0.37.0
  - @labre/affine-fragment-doc-title@0.37.0
  - @labre/affine-components@0.37.0
  - @labre/affine-ext-loader@0.37.0
  - @labre/affine-gfx-turbo-renderer@0.37.0
  - @labre/affine-inline-preset@0.37.0
  - @labre/affine-model@0.37.0
  - @labre/affine-rich-text@0.37.0
  - @labre/affine-shared@0.37.0
  - @labre/affine-widget-slash-menu@0.37.0
  - @labre/global@0.37.0
  - @labre/std@0.37.0
  - @labre/store@0.37.0

## 0.36.0

### Patch Changes

- Updated dependencies [9fa662a]
- Updated dependencies [60fb357]
- Updated dependencies [3db21ea]
- Updated dependencies [7381b0b]
- Updated dependencies [f7c5b9b]
  - @labre/affine-components@0.36.0
  - @labre/affine-block-surface@0.36.0
  - @labre/affine-shared@0.36.0
  - @labre/std@0.36.0
  - @labre/affine-model@0.36.0
  - @labre/affine-block-embed@0.36.0
  - @labre/affine-fragment-doc-title@0.36.0
  - @labre/affine-inline-preset@0.36.0
  - @labre/affine-rich-text@0.36.0
  - @labre/affine-widget-slash-menu@0.36.0
  - @labre/affine-gfx-turbo-renderer@0.36.0
  - @labre/affine-ext-loader@0.36.0
  - @labre/global@0.36.0
  - @labre/store@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [ea5d249]
- Updated dependencies [e9cd7e1]
- Updated dependencies [de3560d]
- Updated dependencies [7f09608]
- Updated dependencies [cf0d8a1]
  - @labre/affine-components@0.35.0
  - @labre/affine-block-surface@0.35.0
  - @labre/affine-shared@0.35.0
  - @labre/std@0.35.0
  - @labre/affine-model@0.35.0
  - @labre/affine-block-embed@0.35.0
  - @labre/affine-fragment-doc-title@0.35.0
  - @labre/affine-inline-preset@0.35.0
  - @labre/affine-rich-text@0.35.0
  - @labre/affine-widget-slash-menu@0.35.0
  - @labre/affine-gfx-turbo-renderer@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-block-embed@0.34.2
- @labre/affine-block-surface@0.34.2
- @labre/affine-components@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-fragment-doc-title@0.34.2
- @labre/affine-gfx-turbo-renderer@0.34.2
- @labre/affine-inline-preset@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-rich-text@0.34.2
- @labre/affine-shared@0.34.2
- @labre/affine-widget-slash-menu@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2
- @labre/store@0.34.2

## 0.34.1

### Patch Changes

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-block-surface@0.34.1
  - @labre/affine-block-embed@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-fragment-doc-title@0.34.1
  - @labre/affine-inline-preset@0.34.1
  - @labre/affine-rich-text@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/affine-gfx-turbo-renderer@0.34.1
  - @labre/affine-widget-slash-menu@0.34.1
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
  - @labre/affine-block-surface@0.34.0
  - @labre/affine-block-embed@0.34.0
  - @labre/affine-components@0.34.0
  - @labre/affine-widget-slash-menu@0.34.0
  - @labre/affine-fragment-doc-title@0.34.0
  - @labre/affine-gfx-turbo-renderer@0.34.0
  - @labre/affine-inline-preset@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-rich-text@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Patch Changes

- Updated dependencies [3fbf69c]
- Updated dependencies [f929e12]
- Updated dependencies [13360cd]
- Updated dependencies [5c39582]
- Updated dependencies [8890efe]
- Updated dependencies [c03090c]
- Updated dependencies [32e4d45]
- Updated dependencies [139d77b]
- Updated dependencies [6bba40c]
- Updated dependencies [a8325bb]
- Updated dependencies [ff19911]
- Updated dependencies [7aa932c]
- Updated dependencies [b03132c]
- Updated dependencies [48049d6]
- Updated dependencies [7136db0]
- Updated dependencies [932bf35]
- Updated dependencies [5737a56]
- Updated dependencies [168617d]
- Updated dependencies [932bf35]
- Updated dependencies [9022c92]
- Updated dependencies [b97efc6]
- Updated dependencies [edfaba2]
- Updated dependencies [46ce0c9]
- Updated dependencies [334bd61]
- Updated dependencies [2ec39c0]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [4a3b26e]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-block-surface@0.33.0
  - @labre/affine-components@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-block-embed@0.33.0
  - @labre/affine-fragment-doc-title@0.33.0
  - @labre/affine-inline-preset@0.33.0
  - @labre/affine-rich-text@0.33.0
  - @labre/affine-widget-slash-menu@0.33.0
  - @labre/affine-gfx-turbo-renderer@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Patch Changes

- 913da26: Clicking a note title on the canvas puts the caret in the title

  Entering a note on the canvas always routed the click through the note's
  content: the click point was clamped into the children container, so a click
  anywhere on the note title landed in the first line of the body instead. The
  title was reachable only by clicking the body first and then arrowing back up.

  A click that falls inside the title band is now honoured where it fell. Clicks
  on the body keep the clamp that keeps them inside the text.

- 9fe5773: A note resized on the canvas no longer drifts away from its own outline

  A note carries a `scale` of its own on top of the viewport zoom, and that scale
  was applied to a wrapper _inside_ the block while the block element itself was
  laid out from the unscaled bound. At any scale other than 100% the two parted
  company: the painted content ran past the element's box, so the selection
  rectangle, the hit area and everything anchored to the block — the toolbar, the
  resize handles, the collapse arrow — sat where the note used to be rather than
  where it now looks.

  The scale now belongs to the block element's transform, the single place that
  already carries the zoom, so box and content are the same size again at every
  scale. Notes at 100% are unaffected.

- b684b4c: Shift-clicking inside a note being edited no longer throws away the selection

  Selecting a range of text in an edgeless note the way every editor does it —
  click at the start, shift-click at the end — was read as a canvas multi-select
  instead: the note was toggled out of editing, and the range went with it. What
  followed, a delete or a drag meant for the selected text, had nothing to act on.

  A shift-click on a note that is already selected and being edited is now left
  to the text layer, so the range is built as expected. Shift-clicking a note
  that is not being edited still adds it to the canvas selection.

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [90a9168]
- Updated dependencies [6417a2f]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [50ab9ae]
- Updated dependencies [89b90e9]
- Updated dependencies [f7f23b2]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [5ac0c68]
- Updated dependencies [630633b]
- Updated dependencies [1fa46c1]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [86e7562]
- Updated dependencies [492bac6]
- Updated dependencies [72b334c]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [5076cb8]
- Updated dependencies [3c5c97e]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [c7612da]
- Updated dependencies [3e1665b]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [1c37478]
- Updated dependencies [48e90f4]
- Updated dependencies [5a61fb2]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [025d6f5]
- Updated dependencies [b1ed4ef]
- Updated dependencies [985a92f]
- Updated dependencies [b889326]
- Updated dependencies [1efc6d5]
- Updated dependencies [4162e4a]
- Updated dependencies [3ac3587]
- Updated dependencies [fad4c08]
- Updated dependencies [7b940cf]
- Updated dependencies [7b66d8d]
- Updated dependencies [184c412]
- Updated dependencies [4bb44ef]
- Updated dependencies [30061cb]
- Updated dependencies [c2735aa]
- Updated dependencies [346b5d9]
- Updated dependencies [77b0100]
- Updated dependencies [8d33c60]
- Updated dependencies [061729e]
- Updated dependencies [7a3458a]
  - @labre/std@0.32.0
  - @labre/affine-shared@0.32.0
  - @labre/store@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-block-surface@0.32.0
  - @labre/affine-inline-preset@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-widget-slash-menu@0.32.0
  - @labre/affine-block-embed@0.32.0
  - @labre/affine-fragment-doc-title@0.32.0
  - @labre/affine-gfx-turbo-renderer@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-embed@0.31.0
  - @labre/affine-block-surface@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-fragment-doc-title@0.31.0
  - @labre/affine-gfx-turbo-renderer@0.31.0
  - @labre/affine-inline-preset@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/affine-widget-slash-menu@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-embed@0.30.2
- @labre/affine-block-surface@0.30.2
- @labre/affine-components@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-fragment-doc-title@0.30.2
- @labre/affine-gfx-turbo-renderer@0.30.2
- @labre/affine-inline-preset@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-rich-text@0.30.2
- @labre/affine-shared@0.30.2
- @labre/affine-widget-slash-menu@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-block-embed@0.30.1
- @labre/affine-block-surface@0.30.1
- @labre/affine-components@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-fragment-doc-title@0.30.1
- @labre/affine-gfx-turbo-renderer@0.30.1
- @labre/affine-inline-preset@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-rich-text@0.30.1
- @labre/affine-shared@0.30.1
- @labre/affine-widget-slash-menu@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-block-embed@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-fragment-doc-title@0.30.0
  - @labre/affine-gfx-turbo-renderer@0.30.0
  - @labre/affine-inline-preset@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-slash-menu@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-embed@0.29.1
- @labre/affine-block-surface@0.29.1
- @labre/affine-components@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-fragment-doc-title@0.29.1
- @labre/affine-gfx-turbo-renderer@0.29.1
- @labre/affine-inline-preset@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-rich-text@0.29.1
- @labre/affine-shared@0.29.1
- @labre/affine-widget-slash-menu@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-embed@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/affine-fragment-doc-title@0.29.0
  - @labre/affine-inline-preset@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-widget-slash-menu@0.29.0
  - @labre/affine-gfx-turbo-renderer@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-block-embed@0.28.0
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-fragment-doc-title@0.28.0
  - @labre/affine-gfx-turbo-renderer@0.28.0
  - @labre/affine-inline-preset@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-slash-menu@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-block-embed@0.27.0
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/affine-fragment-doc-title@0.27.0
  - @labre/affine-gfx-turbo-renderer@0.27.0
  - @labre/affine-inline-preset@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-slash-menu@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-block-embed@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-fragment-doc-title@0.26.0
  - @labre/affine-inline-preset@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-widget-slash-menu@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/affine-gfx-turbo-renderer@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.25.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-block-embed@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-fragment-doc-title@0.25.0
  - @labre/affine-inline-preset@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-slash-menu@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/affine-gfx-turbo-renderer@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-block-embed@0.24.0
- @labre/affine-block-surface@0.24.0
- @labre/affine-components@0.24.0
- @labre/affine-ext-loader@0.24.0
- @labre/affine-fragment-doc-title@0.24.0
- @labre/affine-gfx-turbo-renderer@0.24.0
- @labre/affine-inline-preset@0.24.0
- @labre/affine-model@0.24.0
- @labre/affine-rich-text@0.24.0
- @labre/affine-shared@0.24.0
- @labre/affine-widget-slash-menu@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-block-embed@0.23.3
  - @labre/affine-block-surface@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/affine-fragment-doc-title@0.23.3
  - @labre/affine-inline-preset@0.23.3
  - @labre/affine-rich-text@0.23.3
  - @labre/affine-widget-slash-menu@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-gfx-turbo-renderer@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-block-embed@0.23.2
  - @labre/affine-block-surface@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/affine-fragment-doc-title@0.23.2
  - @labre/affine-inline-preset@0.23.2
  - @labre/affine-rich-text@0.23.2
  - @labre/affine-widget-slash-menu@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-gfx-turbo-renderer@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-block-embed@0.23.1
  - @labre/affine-block-surface@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/affine-fragment-doc-title@0.23.1
  - @labre/affine-inline-preset@0.23.1
  - @labre/affine-rich-text@0.23.1
  - @labre/affine-widget-slash-menu@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-gfx-turbo-renderer@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
  - @labre/affine-model@0.23.0
  - @labre/affine-block-surface@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-block-embed@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-fragment-doc-title@0.23.0
  - @labre/affine-inline-preset@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-widget-slash-menu@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/affine-gfx-turbo-renderer@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
