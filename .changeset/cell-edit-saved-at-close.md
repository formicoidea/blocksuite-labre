---
'@labre/affine-database-engine': patch
---

A database cell edit is saved when its editor closes, not one frame later.
The number, text, date, progress and link editors hand their value over on
exit one animation frame later (`valueSetNextTick`); an editor removed in
the exit's task (a host closing the document and disposing of its store)
left that frame behind, so the write ran after the store was released,
threw `store … is disposed`, and the edit was lost. The cell now writes the
pending value as it leaves the DOM, once, and the frame never runs; a
deferred write is also dropped if the cell turned readonly meanwhile. While
the editor stays mounted the write still waits for the next frame.
