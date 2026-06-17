---
'@labre/affine-shared': patch
---

feat(edgeless): injectable `LinkedDocCreationProvider`

Adds a DI seam (mirrors `DocModeProvider`) so a host app can control how the
edgeless "Create linked doc" action creates its new doc — e.g. to route creation
through a persistence layer instead of an ephemeral in-workspace doc.
`createLinkedDocFromEdgelessElements` resolves it via `std.getOptional` and falls
back to the previous behaviour when no provider is registered.
