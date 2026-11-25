# @labre/store

## 4.4.0

### Minor Changes

- 9416f0c: `store.dispose()` now releases a store for good (#746, ADR 0057). It detaches
  every Yjs observer the store and its blocks attached (their props' proxies,
  `Text` and `Boxed` included), its awareness listener and its `selectionV2`
  entry, and destroys its undo manager; the surface model detaches its
  elements observer too. The document's container forgets the store, so the
  next `doc.getStore()` builds a new, live store from Yjs instead of handing
  the disposed one back. A release writes nothing to Yjs: nothing stored is
  lost or changed. A reopened document starts with an empty undo history.

  **New throw:** a disposed store throws a `BlockSuiteError`
  (`ErrorCode.ModelCRUDError`) from `load()` and from every mutation entry
  point (`addBlock`, `addBlocks`, `addSiblingBlocks`, `updateBlock`,
  `deleteBlock`, `moveBlocks`, `transact`, `withoutTransact`, `undo`, `redo`);
  its reads keep answering its last state, and a second `dispose()` does
  nothing. `load()` used to revive a disposed store half-way, deaf to remote
  changes. Two stores on the same document (the editor's and a query
  preview, a readonly mirror) still share one proxy per nested prop, so they
  can never read different nested values, and each is now notified of nested
  changes (a second store was not); releasing one store leaves the other's
  reactive. `BlockMetaService` subscribes once per store however often
  `load()` runs.

  **New API:** `store.disposed` answers whether a store was released: code
  that resumes after an `await` checks it before writing. The library's own
  gestures do (an image or attachment upload or measure, « Replace », «
  Embed view », « Turn into image », link-preview refreshes, the embed and
  keyboard-toolbar dialogs, paste preparation, « create linked doc », the
  mindmap import, the drag merges, « turn into source »): a document closed
  while one waits is left alone, nothing written and nothing thrown. A
  `load(initFn)` whose `initFn` disposes of the store attaches nothing
  afterwards. `doc.defaultStore` (never builds one) and
  `doc.defaultStoreChanged` tell when a document gets or loses its default
  store; `followDefaultStore(doc, attach)` (`@labre/affine-shared/utils`)
  follows another document's default store without keeping it. The linked-doc
  card, the data-view source and the surface-ref use them: a document closed
  while another document shows it is released, nothing of the library opens
  it again, and the card refreshes when it is opened again. The card reads
  the document's title and trash from its meta, and its content from the
  open store or, when nobody has the document open, from a readonly store of
  its own released with the card (its `linkedDoc` is `undefined` while none
  is open). The data-view source lists the documents open. Readers of
  another document once (`docCRUD.get`: an export walking a synced document,
  an import checking a linked one) get its open store, else its readonly one,
  through the new `storeToRead(doc)` (`@labre/affine-shared/utils`). The
  surface-ref finds the document of its element from Yjs and builds a
  readonly store for that one alone. `DocDisplayMetaService` no longer
  builds the store of every linked document it names.

  **Deprecated:** `DocDisplayMetaService`'s public `iconMap` and `titleMap`
  keep their type and stay empty: the service builds no store, so there is
  nothing to key them by. Read `icon(pageId)` / `title(pageId)`. The `Doc`
  interface gains two required members, `defaultStore` and
  `defaultStoreChanged`: nothing to do for a host that uses the library's
  workspace classes, a compile error only for one that implements `Doc`
  itself.

  `doc.getStore({ readonly: false })` now returns one store per document, as
  `readonly: true` does, instead of building a new one on every call, and
  `doc.removeStore({ readonly: false })` forgets it. It stays a store distinct
  from the default `doc.getStore()`; with an `id` it is still keyed by the id.

  The library's own previews release their query stores: the drag image when
  the drag ends, the linked-doc card when it needs other blocks or
  disconnects, the frame card and the surface-ref note when they disconnect.
  Previews asking for the same store share it through the new
  `holdPreviewStore(doc, options)` (`@labre/affine-shared/utils`): the last
  release disposes of it. The frame card used to remove its store under the
  wrong key and kept every one.

### Patch Changes

- @labre/global@4.4.0
- @labre/sync@4.4.0

## 4.3.0

### Patch Changes

- @labre/global@4.3.0
- @labre/sync@4.3.0

## 4.2.0

### Patch Changes

- @labre/global@4.2.0
- @labre/sync@4.2.0

## 4.1.0

### Patch Changes

- @labre/global@4.1.0
- @labre/sync@4.1.0

## 4.0.0

### Major Changes

- 1ede10d: zod 4 (ADR 0052, GHSA-mrhx-c7xc-m3w5, #667). Every package now depends on `zod ^4.6.6` instead of zod 3, and the zod types in the public API are zod 4's: `CommandDescriptor.params`, the exported `BlockSnapshotSchema`, `SliceSnapshotSchema` and `DocSnapshotSchema`, `InlineSpecs.schema` (now `z.ZodType<Partial<Record<string, unknown>>>`), `AttributeService.setAttributeSchema`, `BlockSchemaType` and the view extensions' option schemas. What a host does: build every schema it hands the library with zod `^4.6.6` (`z.function({ input, output })` instead of `.args().returns()`, `z.record(z.string(), value)` instead of `z.record(value)`), and dedupe to one zod 4 instance. On a page whose Content-Security-Policy has no `'unsafe-eval'` (the canvas viewer on a public page, or the editor), call `config({ jitless: true })` from `zod` in a module the entry imports before any library module: zod 4 probes `new Function` when it builds its first object schema, which the library does while its modules evaluate, and the library never sets that global flag itself; without it everything still works and the policy reports one `eval`. Stored documents are untouched: block and element defaults, snapshot parsing, inline attributes, database values read back, the creation style and the agent manifest's parameter contracts are byte-identical to zod 3 (two guard specs pin them), and nothing new is written. Two zod 4 behaviours are neutralised to keep that true: an object key that may be absent is now declared `.optional()` (the code block's and LaTeX editor's inline managers would otherwise refuse every delta), and stored number, date, progress and created-time cells keep reading `Infinity` through the new `storedNumber()` of `@labre/affine-database-engine` (zod 4's `number()` refuses it).

### Patch Changes

- 4575d50: `minimatch` is no longer a dependency of any published package, so the `brace-expansion` advisories it carried stop reaching hosts through `@formicoidea/labre-core` (#667). The store matches the flavour patterns of a schema's `parent` / `children` lists itself, with the same answers on every pattern the library's schemas use: `*` (any run of characters but `/`) and a trailing negation `!(a|b)` (`affine:embed-!(synced-doc)` in the edgeless text schema). This is a narrowing for a host that registers its own block schemas: `?`, character classes, braces and a `!(…)` followed by more pattern are now read literally (such a pattern matches only the identical flavour), and `**` acts as `*`.
  - @labre/global@4.0.0
  - @labre/sync@4.0.0

## 3.5.0

### Patch Changes

- @labre/global@3.5.0
- @labre/sync@3.5.0

## 3.4.0

### Patch Changes

- @labre/global@3.4.0
- @labre/sync@3.4.0

## 3.3.0

### Patch Changes

- @labre/global@3.3.0
- @labre/sync@3.3.0

## 3.2.0

### Patch Changes

- @labre/global@3.2.0
- @labre/sync@3.2.0

## 3.1.0

### Patch Changes

- @labre/global@3.1.0
- @labre/sync@3.1.0

## 3.0.0

### Patch Changes

- Updated dependencies [0610ec1]
  - @labre/global@3.0.0
  - @labre/sync@3.0.0

## 2.5.0

### Patch Changes

- @labre/global@2.5.0
- @labre/sync@2.5.0

## 2.4.1

### Patch Changes

- @labre/global@2.4.1
- @labre/sync@2.4.1

## 2.4.0

### Patch Changes

- @labre/global@2.4.0
- @labre/sync@2.4.0

## 2.3.3

### Patch Changes

- @labre/global@2.3.3
- @labre/sync@2.3.3

## 2.3.2

### Patch Changes

- @labre/global@2.3.2
- @labre/sync@2.3.2

## 2.3.1

### Patch Changes

- @labre/global@2.3.1
- @labre/sync@2.3.1

## 2.3.0

### Patch Changes

- @labre/global@2.3.0
- @labre/sync@2.3.0

## 2.2.1

### Patch Changes

- @labre/global@2.2.1
- @labre/sync@2.2.1

## 2.2.0

### Patch Changes

- @labre/global@2.2.0
- @labre/sync@2.2.0

## 2.1.3

### Patch Changes

- @labre/global@2.1.3
- @labre/sync@2.1.3

## 2.1.2

### Patch Changes

- @labre/global@2.1.2
- @labre/sync@2.1.2

## 2.1.1

### Patch Changes

- @labre/global@2.1.1
- @labre/sync@2.1.1

## 2.1.0

### Patch Changes

- @labre/global@2.1.0
- @labre/sync@2.1.0

## 2.0.1

### Patch Changes

- @labre/global@2.0.1
- @labre/sync@2.0.1

## 2.0.0

### Patch Changes

- @labre/global@2.0.0
- @labre/sync@2.0.0

## 1.1.0

### Patch Changes

- @labre/global@1.1.0
- @labre/sync@1.1.0

## 1.0.0

### Patch Changes

- @labre/global@1.0.0
- @labre/sync@1.0.0

## 0.61.0

### Patch Changes

- @labre/global@0.61.0
- @labre/sync@0.61.0

## 0.60.0

### Patch Changes

- @labre/global@0.60.0
- @labre/sync@0.60.0

## 0.59.0

### Patch Changes

- @labre/global@0.59.0
- @labre/sync@0.59.0

## 0.58.0

### Patch Changes

- @labre/global@0.57.0
- @labre/sync@0.57.0

## 0.56.0

### Patch Changes

- 4b760e7: Opening a document no longer slows down quadratically with its size when the store uses the default query: a loose query that cannot hide any block now skips the ancestor walk that ran for every loaded block (#507). Measured on the store's own fixture, opening a 3000-block document drops from about 5.2 s to under 0.1 s. A store opened with a query that hides blocks keeps the previous behaviour and cost.
  - @labre/global@0.56.0
  - @labre/sync@0.56.0

## 0.55.0

### Patch Changes

- @labre/global@0.55.0
- @labre/sync@0.55.0

## 0.54.0

### Patch Changes

- @labre/global@0.54.0
- @labre/sync@0.54.0

## 0.53.0

### Patch Changes

- @labre/global@0.53.0
- @labre/sync@0.53.0

## 0.52.0

### Patch Changes

- @labre/global@0.52.0
- @labre/sync@0.52.0

## 0.51.0

### Patch Changes

- @labre/global@0.51.0
- @labre/sync@0.51.0

## 0.50.0

### Patch Changes

- @labre/global@0.50.0
- @labre/sync@0.50.0

## 0.49.0

### Patch Changes

- @labre/global@0.49.0
- @labre/sync@0.49.0

## 0.48.0

### Patch Changes

- @labre/global@0.48.0
- @labre/sync@0.48.0

## 0.47.1

### Patch Changes

- @labre/global@0.47.1
- @labre/sync@0.47.1

## 0.47.0

### Patch Changes

- @labre/global@0.47.0
- @labre/sync@0.47.0

## 0.46.2

### Patch Changes

- @labre/global@0.46.2
- @labre/sync@0.46.2

## 0.46.1

### Patch Changes

- @labre/global@0.46.1
- @labre/sync@0.46.1

## 0.46.0

### Patch Changes

- @labre/global@0.46.0
- @labre/sync@0.46.0

## 0.45.1

### Patch Changes

- @labre/global@0.45.1
- @labre/sync@0.45.1

## 0.45.0

### Patch Changes

- @labre/global@0.45.0
- @labre/sync@0.45.0

## 0.44.0

### Patch Changes

- @labre/global@0.44.0
- @labre/sync@0.44.0

## 0.43.1

### Patch Changes

- @labre/global@0.43.1
- @labre/sync@0.43.1

## 0.43.0

### Patch Changes

- @labre/global@0.43.0
- @labre/sync@0.43.0

## 0.42.0

### Patch Changes

- 4899136: Raise the floor of three runtime dependencies that ship inside the published
  bundles to their smallest patched release: `fflate` (infinite loop on a
  malformed ZIP64 archive), `nanoid` (infinite loop on a negative or zero id
  size) and, transitively, `mdast-util-to-hast` (unsanitized `class` attribute).
  Generated ids are unchanged: same alphabet, same default length.
- Updated dependencies [f3f412a]
  - @labre/global@0.42.0
  - @labre/sync@0.42.0

## 0.41.0

### Patch Changes

- @labre/global@0.41.0
- @labre/sync@0.41.0

## 0.40.0

### Patch Changes

- @labre/global@0.40.0
- @labre/sync@0.40.0

## 0.39.3

### Patch Changes

- @labre/global@0.39.3
- @labre/sync@0.39.3

## 0.39.2

### Patch Changes

- @labre/global@0.39.2
- @labre/sync@0.39.2

## 0.39.1

### Patch Changes

- @labre/global@0.39.1
- @labre/sync@0.39.1

## 0.39.0

### Patch Changes

- @labre/global@0.39.0
- @labre/sync@0.39.0

## 0.38.2

### Patch Changes

- @labre/global@0.38.2
- @labre/sync@0.38.2

## 0.38.1

### Patch Changes

- @labre/global@0.38.1
- @labre/sync@0.38.1

## 0.38.0

### Patch Changes

- @labre/global@0.38.0
- @labre/sync@0.38.0

## 0.37.0

### Patch Changes

- @labre/global@0.37.0
- @labre/sync@0.37.0

## 0.36.0

### Patch Changes

- @labre/global@0.36.0
- @labre/sync@0.36.0

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
