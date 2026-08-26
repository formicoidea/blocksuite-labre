---
'@labre/affine-block-code': patch
---

The second click on "Cancel line number" lands

The code block's More menu was drawn once into a floating portal and never
redrawn, so its entries kept the state they had read at that moment. Clicking
"Cancel line number" turned line numbers off; clicking it again wrote the same
value, so the entry looked dead and its label and switch never caught up. Wrap
had the same fault.

The menu is now a component of its own that redraws when `wrap` or `lineNumber`
changes, and both entries read the current state at the moment they are
clicked. Opening the menu, toggling, and toggling back now works as many times
as you like without closing it.
