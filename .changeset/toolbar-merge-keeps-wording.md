---
'@labre/affine-widget-toolbar': patch
---

Selecting a canvas element no longer breaks the toolbar when two modules contribute the same entry (the "Discuss" action): merging them kept their translated label intact instead of turning it into an object the host's translator rejected.
