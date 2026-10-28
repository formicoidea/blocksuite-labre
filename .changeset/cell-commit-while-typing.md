---
'@labre/affine': patch
---

A text or number cell of a table now saves what is typed as it is typed (after a short pause, 400 ms), when its input loses the focus and when the cell goes away while editing, not only when the selection leaves the cell (Enter, Tab, Escape, another cell). A click outside the editor used to lose the edit. A cell left with nothing new typed writes nothing, so a host is not sent an unchanged value and a value another peer wrote meanwhile is kept. Escape still leaves the cell and keeps what was typed. The plain-text cell serves a hosted source's text and title columns and the title band; the number cell every number column.
