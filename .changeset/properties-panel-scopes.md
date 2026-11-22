---
'@labre/affine-shared': minor
'@labre/affine-database-block': minor
'@labre/affine-fragment-doc-title': minor
---

A host properties panel can say which requests it answers (issue #708):
`PropertiesPanelService` gains an optional `scopes`, absent meaning every
scope as before. With `scopes: ['page']` the host keeps its panel for the
page sheet beside the title band, while a database view's "Properties"
(inline or full page) opens the data-view's own properties menu, as without a
panel; with `['source']` the title band draws no panel button. New export:
`panelFor(panel, scope)` (`@labre/affine-shared/services`).
