---
'@labre/affine': patch
---

Fix #571: picking an entry two menu levels down (the creation popover's « Link an existing source » → database → source) closes the whole menu chain, as a pick one level down always did; the popover no longer stays open over the page and the next click is no longer swallowed. A nested sub-menu opens on the side its parent opened on (right first) and flips only when it does not fit, so the third level draws beside the second instead of back over the first.
