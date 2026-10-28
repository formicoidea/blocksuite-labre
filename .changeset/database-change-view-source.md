---
'@labre/affine': minor
---

A view of a hosted database can be pointed at another of its sources. "Source" in the view settings (after "Layout") and `database.view.source` on the full page open the data-source picker on that database's sources; a pick switches the view as one undo step, keeping every column, filter, sort, grouping and colour rule whose property the other source has (same name and type), and "New source" appears when the host gives `createSource`. It is reported as `DatabaseViewSourceChanged { source: 'existing' | 'new' }`. `popViewOptions` takes an optional last `std` parameter; with it, entries a `ViewSettingsMenuExtension` registers join the Layout group. A 0.61 caller compiles and draws the same menu.
