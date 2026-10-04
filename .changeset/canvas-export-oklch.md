---
'@labre/affine-shared': patch
'@labre/affine-block-surface': patch
'@labre/affine-block-root': patch
---

PNG/PDF export and "copy as image" no longer fail under a theme written in
`oklch()` (or any colour html2canvas cannot parse, including the library's own
`color-mix()`): the rasterised clone's computed colours, the page background and
the `backgroundColor` option are converted to `rgb()` / `rgba()` first. New
`normalizeCanvasExportColors` and `toLegacyColors` in `@labre/affine-shared/utils`.
