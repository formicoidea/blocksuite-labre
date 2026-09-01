---
'@labre/affine-shared': patch
'@labre/affine-block-surface': patch
'@labre/affine-block-attachment': patch
'@labre/affine-block-bookmark': patch
'@labre/affine-block-code': patch
'@labre/affine-block-database': patch
'@labre/affine-block-embed': patch
'@labre/affine-block-embed-doc': patch
'@labre/affine-block-frame': patch
'@labre/affine-block-image': patch
'@labre/affine-block-note': patch
'@labre/affine-block-root': patch
'@labre/affine-block-surface-ref': patch
'@labre/affine-components': patch
'@labre/affine-inline-link': patch
'@labre/affine-inline-reference': patch
'@labre/affine-widget-toolbar': patch
'@labre/affine-widget-edgeless-toolbar': patch
'@labre/affine-widget-slash-menu': patch
'@labre/affine-widget-keyboard-toolbar': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-c4': patch
'@labre/affine-gfx-edgy': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-gfx-cynefin-estuarine': patch
'@labre/affine-gfx-ddd-context-map': patch
'@labre/affine-gfx-ddd-core-domain': patch
'@labre/affine-gfx-ddd-event-storming': patch
'@labre/std': patch
'@labre/affine': patch
---

fix(blocks): core toasts, board tooltips, catalogue headers and seed texts cross the translation seam

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
