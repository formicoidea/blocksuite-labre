---
'@labre/affine-block-embed': minor
---

The html block can run in a page its host serves, through
`EmbedHtmlConfigExtension({ frameUrl })`, so that a host's script policy no
longer stops the scripts of a stored block. Without the extension the block stays
on `srcdoc`, and nothing persisted changes (ADR 0047).
