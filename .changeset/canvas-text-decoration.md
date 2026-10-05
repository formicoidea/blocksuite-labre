---
'@labre/affine-model': minor
'@labre/affine-gfx-text': minor
'@labre/affine-gfx-shape': minor
'@labre/affine-gfx-connector': minor
'@labre/affine-components': minor
'@labre/affine-shared': minor
'@labre/affine-block-edgeless-text': minor
---

Canvas text can be underlined and overlined (ADR 0030). A canvas text, a
shape's text and a connector's labels gain one optional stored field,
`textDecoration` (`TextDecoration`: `none`, `underline`, `overline`,
`underline overline` — an append-only CSS token list, read token by token so a
future token is skipped rather than the whole value), absent until the author
sets it: documents drawn before this change store and paint exactly as they
did, and nothing is migrated. The text toolbar of a canvas text, a shape and a
connector gains two toggles, Underline and Overline, each one undo step; the
line is painted under the measured words by the three canvas renderers (so the
SVG export carries it) and shown as CSS by the overlay editors and the
connector DOM renderer. A decoration is not remembered as the last-used text
style. New key for hosts to translate: `com.labre.text-format.overline`
("Overline"); the underline toggle reuses `com.labre.text-format.underline`.
