---
'@labre/std': patch
'@labre/affine-block-code': patch
'@labre/affine-block-embed': patch
'@labre/affine-block-surface': patch
'@labre/affine-database-engine': patch
'@labre/affine-gfx-turbo-renderer': patch
'@labre/affine-shared': patch
---

`BlockStdScope.getView(flavour)` now returns `null`, as its `BlockViewType | null` type always declared, for a flavour with no registered view; it returned `undefined` (#682). A host that compared the result with `undefined` must compare with `null` or use `!= null`; a truthiness test or `!== null` keeps working and is now correct. The other public reads typed `| null` that passed the same optional service lookup through unconverted return `null` too when nothing is registered: `CodeBlockComponent.notificationService`, `EmbedIframeBlockComponent.notificationService`, `DefaultTool.interactivity`, `DataSourceBase.serviceGet`, `ViewportLayoutPainter.getPainter`, `CitationService.docModeService` and `.telemetryService`, `ToolbarContext.telemetryProvider`. `std.getOptional(...)` itself is unchanged.
