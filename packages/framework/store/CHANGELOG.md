# @labre/store

## 0.31.0

### Minor Changes

- 6a663b6: Export a public production `Workspace`: `WorkspaceImpl`

  `@labre/store` now exports `WorkspaceImpl` (and `DocImpl` / `WorkspaceMetaImpl`)
  from its main entry — a production-blessed, self-contained `Workspace` that
  owns its root `Y.Doc` and defaults to inert in-memory sync engines (the host
  wires persistence/sync on the exposed `Y.Doc`s, or passes real
  `docSources`/`blobSources`). Previously the only `Workspace` implementation was
  `TestWorkspace`, marked `@internal / do not use in production` and reachable
  only from the `store/test` subpath, so the consuming app had to build its
  production workspace on a test class.

  `WorkspaceImpl` and `TestWorkspace` are independent siblings of a shared
  internal `WorkspaceBase` (neither extends the other), so test-only evolutions
  never reach production. `TestWorkspace` stays exactly where it is under
  `store/test`; all existing test/playground imports are unchanged.

### Patch Changes

- @labre/global@0.31.0
- @labre/sync@0.31.0

## 0.30.2

### Patch Changes

- @labre/global@0.30.2
- @labre/sync@0.30.2

## 0.30.1

### Patch Changes

- @labre/global@0.30.1
- @labre/sync@0.30.1

## 0.30.0

### Patch Changes

- @labre/global@0.30.0
- @labre/sync@0.30.0

## 0.29.1

### Patch Changes

- @labre/global@0.29.1
- @labre/sync@0.29.1

## 0.29.0

### Patch Changes

- @labre/global@0.29.0
- @labre/sync@0.29.0

## 0.28.0

### Patch Changes

- @labre/global@0.28.0
- @labre/sync@0.28.0

## 0.27.0

### Patch Changes

- @labre/global@0.27.0
- @labre/sync@0.27.0

## 0.26.0

### Patch Changes

- @labre/global@0.26.0
- @labre/sync@0.26.0

## 0.24.0

### Patch Changes

- @labre/global@0.24.0
- @labre/sync@0.24.0

## 0.23.3

### Patch Changes

- @labre/global@0.23.3
- @labre/sync@0.23.3

## 0.23.2

### Patch Changes

- @labre/global@0.23.2
- @labre/sync@0.23.2

## 0.23.1

### Patch Changes

- @labre/global@0.23.1
- @labre/sync@0.23.1

## 0.23.0

### Patch Changes

- @labre/global@0.23.0
- @labre/sync@0.23.0
