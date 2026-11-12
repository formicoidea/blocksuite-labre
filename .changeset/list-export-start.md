---
'@labre/affine-block-list': patch
---

The Markdown and HTML exports keep the start number of a numbered list that does not start at 1 (`3.` / `<ol start="3">`), read from the stored `order` of its first item, so an export then import round trip keeps the numbering and a copied list pastes into another app with its numbers. A list starting at 1 or without an order exports exactly as before.
