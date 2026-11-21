---
'@labre/std': patch
'@labre/affine-block-code': patch
'@labre/affine-block-embed': patch
'@labre/affine-block-surface': patch
'@labre/affine-database-engine': patch
'@labre/affine-gfx-turbo-renderer': patch
'@labre/affine-shared': patch
---

`BlockStdScope.getView(flavour)` now answers `null` for a flavour with no registered view, as its `BlockViewType | null` type always said; it answered `undefined` (#682). The same holds for the other public reads typed `| null` that passed the optional service lookup through: `CodeBlockComponent.notificationService`, `EmbedIframeBlockComponent.notificationService`, `DefaultTool.interactivity`, `DataSourceBase.serviceGet` and `SingleViewBase.serviceGet` (which delegates to it), `ViewportLayoutPainter.getPainter`, `CitationService.docModeService` and `.telemetryService`, `ToolbarContext.telemetryProvider`. Code written against the declared types (a truthiness test, `?.`, `??`, `!= null`, `=== null`, `!== null`) is unaffected or now correct; a comparison with `=== undefined`, which the types never allowed for, no longer matches. `std.getOptional(...)` itself is unchanged.
