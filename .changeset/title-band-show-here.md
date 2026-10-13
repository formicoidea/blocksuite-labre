---
'@labre/affine-shared': minor
'@labre/affine-fragment-doc-title': minor
---

The title band's "Not shown in this document" row is now drawn in both views, under the page title as well as in the note header on the canvas (ADR 0035 §9d, amended 2026-10-13; labre ADR-0045 §7). A host that drew its own row under the title in the page view drops it: the library draws it from the same `notShown$`. Each listed page gains a "Show here" button (`com.labre.title-band.show-here`) on a writable document: it inserts an `affine:embed-linked-doc` card of the page, at the end of the last note in the page view and at the centre of the visible canvas on the canvas (through the layer-stamping CRUD path, then selected), as one undo step, and emits `BlockCreated`. The library writes only that card; dropping the page from `notShown$` once it shows stays the host's reading of the document. A read-only document keeps the page links and gets no button.
