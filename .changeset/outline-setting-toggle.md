---
'@labre/affine-fragment-outline': patch
---

The "Show type icon" switch of the outline panel's settings menu now stores the value the switch shows. It used to store the negation of the value read at the last render, so two flips before a re-render left the switch on and the setting off.
