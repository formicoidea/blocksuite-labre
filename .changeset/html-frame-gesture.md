---
'@labre/affine-block-attachment': minor
'@labre/affine-block-embed': minor
'@labre/affine-components': minor
'@labre/affine': minor
---

No script of an html attachment runs without a reader's gesture, Interact or full
screen. `labre-html-frame` gains `scripts`, off by default and never on for a
thumbnail, and answers the host's page with `{ html, scripts }`: a host's frame must
run scripts only on an explicit `scripts: true`. A `srcdoc` is `sandbox=""` until the
gesture. The html block asks for no scripts, so a stored block that draws itself with
a script stays empty.

An html file now opens on its embed view, in a page and on the canvas. "Interact" turns
on every embed view of the document, a press outside all of them turns them off. An
embed view scrolls when it can; on the canvas its width and height change on their own
and it opens around its centre; in a page its height has a handle, stored in `xywh`. New
key: `com.labre.attachment.html.resize` (ADR 0048).
