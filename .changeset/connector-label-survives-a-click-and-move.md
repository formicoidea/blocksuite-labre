---
'@labre/std': patch
---

A connector label editor no longer freezes the canvas after a click and a move

`click`, `doubleClick` and `tripleClick` are not real DOM events: the dispatcher
synthesizes all three from a single native `pointerup`. When a handler consumed
one of them, the dispatcher called `stopPropagation()` on that shared native
event, and the `pointerup` never reached the listeners bound higher up on
`document` — the drag controller, the pan tool, the connector handles, the
auto-complete teardown. Those listeners are what end a gesture, so the gesture
stayed open.

The visible symptom: open an empty connector label editor, click and move.
The label editors (connector, group title, frame title, edgeless text, shape
text) all swallow clicks while open by returning `true`, so the pointer gesture
was never closed and the label broke.

Consuming a synthetic click still stops the dispatcher's own handler chain, so
the "swallow the click" behaviour those editors rely on is unchanged; only the
side effect on the underlying native event is gone. Native events (`pointerDown`,
`keyDown`, drag events, …) still stop propagation as before.
