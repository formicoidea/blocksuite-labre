---
'@labre/affine-shared': patch
---

A caret placed past the end of a line no longer blinks once and vanishes

Clicking in the empty space to the right of a line asks the browser where the
caret should go, and the browser answers with a position anchored on the
paragraph _element_ rather than on the text inside it. The editor only tracks
carets that live in text, so the caret appeared for a frame and was then thrown
away — the click looked like it had done nothing.

Such an answer is now walked back to the nearest meaningful text node before the
selection is set, so the caret lands at the end of the line the user clicked
next to. Clicks that already land on text are untouched.
