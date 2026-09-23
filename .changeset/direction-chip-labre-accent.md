---
'@labre/affine-gfx-connector': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-shared': patch
'@labre/std': patch
---

Every typed connector now reveals its verb in the same blue. The chip that
appears along a link on hover and on selection used to be `#2563eb` for a
Wardley dependency ("needs") and `#1e96eb` — AFFiNE's inherited accent — for
every other relation in every framework, so two chips on one map disagreed. The
colour the product owner chose becomes the single default, `LABRE_ACCENT`, which
also lifts the chip's white text from 3.17:1 to 5.17:1 and clears WCAG AA.
