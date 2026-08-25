---
'@labre/data-view': patch
---

A mobile cell enters and leaves editing mode once, not on every repaint

On phones, table and kanban cells watched the selection through an effect that
also read the signal holding the rendered cell component. Every repaint of the
cell therefore re-ran the branch and called the cell's enter- or exit-editing
hook again, on a cell whose editing state had not moved. For a number or date
cell, whose exit hook re-parses and writes back the value, that meant a write on
every tick — visible as a caret that jumps back, a value reformatted while you
are still typing, and needless churn in the document.

Each branch now runs only on a real transition, so the hooks fire once when the
cell starts being edited and once when it stops.
