---
'@labre/affine-gfx-shape': patch
---

A shape grows while an IME composition is still under way

Typing Chinese, Japanese or Korean into a shape — a mindmap node above all —
builds the word in a preedit string that lives only in the DOM until the user
validates it. Nothing told the shape to remeasure in the meantime, so the word
being composed ran outside the node it was being typed into, and the node only
caught up once the composition ended.

The editor now remeasures once per frame while a composition is in progress, and
once more when it ends. A mindmap re-places its nodes for that measurement
without re-applying its style, which used to fit each node back to the text the
model still held and undo the growth on the spot.
