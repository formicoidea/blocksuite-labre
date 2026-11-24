---
'@labre/affine-shared': minor
'@labre/affine-database-engine': minor
'@labre/affine-database-block': minor
---

A host can supply the action of a database's "No view" state (issue #707):
`DataSourcePickerService` gains an optional `noViewAction(block)` that
answers a signal of `{ label, hint?, menu?, run(anchor) } | null`. An action
replaces the library's "New view" under the same "No view" status, which
stays the one live region; `null` keeps the previous state; flipping the
signal redraws it. Never drawn on a read-only document. New exports:
`NoViewAction` and `NoViewActionKey` (`@labre/affine-database-engine`),
`DataSourcePickerNoViewAction` and `DataSourcePickerBlockRef`
(`@labre/affine-shared/services`).
