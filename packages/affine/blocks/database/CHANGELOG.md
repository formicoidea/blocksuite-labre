# @labre/affine-block-database

## 0.26.0

### Minor Changes

- 8960a6c: feat(database): pluggable DataSource for affine:database (injection seam)

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

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-inline-preset@0.26.0
  - @labre/affine-inline-reference@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-widget-drag-handle@0.26.0
  - @labre/data-view@0.26.0
  - @labre/affine-widget-slash-menu@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.25.0

### Minor Changes

- 8960a6c: feat(database): pluggable DataSource for affine:database (injection seam)

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

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-inline-preset@0.25.0
  - @labre/affine-inline-reference@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-drag-handle@0.25.0
  - @labre/data-view@0.25.0
  - @labre/affine-widget-slash-menu@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-components@0.24.0
- @labre/data-view@0.24.0
- @labre/affine-ext-loader@0.24.0
- @labre/affine-inline-preset@0.24.0
- @labre/affine-inline-reference@0.24.0
- @labre/affine-model@0.24.0
- @labre/affine-rich-text@0.24.0
- @labre/affine-shared@0.24.0
- @labre/affine-widget-drag-handle@0.24.0
- @labre/affine-widget-slash-menu@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/data-view@0.23.3
  - @labre/affine-inline-preset@0.23.3
  - @labre/affine-inline-reference@0.23.3
  - @labre/affine-rich-text@0.23.3
  - @labre/affine-widget-drag-handle@0.23.3
  - @labre/affine-widget-slash-menu@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/data-view@0.23.2
  - @labre/affine-inline-preset@0.23.2
  - @labre/affine-inline-reference@0.23.2
  - @labre/affine-rich-text@0.23.2
  - @labre/affine-widget-drag-handle@0.23.2
  - @labre/affine-widget-slash-menu@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/data-view@0.23.1
  - @labre/affine-inline-preset@0.23.1
  - @labre/affine-inline-reference@0.23.1
  - @labre/affine-rich-text@0.23.1
  - @labre/affine-widget-drag-handle@0.23.1
  - @labre/affine-widget-slash-menu@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
  - @labre/affine-model@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-inline-preset@0.23.0
  - @labre/affine-inline-reference@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-widget-drag-handle@0.23.0
  - @labre/data-view@0.23.0
  - @labre/affine-widget-slash-menu@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
