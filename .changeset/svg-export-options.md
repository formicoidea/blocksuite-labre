---
'@labre/affine-block-surface': minor
'@labre/affine-block-edgeless-text': minor
'@labre/affine': minor
---

"Export SVG" in a board's "⋮" now asks what to include before it writes the
file: three switches, all on by default — "Framework elements" (the board, its
framework's artefacts and its legend), "Other shapes and strokes" and "Other
texts" — remembered for the session. Edgeless text blocks, which the text tool
creates by default, are now in the file as vector text. The palette, catalogue,
shortcut and agent paths still export everything without asking. New keys:
`com.labre.export.svg.option.framework`, `…option.shapes`, `…option.texts`,
`com.labre.export.svg.confirm` and `com.labre.export.svg.nothing`.
