---
'@labre/affine': patch
---

The database view bar left-aligns with the title and the rows, inline and on the full page: the first tab's icon sat 4px right of both (the tab's padding, now hung into the gutter). On the full page, a table wide enough for the page layout no longer starts left of the centred page heading: the root pads by the heading's centring inset (`--affine-database-page-inset`), which the sticky view bar reads too.
