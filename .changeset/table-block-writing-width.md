---
'@labre/affine': patch
---

A wide table block scrolls within the text column, as an inline database now does: it no longer bleeds its scroller into the page's gutters (its distance to the editor's edge, minus 72px); only its 10px of row handles hang into the gutter. `VirtualPaddingController` is deprecated, no block uses it any more.
