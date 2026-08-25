---
'@labre/affine-block-note': patch
---

Shift-clicking inside a note being edited no longer throws away the selection

Selecting a range of text in an edgeless note the way every editor does it —
click at the start, shift-click at the end — was read as a canvas multi-select
instead: the note was toggled out of editing, and the range went with it. What
followed, a delete or a drag meant for the selected text, had nothing to act on.

A shift-click on a note that is already selected and being edited is now left
to the text layer, so the range is built as expected. Shift-clicking a note
that is not being edited still adds it to the canvas selection.
