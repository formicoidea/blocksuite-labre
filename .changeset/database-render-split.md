---
'@labre/affine-block-database': minor
'@labre/affine-block-data-view': minor
'@labre/data-view': minor
'@labre/affine': minor
---

The `database` and `data-view` flags gate tooling, never a stored database (ADR 0009 amendment of 2026-10-14, ADR 0035 §5). The database view is split the callout's way: the new `DatabaseRenderViewExtension` (block view, flavour, `effects()`, the title band's link cell) is always registered, and `DatabaseViewExtension` keeps only the creation tooling under `database`: the slash entries, "+ view" / "Create …" in the views bar (through the new `DatabaseViewCreationIdentifier`; absent, the block sets the new data-view key `ViewCreationOffKey` on its source), and the host's `configure` of the block's "⋯" menu, so `viewManager.configure(DatabaseViewExtension, …)` still compiles. Same split for the data-view block: `DataViewRenderViewExtension` always on, `DataViewViewExtension` gated and empty. With `{ database: false, 'data-view': false }` a stored database renders with all its views, its cells stay editable and its rows open. A host that registers these extensions by hand (rather than through `getInternalViewExtensions`) must add the render halves.
