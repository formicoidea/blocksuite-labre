---
'@labre/affine': patch
---

Fix the empty font style menu outside Firefox

Surface fonts are registered with quoted family names (`"blocksuite:surface:Inter"`)
while models store them unquoted (`blocksuite:surface:Inter`). `isSameFontFamily`
branched on `IS_FIREFOX` and only added the quotes on the Firefox path, so on
Chrome — and every other non-Firefox browser — `getFontFacesByFontFamily` matched
nothing.

With no matching font face, `edgeless-font-weight-and-style-panel` rendered zero
rows: opening "Font style" on a text, shape, connector or edgeless text element
showed an empty 124×36 box, making weight and italic unreachable. Family matching
is now quote-insensitive on both sides and no longer depends on the engine.
