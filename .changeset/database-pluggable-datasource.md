---
'@labre/affine-block-database': minor
'@labre/affine-model': minor
---

feat(database): pluggable DataSource for affine:database (injection seam)

The inline database block (`affine:database`) always built its own
`DatabaseBlockDataSource`, so a host app could not back it with an external
source. This adds a minimal, backward-compatible injection seam:

- New optional model prop `externalSourceId?: string` (schema version 3 → 4;
  no runtime migration — optional prop with a default).
- New `DatabaseDataSourceProvider` identifier (exported from
  `@labre/affine-block-database`). When a host registers it **and** the block
  carries an `externalSourceId`, the block renders via the injected source.

With no provider registered and no `externalSourceId`, behavior is identical to
before. Persistence stays entirely host-side.
