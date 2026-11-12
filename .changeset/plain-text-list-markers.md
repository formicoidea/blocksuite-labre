---
'@labre/affine-shared': patch
'@labre/affine-block-list': patch
---

Plain text (the plain-text export and the `text/plain` copy) now writes list markers as the Markdown export does: `- ` for a bullet or a toggle, `N. ` for a numbered item from its list's start number, `[ ] ` / `[x] ` for a to-do, and sub-lists indented by their parent's marker width. Other blocks are written as before. `listPlainTextPrefix` is exported from `@labre/affine-shared/adapters`.
