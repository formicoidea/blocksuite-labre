---
'@labre/affine': minor
---

Page cards placed in a note now default to the one-line view (`style: 'list'`, "Small horizontal style"): the slash menu's "New Page", a page dropped from the host's sidebar into a note, "Show here" in the page view, "Linked doc" from the quick search, an inline reference turned into a card and "Create linked doc" from a text selection. The new `LINKED_DOC_NOTE_STYLE` constant (`@labre/affine-shared/consts`) names it; cards on the canvas keep their style and stored cards are untouched. The title band seam gains an optional `TitleBandService.children$(docId)`: the ids of the document's child pages in the host's tree. A linked-doc card or a synced-doc embed of one of them draws the plain page (or canvas) icon, without the arrow of the linked-page icon that an inline `@` reference keeps. Without it, every card keeps the arrow, as before. `notShown$` is unchanged.
