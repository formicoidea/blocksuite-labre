---
'@labre/affine-model': minor
'@labre/data-view': minor
'@labre/affine-database-editor': minor
'@labre/affine-shared': minor
---

A database view can colour its rows and cards by a condition on their properties (conditional colours, ADR 0036).

- `ViewBasicDataType` gains `colorRules?: DatabaseViewColorRule[]` (`{ id, color, filter }`, new exported types `DatabaseViewColorRule` and `DatabaseViewColorRuleFilter`). Optional and never written until a gesture adds a rule: no migration, a 0.49 client ignores and keeps it. The first rule that matches a row wins; `filter` is a view filter's own group shape, `color` a colour of the select options' palette.
- Every table row, board card, gallery card and list row paints its rule's colour as a light background, in core, whatever the flags or bundles. Only a palette colour is painted; an unknown one paints nothing.
- The view settings gain "Conditional colors", the rule editor made of the view filter's editor and the options' colour picker; the full page's "This view" lists it as the `'view-menu'` command `database.view.color-rules`.
- A view template keeps the rules. `remapView` rewrites them through the property mapping, removes a rule that reads an ignored property, and counts it in the new `RemapDropped.colorRules`, for an import dialog to say so.
- `evalFilter(filter, row, undecided?)` gains an optional third argument (default `true`, the previous behaviour). `selectOptionColorActions` is the select options' colour picker as menu entries. Seven new keys under `com.labre.data-view.color-rules`.
