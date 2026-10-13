---
'@labre/affine-shared': minor
'@labre/affine-fragment-doc-title': minor
'@labre/affine-block-note': minor
'@labre/data-view': minor
'@labre/affine': minor
---

A band of property chips under the page title and at the head of the page note on the canvas, fed by the host (ADR 0035 §9d and §11). New seam `TitleBandExtension(service)` / `TitleBandProvider` in `@labre/affine/shared/services`: `sheet$(docId)` returns the page's visible properties as data-view types and cell values (`loading`, `ready`, `missing`, `error`), `set(docId, propertyId, value)` hands every edit back (the chip shows pending until it settles, the band never applies a value), and the optional `add`, `collapsed$` / `setCollapsed` and `notShown$` draw the "+", remember the collapse and, on the canvas only, a "Not shown in this document" row of page links. An empty visible property draws an empty chip that can still be clicked. On the canvas the band lives inside the note, so it follows the zoom. Without the seam nothing is drawn and nothing changes: no value lives in the document.

New seam `PropertiesPanelExtension({ open, close } | null)` / `PropertiesPanelProvider`: the band's panel button sends `open({ scope: 'page', docId })`; absent or `null`, there is no button. The request type also declares `scope: 'source'` for the database chrome to come.

`@labre/affine/host-panels` gains `formatPropertyValue(property, locale?)` and `isPropertyValueEmpty(property)`, so a host's panel reads values as the chips do, and re-exports the sheet and request types.

The page title reads its family from `--labre-doc-title-font-family`, falling back to the body family: a host sets the title's face (Cabinet Grotesk in the Labre app) without touching the headings.

`@labre/data-view/property-pure-presets` exports the number preset's `formatNumber`, `NumberFormat` and `NumberFormatSchema`. New keys `com.labre.title-band.*` (add, clear, collapse, empty, expand with `{{count}}`, label, loading, not-shown, open-panel).
