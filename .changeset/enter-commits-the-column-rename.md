---
'@labre/affine-components': patch
---

Enter commits a column rename instead of dropping it

Pressing Enter in a menu input closed the menu straight away. Unmounting a
focused input emits no `blur` event, so the value never reached the listener
that saves it, and a column header renamed with Enter came back with its old
name.

The input now blurs itself before the menu closes. Enter, Escape and clicking
outside all end on the same code path, so the typed value is written exactly
once whichever way the edit is finished.
