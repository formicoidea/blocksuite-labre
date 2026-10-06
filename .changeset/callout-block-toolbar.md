---
'@labre/affine-block-callout': patch
'@labre/affine-block-root': patch
'@labre/affine-shared': patch
---

A callout selected with its drag handle now opens a block toolbar (#468),
centred above it like the paragraph and code block rows. As on those rows,
"Turn into" appears only once the callout holds some text.
Its "Turn into" offers the text kinds — text, headings, lists, code block,
quote — and unwraps the callout: its children take its place, converted to
the chosen kind (merged into one code block for "Code block"), their own
children kept; the emoji goes with the callout. One undo step restores it,
and an entry whose conversion could not complete is not offered. The "⋮"
menu adds copy, duplicate and delete, each taking the callout with its
content, and the comment button appears when the
host provides comments.

No new translation key: the row reuses `com.labre.root.toolbar.turn-into`
("Turn into") and `com.labre.root.toolbar.conversions` ("Conversions"), now
shared chrome wordings (`TOOLBAR_TURN_INTO`, `TOOLBAR_CONVERSIONS_ARIA` in
`@labre/affine-shared/services`); the root block's `ROOT_TOOLBAR_*` names for
them remain as aliases.
