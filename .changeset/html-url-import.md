---
'@labre/affine-block-attachment': minor
'@labre/affine-block-bookmark': minor
'@labre/affine-block-embed': major
'@labre/affine-components': major
'@labre/affine-shared': major
'@labre/affine': major
---

The `affine:embed-html` block is retired: a stored one renders a readable card, in a
page and on the canvas, its html stays in the document and runs nothing, and a paste or
a duplicate on the canvas no longer writes a new one. Its schema stays, so every document
opens. Removed: `EdgelessClipboardEmbedHtmlConfig`, `EmbedHtmlFullscreenToolbar`,
`HtmlIcon`, `CLOSED_SANDBOX`, and `srcdocFallback` and `noScroll` of `labre-html-frame`,
which without `frameUrl` now renders nothing.

`EmbedHtmlConfigExtension` becomes `HtmlFileConfigExtension`, and takes `importPage`: a
link card then offers an import button, and the host's answer turns the card into an html
attachment at its place, as one undo step (ADR 0048, amendment of 2026-11-04). New keys:
`com.labre.bookmark.import-page.{label,failed}`,
`com.labre.embed.html.{retired-title,retired-description}`. Removed key:
`com.labre.embed.html.empty`.
