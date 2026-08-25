---
'@labre/std': patch
---

Copying between documents keeps the blocks instead of falling back to plain text

The clipboard carries its structured payload — the block snapshot, the surface
slice, the database slice — inside the `text/html` flavour, hidden in a
`data-blocksuite-snapshot` attribute. That wrapper was only written when an
adapter had produced HTML, or when the clipboard was otherwise completely
empty. A copy that produced plain text and no HTML therefore shipped the plain
text alone and dropped its own payload on the floor: pasting it into another
document rebuilt whatever the plain-text fallback could guess, losing the
blocks, the canvas elements and every property they carried — including the
Labre ones, the semantic role of a surface element and its element docId.
Copying cells out of a database table was the reachable case.

The wrapper is now written whenever there is a payload to preserve, whatever
the adapters produced. When no adapter produced HTML the copied plain text is
escaped into the wrapper, so pasting into an outside application still shows
the text rather than an empty box; a copy that carries no payload at all — the
"copy code" button of an embedded HTML block — still puts plain text on the
clipboard and nothing else. The snapshot attribute is also quoted the way the
HTML serializer would quote it.
