---
'@labre/affine': patch
---

A database derives its full-page layout from the page it is drawn in: rendered by the full page's root under a `<doc-title>` whose `bodyBlockId` names it, it hides its own title row and top margin and its table sticks its column header to the page; a full page mounted without that heading now renders the database as inline, its title shown, instead of hiding it anyway. `<doc-title>` reflects `bodyBlockId` as its `body-block-id` attribute. Nothing is written to measure it.
