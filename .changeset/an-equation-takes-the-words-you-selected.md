---
'@labre/affine-inline-latex': patch
---

An inline equation now takes the words you selected, and follows its document

Asking for an inline equation only worked from an empty caret: with text
selected the command silently did nothing. Selecting `\frac{1}{2}` and turning
it into an equation now uses that text as the formula, and the editor pops open
only when there was nothing to seed it with — a selection spanning several
blocks is refused instead of being applied to the first one.

An equation also stopped ignoring its own document. The rendered formula was
read once when the node appeared and never again, so an undo, a paste replacing
the equation, or an edit arriving from another window left the screen showing a
formula the document no longer held. The node now repaints whenever its stored
value changes, while a formula being typed in the open editor is left alone.
