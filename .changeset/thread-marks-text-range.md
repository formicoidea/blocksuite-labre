---
'@labre/affine-shared': minor
'@labre/affine-widget-thread-marks': minor
'@labre/affine': minor
---

The thread-marks seam gains a run of text (ADR 0038, amendment of
2026-10-15). `ThreadOpenRequest` and `ThreadMark` take an optional
`range?: ThreadTextRange` (`{ start, end }`, two Yjs relative positions on the
block's text, base64, opaque to the host; the type is also exported by
`@labre/affine/host-panels`). "Discuss" on a text selection now hands the
block the selection starts in (the first one when it covers several) with the
selected `range`, and `excerpt` is the selected text. A mark that carries a
`range` is highlighted over its words in the page view, follows every edit,
and opens its discussion on click; a run whose text was deleted is not drawn
and the block's mark stays. Nothing is written to the document. A host that
ignores `range` compiles and behaves as before.
