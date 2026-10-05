---
'@labre/affine-block-surface': minor
---

Behaviour change on move: a framework board is no longer pushed back under the
elements it covers when the user moves it. A board is still placed under what it
covers when it is created, pasted, duplicated, inserted from a template or
imported, and anything dropped or moved onto a board is still raised above it;
but after that a board's stacking is the user's, so a board raised above an
artefact (from the selection pane or with "bring forward") stays there when it
is dragged, and a board moved over free elements now covers them. Existing
documents paint exactly as before; nothing stored changes (ADR 0033).
