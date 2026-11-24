---
'@labre/affine-inline-latex': patch
'@labre/std': patch
---

Ctrl+A (Cmd+A on macOS) in the equation editor selects the whole formula on
Firefox too, and typing or Backspace then replaces it (#741, port of upstream
toeverything/AFFiNE a2dbbec). The equation editor handles the shortcut itself
and selects through its inline editor instead of leaving it to the browser.

In every inline editor, an input typed over a non-collapsed selection now
replaces that selection even when the browser reports a different target
range: Firefox reported the target range of a select-all from the editor
root, and the input landed in the wrong place. A collapsed caret still uses
the target range (word and character deletion depend on it), and so does a
spellcheck or autocorrect replacement (`insertReplacementText`), which
Firefox fires with the misspelled word as target range before selecting it.
