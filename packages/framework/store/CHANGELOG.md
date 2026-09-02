# @labre/store

## 0.35.0

### Patch Changes

- @labre/global@0.35.0
- @labre/sync@0.35.0

## 0.34.2

### Patch Changes

- @labre/global@0.34.2
- @labre/sync@0.34.2

## 0.34.1

### Patch Changes

- @labre/global@0.34.1
- @labre/sync@0.34.1

## 0.34.0

### Patch Changes

- @labre/global@0.34.0
- @labre/sync@0.34.0

## 0.33.0

### Patch Changes

- @labre/global@0.33.0
- @labre/sync@0.33.0

## 0.32.0

### Patch Changes

- a2b7c44: A card shows when the doc it points to is in the trash

  A doc the host has moved to its trash stays in the workspace: it still loads
  and still syncs. Linked-doc and synced-doc cards took that at face value and
  kept showing the title, the preview and the content of a doc the reader can no
  longer find anywhere — only a doc removed from the workspace outright read as
  deleted.

  Doc metadata now carries an optional `trash` flag, set by the host alongside
  its own trash, and both cards read it: a trashed target renders the same
  deleted card as a missing one, and a synced card stops embedding its content.
  The flag is optional and stored key by key, so documents written before it
  load unchanged and older readers ignore it.

  Both cards also refresh themselves when the doc list changes, instead of only
  refreshing the "updated at" date, so trashing or restoring a doc updates the
  cards pointing at it without a reload — and a synced card recomputes whether
  its target is empty after each refresh.

- 54488cd: An optional prop on a flat block answers before it is ever filled in
  A flat block's props each get a companion signal (`title# @labre/store
, `cols# @labre/store
  , …) built
  from what the document actually stores. A prop declared with `undefined` as its
  default is, by design, never written to the document, so it had no entry to be
  built from: `model.props.foo# @labre/store
 was simply missing until something assigned
  `model.props.foo`a value. Anything that wanted to observe such a prop — or set
  it through its signal — from the moment the block loaded hit`undefined`instead
  of a signal.
  Optional props now get their signal at load time, holding`undefined`until the
  prop is given a value, and assigning through it writes to the document like any
  other prop. What is stored is unchanged: a prop with an`undefined` default is
  still never written, and defaults that do have a value are still applied at the
  same point, so documents written before this change load and round-trip
  byte-for-byte identically.
- 025d6f5: The first child of a block no longer reports the last one as its previous sibling

  `DocCRUD.getPrev` read the previous sibling as `children.at(index - 1)`. For the
  first child that is `at(-1)`, which JavaScript resolves from the end of the
  array: the first child answered the _last_ child of the same parent instead of
  nothing. The sibling walk therefore closed into a ring rather than stopping, so
  anything built on it could loop or reach past the start of a block's children.

  The first child now answers `null`. `getNext` was already correct — `at(length)`
  is simply out of range — and is left as it is.

- Updated dependencies [5ac0c68]
- Updated dependencies [5edd916]
  - @labre/global@0.32.0
  - @labre/sync@0.32.0

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
