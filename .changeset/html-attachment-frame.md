---
'@labre/affine-block-attachment': minor
'@labre/affine-block-embed': minor
'@labre/affine-components': minor
'@labre/affine-shared': minor
'@labre/affine': minor
---

An html file can be imported, previewed and shown as a thumbnail, in a page and on
the canvas, once a host names its page through `EmbedHtmlConfigExtension({ frameUrl })`.
It is an ordinary attachment; without the page it stays a card. The frame is one
component, `labre-html-frame` (`@labre/affine/components/html-frame`), that the html
block now mounts too and a host can mount outside the editor.

`AttachmentEmbedConfig` widens: `check` and `render` receive an optional `std`, and
`renderThumbnail` is optional. `EmbedHtmlConfigExtension` also comes from
`@labre/affine-shared/services`. Removed: `EmbedHtmlBlockComponent.iframe`, which
nothing read, the frame being in the component's shadow root. New keys:
`com.labre.attachment.html.{interact,stop-interacting,fullscreen,exit-fullscreen}`
(ADR 0048).
