---
'@labre/affine-database-editor': minor
---

The full-page database draws the host's page title: `<affine-database-page>` gains `heading` (an element, typically `<doc-title>` with its `bodyBlockId`) and renders it first in its own viewport, which is now the page's only scroller, so a long table no longer shows a second scrollbar inside the page. On that page the title sits on the view bar (no bottom padding under the title, no top margin or padding on the block). Without `heading`, the page renders as before; a host that wrapped the page in its own viewport should pass its title as `heading` instead.
