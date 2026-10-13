---
'@labre/affine-shared': patch
'@labre/affine-inline-link': patch
'@labre/affine-block-bookmark': patch
'@labre/affine-block-embed': patch
'@labre/affine-block-database': patch
'@labre/affine-components': patch
'@labre/affine-inline-footnote': patch
'@labre/affine-widget-edgeless-selected-rect': patch
---

Links only open `http:`, `https:` and `mailto:` addresses (and scheme-less ones such as `example.com`, read as https). A link stored with any other scheme (`javascript:`, `data:`, `vbscript:`, `file:`, also when spelled with mixed case, spaces or control characters) still shows its text but renders no href and opens nothing: the inline link, its hover preview, the bookmark and the GitHub, YouTube, Loom and Figma embed cards, footnote URL references, the database link cell and the canvas element link button. The Markdown import drops the link mark of such a link and keeps its text. Nothing stored is rewritten. New export `isSafeLinkUrl(url)` in `@labre/affine-shared/utils`, the predicate every one of these sites calls.
