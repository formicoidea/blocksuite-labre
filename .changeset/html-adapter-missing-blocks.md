---
'@labre/affine': minor
---

`HtmlAdapter` prints every stored block. New matchers for the callout (`aside.affine-callout`), the latex block (KaTeX, `<code>` when it refuses), the attachment (a link to `assets/<blobId>`, never read), the surface reference (`data-labre-surface-ref`, a place for a host to mount a viewer), the edgeless text and the HTML embed (its caption, never its markup). A block no matcher knows now prints `div.affine-unknown-block` with its title or text instead of nothing, and an image with no blob at hand prints under its id instead of disappearing. The surface matcher is now registered, as it never was: blocks placed on the canvas no longer print at the top of an exported page. `HastUtils.parseFragment` is new. Host guide: `docs/integrate/09-static-html.md`.
