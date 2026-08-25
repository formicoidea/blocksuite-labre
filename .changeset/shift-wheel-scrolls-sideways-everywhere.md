---
'@labre/affine-block-root': patch
---

Shift + wheel scrolls the canvas sideways on every platform

Holding shift while turning the wheel scrolls the edgeless canvas horizontally.
That only worked on Windows: elsewhere the gesture was handed straight to the
vertical pan, so a plain mouse — one with a vertical wheel and nothing else —
could not scroll sideways at all on macOS or Linux.

The substitution now also applies whenever the browser reports no horizontal
delta of its own, which is exactly the plain-mouse case. Trackpads and
horizontal-capable mice, whose shift+wheel the OS already converts, are
untouched.
