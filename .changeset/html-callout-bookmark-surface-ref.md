---
'@labre/affine': minor
---

`HtmlAdapter` prints a callout, a bookmark and a surface reference as blocks a
stylesheet can set apart, for a page published as static HTML. A callout is
`div.affine-callout[data-emoji]` holding `span.affine-callout-emoji` (both left out
when the emoji is empty) and
`div.affine-callout-body` (its line as a `<p>`, then its children); it replaces
the `aside.affine-callout` / `span.affine-callout-icon` of 3.4.0. A bookmark is
`a.affine-bookmark[rel=noopener]` built from the stored link metadata only
(`-title`, `-description`, `-host` spans, favicon on `data-icon`), in place of
a bare link in a paragraph container. A surface reference is
`div.affine-surface-ref[data-labre-surface-ref][data-labre-surface-ref-type=frame|group]`
with
`span.affine-surface-ref-title` (the frame's or group's title, read from the
page's surface) and `span.affine-surface-ref-caption`; the mount attribute of
3.4.0 and ADR 0050 is unchanged. Host guide: `docs/integrate/09-static-html.md`.
