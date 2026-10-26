---
'@labre/affine-database-editor': minor
'@labre/data-view': patch
---

The full-page database draws the host's page title: `<affine-database-page>` gains `heading` (an element, typically `<doc-title>` with its `bodyBlockId`) and renders it first in its own viewport, which is now the page's only scroller, so a long table no longer shows a second scrollbar inside the page. On that page the title sits on the view bar (no bottom padding under the title, no top margin or padding on the block), and a table view scrolls with the page in both directions: its column header sticks natively to the top (it no longer jumps while scrolling) and the title and the view bar stay in view sideways. The table's wrapper and scroller gain the stable classes `dv-table-wrapper` and `dv-table-scroll-container`, and the column header no longer offsets itself by script when a host makes it sticky. Without `heading`, the page renders as before; a host that wrapped the page in its own viewport should pass its title as `heading` instead.
