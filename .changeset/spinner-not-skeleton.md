---
'@labre/affine': patch
---

A value still on its way now draws a spinner instead of a grey skeleton: a pending cell of a database view (table, kanban, gallery, list) shows the library's `LoadingIcon` centred in the cell, and the title band shows it centred while a page's properties load. A pending cell still mounts no editor and takes no write. The cell's test id is now `dv-cell-loading` (was `dv-cell-skeleton`); the band keeps `title-band-loading`. `LoadingIcon` now rotates by SMIL instead of a `<style>` in its SVG, which applied to every `.spinner` of the page.
