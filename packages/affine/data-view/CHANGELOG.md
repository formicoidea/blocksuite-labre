# @labre/data-view

## 0.28.0

### Minor Changes

- 1cd6c92: Add `ExternalDataSourceBase` and a rebuildable, disposable database source
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

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- Updated dependencies [6795191]
  - @labre/affine-components@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.24.0

### Patch Changes

- @labre/affine-components@0.24.0
- @labre/affine-shared@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
  - @labre/affine-shared@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
