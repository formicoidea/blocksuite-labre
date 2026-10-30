---
'@labre/affine': patch
---

"+ view" lists the same sources as a view's settings › "Source": the host picker's sources of this database, in its order and under its titles, including one no view reads yet (its schema not loaded, it used to be dropped until a view read it), then any source a view reads that the picker does not list. The exact match that hides "Create source" compares against exactly those titles. Without the picker, the views' sources only, as before. The bundle-internal `AddViewSourcePicker.extraSourceIds` becomes `sources`.
