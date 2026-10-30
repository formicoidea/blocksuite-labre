---
'@labre/affine': minor
---

One source list for a view's settings › "Source" and "+ view" (ADR 0035 amendment of 2026-10-30). Both show their search field from the start ("Search or create a source"), the sources of this database, and "Create source “typed”" for a typed name no listed source bears (disabled with the host's verdict when `sourceName.check` refuses it; created as typed without `sourceName`). The view settings' list checks the view's current source and drops "New source"; "+ view" drops "On an existing source" and "With a new source" (each source is a sub-menu of the presets, "Import a view from another database" under a divider). Data-view's `AddViewMenu` gains an optional `searchPlaceholder(context)`. Wordings: `com.labre.database.source-search.placeholder` changes, `com.labre.database.add-view.{existing-source,new-source}` are removed.
