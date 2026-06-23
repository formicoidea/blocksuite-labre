---
'@labre/affine-block-database': patch
---

feat(database): export databaseBlockViews (view metas) for external DataSources

An external `DataSource` (the seam from #18) must populate `viewMetas` with the
table + kanban `ViewMeta`, exactly as the inline `DatabaseBlockDataSource` does
via `viewMetas = databaseBlockViews`. Those metas were defined in `./views` but
not re-exported from the package index, so host apps couldn't reach them.

Re-export `./views` from the package surface — `databaseBlockViews`,
`databaseBlockViewMap`, `databaseBlockViewConverts` are now importable. No
behavior change to the inline block.
