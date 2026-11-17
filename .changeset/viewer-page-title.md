---
'@labre/affine': patch
---

The read-only canvas viewer draws the page title at the head of the page's note again (#668). 3.5.0 left out the provider that defines `<doc-title>`, so the title was missing on a published canvas.
