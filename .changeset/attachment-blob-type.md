---
'@labre/affine-block-attachment': patch
---

Security: an attachment file no longer runs on the host's origin. The `blob:` url
of an attachment took its type from the block's `type` prop, which any
collaborator writes, and the pdf frame has no sandbox: a late write of
`application/pdf` ran an html file with the reader's tokens, with no click. The
url now carries a type from a list of what is inert, otherwise
`application/octet-stream`, and `AttachmentBlockComponent.open` hands over a file
outside that list instead of opening it (ADR 0028, amendment of 2026-11-04).
Nothing persisted changes.
