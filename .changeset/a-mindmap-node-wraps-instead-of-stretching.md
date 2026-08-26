---
'@labre/affine-model': patch
'@labre/affine-gfx-shape': patch
---

A mindmap node wraps instead of stretching across the board

A node whose text was long grew a single line as wide as the sentence, pushing
the rest of the branch off screen and making the map unreadable. The four
mindmap styles now cap their nodes at 512px: past that width the text wraps and
the node grows downwards. The cap is applied while typing too — the editor
measures the wrapped text rather than the line it would have drawn, so what is
being written stays inside the node.

This is a deliberate change of rendering for documents that already contain
long nodes. Opening such a document changes nothing: no layout runs on load, so
the map paints exactly as it was stored. The first layout of the session — the
first node added, moved, collapsed or edited — is what adopts the cap, and the
long nodes then re-wrap. Nothing else moves: nodes shorter than 512px are laid
out exactly as before.

Shapes other than mindmap nodes are untouched. They carry no maximum width, and
the editor keeps measuring them the way it always has, so the Grow mode of the
Wardley, EDGY, DDD and Cynefin shapes behaves identically.

Also fixes a mindmap that wrote its node positions to the document mid-edit: a
layout requested while the tree was already stashed used to un-stash it and
flush every intermediate position into the history.
