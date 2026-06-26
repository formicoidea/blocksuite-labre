---
'@labre/affine-block-database': minor
'@labre/affine-data-view': minor
---

Add `ExternalDataSourceBase` and a rebuildable, disposable database source
(closes #22).

Hosts that back an `affine:database` with their own collection (via
`DatabaseDataSourceProvider`) previously had to reimplement the whole
`DataSourceBase` (~33 abstract members). They can now extend
**`ExternalDataSourceBase`**, which keeps the view config in the model blob and
implements all the generic machinery — view manager / metas / converts, view-data
CRUD, feature flags, readonly, and the reactive plumbing. A concrete source only
provides a small synchronous data contract (`getRows`, `getCellValue`,
`getProperty*`, `getPropertyMetas`) plus the mutations, and calls the protected
`invalidate()` from its own change observers to refresh the view. The inline blob
source (`DatabaseBlockDataSource`) now extends this base, so it keeps exercising
every shared code path.

`DataSourceBase` gains an overridable `dispose()`. The database block now holds a
_reference_ to its source: it rebuilds (and disposes the old one) whenever
`externalSourceId` changes — covering promote-swap, detach, import and re-point —
and disposes on disconnect, ending the observer leak. The block never couples the
source's lifecycle to its own (a source may be embedded in several blocks).
