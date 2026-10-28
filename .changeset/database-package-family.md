---
'@labre/affine': major
---

The database packages move into `packages/affine/database/` and are renamed: `@labre/data-view` becomes `@labre/affine-database-engine`, `@labre/affine-block-database` becomes `@labre/affine-database-block` and `@labre/affine-block-data-view` becomes `@labre/affine-database-view-block` (`@labre/affine-database-editor` keeps its name). A host importing `@labre/data-view`, `@labre/affine-block-database` or `@labre/affine-block-data-view` directly updates its specifiers, subpaths included (`@labre/data-view/view-presets` becomes `@labre/affine-database-engine/view-presets`); no alias is kept. The published bundles are unchanged: same names (`labre-core`, `labre-core-database`), same entry points, same behaviour.
