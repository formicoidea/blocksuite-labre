---
'@labre/std': patch
---

The editor stops listening once the selection leaves it

The event dispatcher only stood down when focus visibly moved away — a
`focusout` naming another focusable element, or a `blur` on the host. Selecting
text in an ordinary element outside the editor does neither: nothing takes
focus, so no `relatedTarget` is reported and no blur fires. The editor stayed
active over a selection that was no longer its own, and kept claiming
keystrokes meant for whatever the reader had just highlighted — Backspace and
undo included.

The dispatcher now also watches `selectionchange`: when either end of the
document selection sits outside the host, it deactivates. Clicking, hovering or
focusing back into the editor reactivates it exactly as before.
