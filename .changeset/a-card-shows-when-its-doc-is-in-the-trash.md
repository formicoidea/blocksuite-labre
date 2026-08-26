---
'@labre/store': patch
'@labre/affine-block-embed-doc': patch
---

A card shows when the doc it points to is in the trash

A doc the host has moved to its trash stays in the workspace: it still loads
and still syncs. Linked-doc and synced-doc cards took that at face value and
kept showing the title, the preview and the content of a doc the reader can no
longer find anywhere — only a doc removed from the workspace outright read as
deleted.

Doc metadata now carries an optional `trash` flag, set by the host alongside
its own trash, and both cards read it: a trashed target renders the same
deleted card as a missing one, and a synced card stops embedding its content.
The flag is optional and stored key by key, so documents written before it
load unchanged and older readers ignore it.

Both cards also refresh themselves when the doc list changes, instead of only
refreshing the "updated at" date, so trashing or restoring a doc updates the
cards pointing at it without a reload — and a synced card recomputes whether
its target is empty after each refresh.
