---
'@labre/affine': patch
---

The search of a list of sources explains a refused name: when the host's `sourceName.check` refuses the typed name (a source of another database bears it), the last entry stays, disabled, worded with the verdict (`com.labre.database.source-name.taken`) instead of disappearing behind "No results". The menus' search now folds accents as well as case ("SOURCÉ" finds "Source"), for the filter and for the exact match that hides "Create source".
