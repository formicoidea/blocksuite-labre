# @labre/affine-widget-keyboard-toolbar

## 4.4.0

### Patch Changes

- 098a74a: The "Default Color" entries of the mobile keyboard toolbar's Highlight panel
  now remove the highlight (#737, port of upstream toeverything/AFFiNE 2198970).
  They had no action, so tapping them did nothing and a text colour or
  background could not be cleared on mobile. The Color entry clears the text
  colour, the Background entry clears the background, with the same payload as
  the desktop highlight menu; the coloured entries are unchanged.
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

- Updated dependencies [1bd38b0]
- Updated dependencies [9416f0c]
- Updated dependencies [fa1fb74]
- Updated dependencies [fa1fb74]
- Updated dependencies [fa1fb74]
- Updated dependencies [67c493b]
- Updated dependencies [098a74a]
- Updated dependencies [098a74a]
- Updated dependencies [53d49a9]
- Updated dependencies [67c493b]
- Updated dependencies [f7584b1]
- Updated dependencies [9416f0c]
- Updated dependencies [1bd38b0]
  - @labre/affine-block-attachment@4.4.0
  - @labre/affine-database-engine@4.4.0
  - @labre/affine-database-block@4.4.0
  - @labre/affine-components@4.4.0
  - @labre/affine-inline-latex@4.4.0
  - @labre/std@4.4.0
  - @labre/affine-shared@4.4.0
  - @labre/affine-block-image@4.4.0
  - @labre/store@4.4.0
  - @labre/affine-block-surface-ref@4.4.0
  - @labre/affine-block-embed@4.4.0
  - @labre/affine-block-surface@4.4.0
  - @labre/affine-widget-linked-doc@4.4.0
  - @labre/affine-fragment-doc-title@4.4.0
  - @labre/affine-block-latex@4.4.0
  - @labre/affine-block-list@4.4.0
  - @labre/affine-block-note@4.4.0
  - @labre/affine-block-paragraph@4.4.0
  - @labre/affine-inline-link@4.4.0
  - @labre/affine-inline-preset@4.4.0
  - @labre/affine-inline-reference@4.4.0
  - @labre/affine-rich-text@4.4.0
  - @labre/affine-model@4.4.0
  - @labre/affine-ext-loader@4.4.0
  - @labre/global@4.4.0

## 4.3.0

### Patch Changes

- Updated dependencies [bba6fbd]
  - @labre/affine-components@4.3.0
  - @labre/affine-block-attachment@4.3.0
  - @labre/affine-block-embed@4.3.0
  - @labre/affine-block-image@4.3.0
  - @labre/affine-block-latex@4.3.0
  - @labre/affine-block-list@4.3.0
  - @labre/affine-block-note@4.3.0
  - @labre/affine-block-paragraph@4.3.0
  - @labre/affine-block-surface@4.3.0
  - @labre/affine-block-surface-ref@4.3.0
  - @labre/affine-database-block@4.3.0
  - @labre/affine-database-engine@4.3.0
  - @labre/affine-fragment-doc-title@4.3.0
  - @labre/affine-inline-latex@4.3.0
  - @labre/affine-inline-link@4.3.0
  - @labre/affine-inline-preset@4.3.0
  - @labre/affine-inline-reference@4.3.0
  - @labre/affine-rich-text@4.3.0
  - @labre/affine-widget-linked-doc@4.3.0
  - @labre/affine-ext-loader@4.3.0
  - @labre/affine-model@4.3.0
  - @labre/affine-shared@4.3.0
  - @labre/global@4.3.0
  - @labre/std@4.3.0
  - @labre/store@4.3.0

## 4.2.0

### Patch Changes

- Updated dependencies [7648275]
- Updated dependencies [82c5534]
- Updated dependencies [53b75d4]
- Updated dependencies [53b75d4]
- Updated dependencies [99eeeb9]
- Updated dependencies [ab0b3ec]
- Updated dependencies [62dd689]
- Updated dependencies [1cb683c]
- Updated dependencies [433c6a4]
- Updated dependencies [f7cba5d]
- Updated dependencies [1f98095]
- Updated dependencies [5a66cd7]
  - @labre/affine-database-engine@4.2.0
  - @labre/affine-database-block@4.2.0
  - @labre/std@4.2.0
  - @labre/affine-shared@4.2.0
  - @labre/affine-components@4.2.0
  - @labre/affine-fragment-doc-title@4.2.0
  - @labre/affine-block-image@4.2.0
  - @labre/affine-block-attachment@4.2.0
  - @labre/affine-block-embed@4.2.0
  - @labre/affine-block-latex@4.2.0
  - @labre/affine-block-list@4.2.0
  - @labre/affine-block-note@4.2.0
  - @labre/affine-block-paragraph@4.2.0
  - @labre/affine-block-surface@4.2.0
  - @labre/affine-block-surface-ref@4.2.0
  - @labre/affine-inline-latex@4.2.0
  - @labre/affine-inline-link@4.2.0
  - @labre/affine-inline-preset@4.2.0
  - @labre/affine-inline-reference@4.2.0
  - @labre/affine-model@4.2.0
  - @labre/affine-rich-text@4.2.0
  - @labre/affine-widget-linked-doc@4.2.0
  - @labre/affine-ext-loader@4.2.0
  - @labre/global@4.2.0
  - @labre/store@4.2.0

## 4.1.0

### Patch Changes

- Updated dependencies [7a61224]
- Updated dependencies [b721773]
- Updated dependencies [2342f43]
- Updated dependencies [6d7a084]
- Updated dependencies [84c6752]
- Updated dependencies [55d12e4]
- Updated dependencies [f92920b]
- Updated dependencies [1d9baf6]
- Updated dependencies [f54c196]
- Updated dependencies [bd9ba02]
- Updated dependencies [810c0ed]
  - @labre/affine-database-engine@4.1.0
  - @labre/affine-database-block@4.1.0
  - @labre/affine-fragment-doc-title@4.1.0
  - @labre/affine-components@4.1.0
  - @labre/affine-block-note@4.1.0
  - @labre/affine-block-image@4.1.0
  - @labre/affine-shared@4.1.0
  - @labre/std@4.1.0
  - @labre/affine-block-embed@4.1.0
  - @labre/affine-block-surface@4.1.0
  - @labre/affine-block-attachment@4.1.0
  - @labre/affine-block-latex@4.1.0
  - @labre/affine-block-list@4.1.0
  - @labre/affine-block-paragraph@4.1.0
  - @labre/affine-block-surface-ref@4.1.0
  - @labre/affine-inline-latex@4.1.0
  - @labre/affine-inline-link@4.1.0
  - @labre/affine-inline-preset@4.1.0
  - @labre/affine-inline-reference@4.1.0
  - @labre/affine-rich-text@4.1.0
  - @labre/affine-widget-linked-doc@4.1.0
  - @labre/affine-model@4.1.0
  - @labre/affine-ext-loader@4.1.0
  - @labre/global@4.1.0
  - @labre/store@4.1.0

## 4.0.0

### Patch Changes

- Updated dependencies [4575d50]
- Updated dependencies [a5a067f]
- Updated dependencies [1ede10d]
  - @labre/store@4.0.0
  - @labre/affine-block-embed@4.0.0
  - @labre/affine-shared@4.0.0
  - @labre/affine-database-engine@4.0.0
  - @labre/affine-block-attachment@4.0.0
  - @labre/affine-block-image@4.0.0
  - @labre/affine-block-latex@4.0.0
  - @labre/affine-block-list@4.0.0
  - @labre/affine-block-note@4.0.0
  - @labre/affine-block-paragraph@4.0.0
  - @labre/affine-block-surface@4.0.0
  - @labre/affine-block-surface-ref@4.0.0
  - @labre/affine-components@4.0.0
  - @labre/affine-database-block@4.0.0
  - @labre/affine-ext-loader@4.0.0
  - @labre/affine-fragment-doc-title@4.0.0
  - @labre/affine-inline-latex@4.0.0
  - @labre/affine-inline-link@4.0.0
  - @labre/affine-inline-preset@4.0.0
  - @labre/affine-inline-reference@4.0.0
  - @labre/affine-model@4.0.0
  - @labre/affine-rich-text@4.0.0
  - @labre/affine-widget-linked-doc@4.0.0
  - @labre/std@4.0.0
  - @labre/global@4.0.0

## 3.5.0

### Patch Changes

- Updated dependencies [3fd7f03]
- Updated dependencies [d19e52a]
- Updated dependencies [d19e52a]
- Updated dependencies [d19e52a]
- Updated dependencies [d19e52a]
- Updated dependencies [d19e52a]
- Updated dependencies [d19e52a]
- Updated dependencies [d19e52a]
- Updated dependencies [d19e52a]
- Updated dependencies [d19e52a]
- Updated dependencies [d19e52a]
- Updated dependencies [d19e52a]
- Updated dependencies [d19e52a]
- Updated dependencies [d19e52a]
- Updated dependencies [d19e52a]
- Updated dependencies [d19e52a]
  - @labre/std@3.5.0
  - @labre/affine-shared@3.5.0
  - @labre/affine-components@3.5.0
  - @labre/affine-database-block@3.5.0
  - @labre/affine-database-engine@3.5.0
  - @labre/affine-block-list@3.5.0
  - @labre/affine-block-attachment@3.5.0
  - @labre/affine-block-embed@3.5.0
  - @labre/affine-block-image@3.5.0
  - @labre/affine-block-latex@3.5.0
  - @labre/affine-block-note@3.5.0
  - @labre/affine-block-paragraph@3.5.0
  - @labre/affine-block-surface@3.5.0
  - @labre/affine-block-surface-ref@3.5.0
  - @labre/affine-fragment-doc-title@3.5.0
  - @labre/affine-inline-latex@3.5.0
  - @labre/affine-inline-link@3.5.0
  - @labre/affine-inline-preset@3.5.0
  - @labre/affine-inline-reference@3.5.0
  - @labre/affine-model@3.5.0
  - @labre/affine-rich-text@3.5.0
  - @labre/affine-widget-linked-doc@3.5.0
  - @labre/affine-ext-loader@3.5.0
  - @labre/global@3.5.0
  - @labre/store@3.5.0

## 3.4.0

### Patch Changes

- Updated dependencies [f0ccba0]
  - @labre/affine-components@3.4.0
  - @labre/affine-block-attachment@3.4.0
  - @labre/affine-block-embed@3.4.0
  - @labre/affine-block-image@3.4.0
  - @labre/affine-block-latex@3.4.0
  - @labre/affine-block-list@3.4.0
  - @labre/affine-block-note@3.4.0
  - @labre/affine-block-paragraph@3.4.0
  - @labre/affine-block-surface@3.4.0
  - @labre/affine-block-surface-ref@3.4.0
  - @labre/affine-database-block@3.4.0
  - @labre/affine-database-engine@3.4.0
  - @labre/affine-fragment-doc-title@3.4.0
  - @labre/affine-inline-latex@3.4.0
  - @labre/affine-inline-link@3.4.0
  - @labre/affine-inline-preset@3.4.0
  - @labre/affine-inline-reference@3.4.0
  - @labre/affine-rich-text@3.4.0
  - @labre/affine-widget-linked-doc@3.4.0
  - @labre/affine-ext-loader@3.4.0
  - @labre/affine-model@3.4.0
  - @labre/affine-shared@3.4.0
  - @labre/global@3.4.0
  - @labre/std@3.4.0
  - @labre/store@3.4.0

## 3.3.0

### Patch Changes

- Updated dependencies [09a0c0b]
  - @labre/std@3.3.0
  - @labre/affine-shared@3.3.0
  - @labre/affine-block-attachment@3.3.0
  - @labre/affine-block-embed@3.3.0
  - @labre/affine-block-image@3.3.0
  - @labre/affine-block-latex@3.3.0
  - @labre/affine-block-list@3.3.0
  - @labre/affine-block-note@3.3.0
  - @labre/affine-block-paragraph@3.3.0
  - @labre/affine-block-surface@3.3.0
  - @labre/affine-block-surface-ref@3.3.0
  - @labre/affine-components@3.3.0
  - @labre/affine-database-block@3.3.0
  - @labre/affine-database-engine@3.3.0
  - @labre/affine-fragment-doc-title@3.3.0
  - @labre/affine-inline-latex@3.3.0
  - @labre/affine-inline-link@3.3.0
  - @labre/affine-inline-preset@3.3.0
  - @labre/affine-inline-reference@3.3.0
  - @labre/affine-model@3.3.0
  - @labre/affine-rich-text@3.3.0
  - @labre/affine-widget-linked-doc@3.3.0
  - @labre/affine-ext-loader@3.3.0
  - @labre/global@3.3.0
  - @labre/store@3.3.0

## 3.2.0

### Patch Changes

- @labre/affine-block-attachment@3.2.0
- @labre/affine-block-embed@3.2.0
- @labre/affine-block-image@3.2.0
- @labre/affine-block-latex@3.2.0
- @labre/affine-block-list@3.2.0
- @labre/affine-block-note@3.2.0
- @labre/affine-block-paragraph@3.2.0
- @labre/affine-block-surface@3.2.0
- @labre/affine-block-surface-ref@3.2.0
- @labre/affine-components@3.2.0
- @labre/affine-database-block@3.2.0
- @labre/affine-database-engine@3.2.0
- @labre/affine-ext-loader@3.2.0
- @labre/affine-fragment-doc-title@3.2.0
- @labre/affine-inline-latex@3.2.0
- @labre/affine-inline-link@3.2.0
- @labre/affine-inline-preset@3.2.0
- @labre/affine-inline-reference@3.2.0
- @labre/affine-model@3.2.0
- @labre/affine-rich-text@3.2.0
- @labre/affine-shared@3.2.0
- @labre/affine-widget-linked-doc@3.2.0
- @labre/global@3.2.0
- @labre/std@3.2.0
- @labre/store@3.2.0

## 3.1.0

### Patch Changes

- Updated dependencies [6181857]
  - @labre/affine-shared@3.1.0
  - @labre/affine-block-attachment@3.1.0
  - @labre/affine-block-embed@3.1.0
  - @labre/affine-block-image@3.1.0
  - @labre/affine-block-latex@3.1.0
  - @labre/affine-block-list@3.1.0
  - @labre/affine-block-note@3.1.0
  - @labre/affine-block-paragraph@3.1.0
  - @labre/affine-block-surface@3.1.0
  - @labre/affine-block-surface-ref@3.1.0
  - @labre/affine-components@3.1.0
  - @labre/affine-database-block@3.1.0
  - @labre/affine-database-engine@3.1.0
  - @labre/affine-fragment-doc-title@3.1.0
  - @labre/affine-inline-latex@3.1.0
  - @labre/affine-inline-link@3.1.0
  - @labre/affine-inline-preset@3.1.0
  - @labre/affine-inline-reference@3.1.0
  - @labre/affine-rich-text@3.1.0
  - @labre/affine-widget-linked-doc@3.1.0
  - @labre/affine-ext-loader@3.1.0
  - @labre/affine-model@3.1.0
  - @labre/global@3.1.0
  - @labre/std@3.1.0
  - @labre/store@3.1.0

## 3.0.0

### Patch Changes

- Updated dependencies [42a03f0]
- Updated dependencies [0d3dac4]
- Updated dependencies [aa5db0e]
- Updated dependencies [0610ec1]
- Updated dependencies [1a6e1d4]
- Updated dependencies [260fcd6]
- Updated dependencies [ee98d7e]
- Updated dependencies [56c1183]
- Updated dependencies [3dd3c9f]
  - @labre/affine-block-attachment@3.0.0
  - @labre/affine-shared@3.0.0
  - @labre/affine-block-paragraph@3.0.0
  - @labre/global@3.0.0
  - @labre/affine-inline-preset@3.0.0
  - @labre/affine-block-embed@3.0.0
  - @labre/affine-components@3.0.0
  - @labre/affine-block-image@3.0.0
  - @labre/affine-block-latex@3.0.0
  - @labre/affine-block-list@3.0.0
  - @labre/affine-block-note@3.0.0
  - @labre/affine-block-surface@3.0.0
  - @labre/affine-block-surface-ref@3.0.0
  - @labre/affine-database-block@3.0.0
  - @labre/affine-database-engine@3.0.0
  - @labre/affine-fragment-doc-title@3.0.0
  - @labre/affine-inline-latex@3.0.0
  - @labre/affine-inline-link@3.0.0
  - @labre/affine-inline-reference@3.0.0
  - @labre/affine-rich-text@3.0.0
  - @labre/affine-widget-linked-doc@3.0.0
  - @labre/affine-ext-loader@3.0.0
  - @labre/affine-model@3.0.0
  - @labre/std@3.0.0
  - @labre/store@3.0.0

## 2.5.0

### Patch Changes

- @labre/affine-block-attachment@2.5.0
- @labre/affine-block-embed@2.5.0
- @labre/affine-block-image@2.5.0
- @labre/affine-block-latex@2.5.0
- @labre/affine-block-list@2.5.0
- @labre/affine-block-note@2.5.0
- @labre/affine-block-paragraph@2.5.0
- @labre/affine-block-surface@2.5.0
- @labre/affine-block-surface-ref@2.5.0
- @labre/affine-components@2.5.0
- @labre/affine-database-block@2.5.0
- @labre/affine-database-engine@2.5.0
- @labre/affine-ext-loader@2.5.0
- @labre/affine-fragment-doc-title@2.5.0
- @labre/affine-inline-latex@2.5.0
- @labre/affine-inline-link@2.5.0
- @labre/affine-inline-preset@2.5.0
- @labre/affine-inline-reference@2.5.0
- @labre/affine-model@2.5.0
- @labre/affine-rich-text@2.5.0
- @labre/affine-shared@2.5.0
- @labre/affine-widget-linked-doc@2.5.0
- @labre/global@2.5.0
- @labre/std@2.5.0
- @labre/store@2.5.0

## 2.4.1

### Patch Changes

- @labre/affine-block-attachment@2.4.1
- @labre/affine-block-embed@2.4.1
- @labre/affine-block-image@2.4.1
- @labre/affine-block-latex@2.4.1
- @labre/affine-block-list@2.4.1
- @labre/affine-block-note@2.4.1
- @labre/affine-block-paragraph@2.4.1
- @labre/affine-block-surface@2.4.1
- @labre/affine-block-surface-ref@2.4.1
- @labre/affine-components@2.4.1
- @labre/affine-database-block@2.4.1
- @labre/affine-database-engine@2.4.1
- @labre/affine-ext-loader@2.4.1
- @labre/affine-fragment-doc-title@2.4.1
- @labre/affine-inline-latex@2.4.1
- @labre/affine-inline-link@2.4.1
- @labre/affine-inline-preset@2.4.1
- @labre/affine-inline-reference@2.4.1
- @labre/affine-model@2.4.1
- @labre/affine-rich-text@2.4.1
- @labre/affine-shared@2.4.1
- @labre/affine-widget-linked-doc@2.4.1
- @labre/global@2.4.1
- @labre/std@2.4.1
- @labre/store@2.4.1

## 2.4.0

### Patch Changes

- @labre/affine-block-attachment@2.4.0
- @labre/affine-block-embed@2.4.0
- @labre/affine-block-image@2.4.0
- @labre/affine-block-latex@2.4.0
- @labre/affine-block-list@2.4.0
- @labre/affine-block-note@2.4.0
- @labre/affine-block-paragraph@2.4.0
- @labre/affine-block-surface@2.4.0
- @labre/affine-block-surface-ref@2.4.0
- @labre/affine-components@2.4.0
- @labre/affine-database-block@2.4.0
- @labre/affine-database-engine@2.4.0
- @labre/affine-ext-loader@2.4.0
- @labre/affine-fragment-doc-title@2.4.0
- @labre/affine-inline-latex@2.4.0
- @labre/affine-inline-link@2.4.0
- @labre/affine-inline-preset@2.4.0
- @labre/affine-inline-reference@2.4.0
- @labre/affine-model@2.4.0
- @labre/affine-rich-text@2.4.0
- @labre/affine-shared@2.4.0
- @labre/affine-widget-linked-doc@2.4.0
- @labre/global@2.4.0
- @labre/std@2.4.0
- @labre/store@2.4.0

## 2.3.3

### Patch Changes

- @labre/affine-block-attachment@2.3.3
- @labre/affine-block-embed@2.3.3
- @labre/affine-block-image@2.3.3
- @labre/affine-block-latex@2.3.3
- @labre/affine-block-list@2.3.3
- @labre/affine-block-note@2.3.3
- @labre/affine-block-paragraph@2.3.3
- @labre/affine-block-surface@2.3.3
- @labre/affine-block-surface-ref@2.3.3
- @labre/affine-components@2.3.3
- @labre/affine-database-block@2.3.3
- @labre/affine-database-engine@2.3.3
- @labre/affine-ext-loader@2.3.3
- @labre/affine-fragment-doc-title@2.3.3
- @labre/affine-inline-latex@2.3.3
- @labre/affine-inline-link@2.3.3
- @labre/affine-inline-preset@2.3.3
- @labre/affine-inline-reference@2.3.3
- @labre/affine-model@2.3.3
- @labre/affine-rich-text@2.3.3
- @labre/affine-shared@2.3.3
- @labre/affine-widget-linked-doc@2.3.3
- @labre/global@2.3.3
- @labre/std@2.3.3
- @labre/store@2.3.3

## 2.3.2

### Patch Changes

- @labre/affine-block-attachment@2.3.2
- @labre/affine-block-embed@2.3.2
- @labre/affine-block-image@2.3.2
- @labre/affine-block-latex@2.3.2
- @labre/affine-block-list@2.3.2
- @labre/affine-block-note@2.3.2
- @labre/affine-block-paragraph@2.3.2
- @labre/affine-block-surface@2.3.2
- @labre/affine-block-surface-ref@2.3.2
- @labre/affine-components@2.3.2
- @labre/affine-database-block@2.3.2
- @labre/affine-database-engine@2.3.2
- @labre/affine-ext-loader@2.3.2
- @labre/affine-fragment-doc-title@2.3.2
- @labre/affine-inline-latex@2.3.2
- @labre/affine-inline-link@2.3.2
- @labre/affine-inline-preset@2.3.2
- @labre/affine-inline-reference@2.3.2
- @labre/affine-model@2.3.2
- @labre/affine-rich-text@2.3.2
- @labre/affine-shared@2.3.2
- @labre/affine-widget-linked-doc@2.3.2
- @labre/global@2.3.2
- @labre/std@2.3.2
- @labre/store@2.3.2

## 2.3.1

### Patch Changes

- @labre/affine-block-attachment@2.3.1
- @labre/affine-block-embed@2.3.1
- @labre/affine-block-image@2.3.1
- @labre/affine-block-latex@2.3.1
- @labre/affine-block-list@2.3.1
- @labre/affine-block-note@2.3.1
- @labre/affine-block-paragraph@2.3.1
- @labre/affine-block-surface@2.3.1
- @labre/affine-block-surface-ref@2.3.1
- @labre/affine-components@2.3.1
- @labre/affine-database-block@2.3.1
- @labre/affine-database-engine@2.3.1
- @labre/affine-ext-loader@2.3.1
- @labre/affine-fragment-doc-title@2.3.1
- @labre/affine-inline-latex@2.3.1
- @labre/affine-inline-link@2.3.1
- @labre/affine-inline-preset@2.3.1
- @labre/affine-inline-reference@2.3.1
- @labre/affine-model@2.3.1
- @labre/affine-rich-text@2.3.1
- @labre/affine-shared@2.3.1
- @labre/affine-widget-linked-doc@2.3.1
- @labre/global@2.3.1
- @labre/std@2.3.1
- @labre/store@2.3.1

## 2.3.0

### Patch Changes

- @labre/affine-block-attachment@2.3.0
- @labre/affine-block-embed@2.3.0
- @labre/affine-block-image@2.3.0
- @labre/affine-block-latex@2.3.0
- @labre/affine-block-list@2.3.0
- @labre/affine-block-note@2.3.0
- @labre/affine-block-paragraph@2.3.0
- @labre/affine-block-surface@2.3.0
- @labre/affine-block-surface-ref@2.3.0
- @labre/affine-components@2.3.0
- @labre/affine-database-block@2.3.0
- @labre/affine-database-engine@2.3.0
- @labre/affine-ext-loader@2.3.0
- @labre/affine-fragment-doc-title@2.3.0
- @labre/affine-inline-latex@2.3.0
- @labre/affine-inline-link@2.3.0
- @labre/affine-inline-preset@2.3.0
- @labre/affine-inline-reference@2.3.0
- @labre/affine-model@2.3.0
- @labre/affine-rich-text@2.3.0
- @labre/affine-shared@2.3.0
- @labre/affine-widget-linked-doc@2.3.0
- @labre/global@2.3.0
- @labre/std@2.3.0
- @labre/store@2.3.0

## 2.2.1

### Patch Changes

- @labre/affine-block-attachment@2.2.1
- @labre/affine-block-embed@2.2.1
- @labre/affine-block-image@2.2.1
- @labre/affine-block-latex@2.2.1
- @labre/affine-block-list@2.2.1
- @labre/affine-block-note@2.2.1
- @labre/affine-block-paragraph@2.2.1
- @labre/affine-block-surface@2.2.1
- @labre/affine-block-surface-ref@2.2.1
- @labre/affine-components@2.2.1
- @labre/affine-database-block@2.2.1
- @labre/affine-database-engine@2.2.1
- @labre/affine-ext-loader@2.2.1
- @labre/affine-fragment-doc-title@2.2.1
- @labre/affine-inline-latex@2.2.1
- @labre/affine-inline-link@2.2.1
- @labre/affine-inline-preset@2.2.1
- @labre/affine-inline-reference@2.2.1
- @labre/affine-model@2.2.1
- @labre/affine-rich-text@2.2.1
- @labre/affine-shared@2.2.1
- @labre/affine-widget-linked-doc@2.2.1
- @labre/global@2.2.1
- @labre/std@2.2.1
- @labre/store@2.2.1

## 2.2.0

### Patch Changes

- @labre/affine-block-attachment@2.2.0
- @labre/affine-block-embed@2.2.0
- @labre/affine-block-image@2.2.0
- @labre/affine-block-latex@2.2.0
- @labre/affine-block-list@2.2.0
- @labre/affine-block-note@2.2.0
- @labre/affine-block-paragraph@2.2.0
- @labre/affine-block-surface@2.2.0
- @labre/affine-block-surface-ref@2.2.0
- @labre/affine-components@2.2.0
- @labre/affine-database-block@2.2.0
- @labre/affine-database-engine@2.2.0
- @labre/affine-ext-loader@2.2.0
- @labre/affine-fragment-doc-title@2.2.0
- @labre/affine-inline-latex@2.2.0
- @labre/affine-inline-link@2.2.0
- @labre/affine-inline-preset@2.2.0
- @labre/affine-inline-reference@2.2.0
- @labre/affine-model@2.2.0
- @labre/affine-rich-text@2.2.0
- @labre/affine-shared@2.2.0
- @labre/affine-widget-linked-doc@2.2.0
- @labre/global@2.2.0
- @labre/std@2.2.0
- @labre/store@2.2.0

## 2.1.3

### Patch Changes

- @labre/affine-block-attachment@2.1.3
- @labre/affine-block-embed@2.1.3
- @labre/affine-block-image@2.1.3
- @labre/affine-block-latex@2.1.3
- @labre/affine-block-list@2.1.3
- @labre/affine-block-note@2.1.3
- @labre/affine-block-paragraph@2.1.3
- @labre/affine-block-surface@2.1.3
- @labre/affine-block-surface-ref@2.1.3
- @labre/affine-components@2.1.3
- @labre/affine-database-block@2.1.3
- @labre/affine-database-engine@2.1.3
- @labre/affine-ext-loader@2.1.3
- @labre/affine-fragment-doc-title@2.1.3
- @labre/affine-inline-latex@2.1.3
- @labre/affine-inline-link@2.1.3
- @labre/affine-inline-preset@2.1.3
- @labre/affine-inline-reference@2.1.3
- @labre/affine-model@2.1.3
- @labre/affine-rich-text@2.1.3
- @labre/affine-shared@2.1.3
- @labre/affine-widget-linked-doc@2.1.3
- @labre/global@2.1.3
- @labre/std@2.1.3
- @labre/store@2.1.3

## 2.1.2

### Patch Changes

- @labre/affine-block-attachment@2.1.2
- @labre/affine-block-embed@2.1.2
- @labre/affine-block-image@2.1.2
- @labre/affine-block-latex@2.1.2
- @labre/affine-block-list@2.1.2
- @labre/affine-block-note@2.1.2
- @labre/affine-block-paragraph@2.1.2
- @labre/affine-block-surface@2.1.2
- @labre/affine-block-surface-ref@2.1.2
- @labre/affine-components@2.1.2
- @labre/affine-database-block@2.1.2
- @labre/affine-database-engine@2.1.2
- @labre/affine-ext-loader@2.1.2
- @labre/affine-fragment-doc-title@2.1.2
- @labre/affine-inline-latex@2.1.2
- @labre/affine-inline-link@2.1.2
- @labre/affine-inline-preset@2.1.2
- @labre/affine-inline-reference@2.1.2
- @labre/affine-model@2.1.2
- @labre/affine-rich-text@2.1.2
- @labre/affine-shared@2.1.2
- @labre/affine-widget-linked-doc@2.1.2
- @labre/global@2.1.2
- @labre/std@2.1.2
- @labre/store@2.1.2

## 2.1.1

### Patch Changes

- @labre/affine-block-attachment@2.1.1
- @labre/affine-block-embed@2.1.1
- @labre/affine-block-image@2.1.1
- @labre/affine-block-latex@2.1.1
- @labre/affine-block-list@2.1.1
- @labre/affine-block-note@2.1.1
- @labre/affine-block-paragraph@2.1.1
- @labre/affine-block-surface@2.1.1
- @labre/affine-block-surface-ref@2.1.1
- @labre/affine-components@2.1.1
- @labre/affine-database-block@2.1.1
- @labre/affine-database-engine@2.1.1
- @labre/affine-ext-loader@2.1.1
- @labre/affine-fragment-doc-title@2.1.1
- @labre/affine-inline-latex@2.1.1
- @labre/affine-inline-link@2.1.1
- @labre/affine-inline-preset@2.1.1
- @labre/affine-inline-reference@2.1.1
- @labre/affine-model@2.1.1
- @labre/affine-rich-text@2.1.1
- @labre/affine-shared@2.1.1
- @labre/affine-widget-linked-doc@2.1.1
- @labre/global@2.1.1
- @labre/std@2.1.1
- @labre/store@2.1.1

## 2.1.0

### Patch Changes

- @labre/affine-block-attachment@2.1.0
- @labre/affine-block-embed@2.1.0
- @labre/affine-block-image@2.1.0
- @labre/affine-block-latex@2.1.0
- @labre/affine-block-list@2.1.0
- @labre/affine-block-note@2.1.0
- @labre/affine-block-paragraph@2.1.0
- @labre/affine-block-surface@2.1.0
- @labre/affine-block-surface-ref@2.1.0
- @labre/affine-components@2.1.0
- @labre/affine-database-block@2.1.0
- @labre/affine-database-engine@2.1.0
- @labre/affine-ext-loader@2.1.0
- @labre/affine-fragment-doc-title@2.1.0
- @labre/affine-inline-latex@2.1.0
- @labre/affine-inline-link@2.1.0
- @labre/affine-inline-preset@2.1.0
- @labre/affine-inline-reference@2.1.0
- @labre/affine-model@2.1.0
- @labre/affine-rich-text@2.1.0
- @labre/affine-shared@2.1.0
- @labre/affine-widget-linked-doc@2.1.0
- @labre/global@2.1.0
- @labre/std@2.1.0
- @labre/store@2.1.0

## 2.0.1

### Patch Changes

- @labre/affine-block-attachment@2.0.1
- @labre/affine-block-embed@2.0.1
- @labre/affine-block-image@2.0.1
- @labre/affine-block-latex@2.0.1
- @labre/affine-block-list@2.0.1
- @labre/affine-block-note@2.0.1
- @labre/affine-block-paragraph@2.0.1
- @labre/affine-block-surface@2.0.1
- @labre/affine-block-surface-ref@2.0.1
- @labre/affine-components@2.0.1
- @labre/affine-database-block@2.0.1
- @labre/affine-database-engine@2.0.1
- @labre/affine-ext-loader@2.0.1
- @labre/affine-fragment-doc-title@2.0.1
- @labre/affine-inline-latex@2.0.1
- @labre/affine-inline-link@2.0.1
- @labre/affine-inline-preset@2.0.1
- @labre/affine-inline-reference@2.0.1
- @labre/affine-model@2.0.1
- @labre/affine-rich-text@2.0.1
- @labre/affine-shared@2.0.1
- @labre/affine-widget-linked-doc@2.0.1
- @labre/global@2.0.1
- @labre/std@2.0.1
- @labre/store@2.0.1

## 2.0.0

### Patch Changes

- @labre/affine-block-attachment@2.0.0
- @labre/affine-block-embed@2.0.0
- @labre/affine-block-image@2.0.0
- @labre/affine-block-latex@2.0.0
- @labre/affine-block-list@2.0.0
- @labre/affine-block-note@2.0.0
- @labre/affine-block-paragraph@2.0.0
- @labre/affine-block-surface@2.0.0
- @labre/affine-block-surface-ref@2.0.0
- @labre/affine-components@2.0.0
- @labre/affine-database-block@2.0.0
- @labre/affine-database-engine@2.0.0
- @labre/affine-ext-loader@2.0.0
- @labre/affine-fragment-doc-title@2.0.0
- @labre/affine-inline-latex@2.0.0
- @labre/affine-inline-link@2.0.0
- @labre/affine-inline-preset@2.0.0
- @labre/affine-inline-reference@2.0.0
- @labre/affine-model@2.0.0
- @labre/affine-rich-text@2.0.0
- @labre/affine-shared@2.0.0
- @labre/affine-widget-linked-doc@2.0.0
- @labre/global@2.0.0
- @labre/std@2.0.0
- @labre/store@2.0.0

## 1.1.0

### Patch Changes

- @labre/affine-block-attachment@1.1.0
- @labre/affine-block-embed@1.1.0
- @labre/affine-block-image@1.1.0
- @labre/affine-block-latex@1.1.0
- @labre/affine-block-list@1.1.0
- @labre/affine-block-note@1.1.0
- @labre/affine-block-paragraph@1.1.0
- @labre/affine-block-surface@1.1.0
- @labre/affine-block-surface-ref@1.1.0
- @labre/affine-components@1.1.0
- @labre/affine-database-block@1.1.0
- @labre/affine-database-engine@1.1.0
- @labre/affine-ext-loader@1.1.0
- @labre/affine-fragment-doc-title@1.1.0
- @labre/affine-inline-latex@1.1.0
- @labre/affine-inline-link@1.1.0
- @labre/affine-inline-preset@1.1.0
- @labre/affine-inline-reference@1.1.0
- @labre/affine-model@1.1.0
- @labre/affine-rich-text@1.1.0
- @labre/affine-shared@1.1.0
- @labre/affine-widget-linked-doc@1.1.0
- @labre/global@1.1.0
- @labre/std@1.1.0
- @labre/store@1.1.0

## 1.0.0

### Patch Changes

- @labre/affine-block-attachment@1.0.0
- @labre/affine-block-embed@1.0.0
- @labre/affine-block-image@1.0.0
- @labre/affine-block-latex@1.0.0
- @labre/affine-block-list@1.0.0
- @labre/affine-block-note@1.0.0
- @labre/affine-block-paragraph@1.0.0
- @labre/affine-block-surface@1.0.0
- @labre/affine-block-surface-ref@1.0.0
- @labre/affine-components@1.0.0
- @labre/affine-database-block@1.0.0
- @labre/affine-database-engine@1.0.0
- @labre/affine-ext-loader@1.0.0
- @labre/affine-fragment-doc-title@1.0.0
- @labre/affine-inline-latex@1.0.0
- @labre/affine-inline-link@1.0.0
- @labre/affine-inline-preset@1.0.0
- @labre/affine-inline-reference@1.0.0
- @labre/affine-model@1.0.0
- @labre/affine-rich-text@1.0.0
- @labre/affine-shared@1.0.0
- @labre/affine-widget-linked-doc@1.0.0
- @labre/global@1.0.0
- @labre/std@1.0.0
- @labre/store@1.0.0

## 0.61.0

### Patch Changes

- @labre/affine-block-attachment@0.61.0
- @labre/affine-block-database@0.61.0
- @labre/affine-block-embed@0.61.0
- @labre/affine-block-image@0.61.0
- @labre/affine-block-latex@0.61.0
- @labre/affine-block-list@0.61.0
- @labre/affine-block-note@0.61.0
- @labre/affine-block-paragraph@0.61.0
- @labre/affine-block-surface@0.61.0
- @labre/affine-block-surface-ref@0.61.0
- @labre/affine-components@0.61.0
- @labre/data-view@0.61.0
- @labre/affine-ext-loader@0.61.0
- @labre/affine-fragment-doc-title@0.61.0
- @labre/affine-inline-latex@0.61.0
- @labre/affine-inline-link@0.61.0
- @labre/affine-inline-preset@0.61.0
- @labre/affine-inline-reference@0.61.0
- @labre/affine-model@0.61.0
- @labre/affine-rich-text@0.61.0
- @labre/affine-shared@0.61.0
- @labre/affine-widget-linked-doc@0.61.0
- @labre/global@0.61.0
- @labre/std@0.61.0
- @labre/store@0.61.0

## 0.60.0

### Patch Changes

- @labre/affine-block-attachment@0.60.0
- @labre/affine-block-database@0.60.0
- @labre/affine-block-embed@0.60.0
- @labre/affine-block-image@0.60.0
- @labre/affine-block-latex@0.60.0
- @labre/affine-block-list@0.60.0
- @labre/affine-block-note@0.60.0
- @labre/affine-block-paragraph@0.60.0
- @labre/affine-block-surface@0.60.0
- @labre/affine-block-surface-ref@0.60.0
- @labre/affine-components@0.60.0
- @labre/data-view@0.60.0
- @labre/affine-ext-loader@0.60.0
- @labre/affine-fragment-doc-title@0.60.0
- @labre/affine-inline-latex@0.60.0
- @labre/affine-inline-link@0.60.0
- @labre/affine-inline-preset@0.60.0
- @labre/affine-inline-reference@0.60.0
- @labre/affine-model@0.60.0
- @labre/affine-rich-text@0.60.0
- @labre/affine-shared@0.60.0
- @labre/affine-widget-linked-doc@0.60.0
- @labre/global@0.60.0
- @labre/std@0.60.0
- @labre/store@0.60.0

## 0.59.0

### Patch Changes

- Updated dependencies [8c10a71]
  - @labre/data-view@0.59.0
  - @labre/affine-block-database@0.59.0
  - @labre/affine-fragment-doc-title@0.59.0
  - @labre/affine-block-note@0.59.0
  - @labre/affine-block-latex@0.59.0
  - @labre/affine-block-attachment@0.59.0
  - @labre/affine-block-embed@0.59.0
  - @labre/affine-block-image@0.59.0
  - @labre/affine-block-list@0.59.0
  - @labre/affine-block-paragraph@0.59.0
  - @labre/affine-block-surface@0.59.0
  - @labre/affine-block-surface-ref@0.59.0
  - @labre/affine-components@0.59.0
  - @labre/affine-ext-loader@0.59.0
  - @labre/affine-inline-latex@0.59.0
  - @labre/affine-inline-link@0.59.0
  - @labre/affine-inline-preset@0.59.0
  - @labre/affine-inline-reference@0.59.0
  - @labre/affine-model@0.59.0
  - @labre/affine-rich-text@0.59.0
  - @labre/affine-shared@0.59.0
  - @labre/affine-widget-linked-doc@0.59.0
  - @labre/global@0.59.0
  - @labre/std@0.59.0
  - @labre/store@0.59.0

## 0.58.0

### Patch Changes

- Updated dependencies [6d784cb]
  - @labre/affine-fragment-doc-title@0.57.0
  - @labre/affine-block-note@0.57.0
  - @labre/affine-block-latex@0.57.0
  - @labre/affine-block-database@0.57.0
  - @labre/affine-block-attachment@0.57.0
  - @labre/affine-block-embed@0.57.0
  - @labre/affine-block-image@0.57.0
  - @labre/affine-block-list@0.57.0
  - @labre/affine-block-paragraph@0.57.0
  - @labre/affine-block-surface@0.57.0
  - @labre/affine-block-surface-ref@0.57.0
  - @labre/affine-components@0.57.0
  - @labre/data-view@0.57.0
  - @labre/affine-ext-loader@0.57.0
  - @labre/affine-inline-latex@0.57.0
  - @labre/affine-inline-link@0.57.0
  - @labre/affine-inline-preset@0.57.0
  - @labre/affine-inline-reference@0.57.0
  - @labre/affine-model@0.57.0
  - @labre/affine-rich-text@0.57.0
  - @labre/affine-shared@0.57.0
  - @labre/affine-widget-linked-doc@0.57.0
  - @labre/global@0.57.0
  - @labre/std@0.57.0
  - @labre/store@0.57.0

## 0.56.0

### Patch Changes

- Updated dependencies [4b760e7]
  - @labre/store@0.56.0
  - @labre/affine-block-attachment@0.56.0
  - @labre/affine-block-database@0.56.0
  - @labre/affine-block-embed@0.56.0
  - @labre/affine-block-image@0.56.0
  - @labre/affine-block-latex@0.56.0
  - @labre/affine-block-list@0.56.0
  - @labre/affine-block-note@0.56.0
  - @labre/affine-block-paragraph@0.56.0
  - @labre/affine-block-surface@0.56.0
  - @labre/affine-block-surface-ref@0.56.0
  - @labre/affine-components@0.56.0
  - @labre/data-view@0.56.0
  - @labre/affine-ext-loader@0.56.0
  - @labre/affine-fragment-doc-title@0.56.0
  - @labre/affine-inline-latex@0.56.0
  - @labre/affine-inline-link@0.56.0
  - @labre/affine-inline-preset@0.56.0
  - @labre/affine-inline-reference@0.56.0
  - @labre/affine-model@0.56.0
  - @labre/affine-rich-text@0.56.0
  - @labre/affine-shared@0.56.0
  - @labre/affine-widget-linked-doc@0.56.0
  - @labre/std@0.56.0
  - @labre/global@0.56.0

## 0.55.0

### Patch Changes

- Updated dependencies [c213d34]
  - @labre/data-view@0.55.0
  - @labre/affine-block-database@0.55.0
  - @labre/affine-fragment-doc-title@0.55.0
  - @labre/affine-block-note@0.55.0
  - @labre/affine-block-latex@0.55.0
  - @labre/affine-block-attachment@0.55.0
  - @labre/affine-block-embed@0.55.0
  - @labre/affine-block-image@0.55.0
  - @labre/affine-block-list@0.55.0
  - @labre/affine-block-paragraph@0.55.0
  - @labre/affine-block-surface@0.55.0
  - @labre/affine-block-surface-ref@0.55.0
  - @labre/affine-components@0.55.0
  - @labre/affine-ext-loader@0.55.0
  - @labre/affine-inline-latex@0.55.0
  - @labre/affine-inline-link@0.55.0
  - @labre/affine-inline-preset@0.55.0
  - @labre/affine-inline-reference@0.55.0
  - @labre/affine-model@0.55.0
  - @labre/affine-rich-text@0.55.0
  - @labre/affine-shared@0.55.0
  - @labre/affine-widget-linked-doc@0.55.0
  - @labre/global@0.55.0
  - @labre/std@0.55.0
  - @labre/store@0.55.0

## 0.54.0

### Patch Changes

- 5d40ad2: Dark canvas for the notations (ADR 0039). With `data-theme="dark"` the framework boards are no longer white cards: the paper and the inks drawn on it resolve at paint time through `NOTATION_NEUTRALS_DARK` and each framework's `NotationDarkPaletteExtension`, while the hues of every standard (EDGY's facets, the C4 ladder) stay as drawn. Nothing stored changes, a colour typed by hand is painted as stored, and the SVG export always paints light. New exports: `NOTATION_NEUTRALS_DARK` (`@labre/affine-shared/consts`), `NotationTint`, `notationColor`, `NotationDarkPaletteExtension` and `CanvasRenderer.withColorScheme` / `getInkColorValue` (`@labre/affine-block-surface`). The chrome's last hard-coded light colours (data-view drag bars, colour picker caption, menu input focus ring, scrollbar thumb, `@` menu mask, auto-connect navigator, auto-complete arrows, keyboard toolbar pressed state) now go through theme tokens.
- Updated dependencies [5d40ad2]
- Updated dependencies [5d40ad2]
- Updated dependencies [5d40ad2]
- Updated dependencies [5d40ad2]
- Updated dependencies [5d40ad2]
- Updated dependencies [5d40ad2]
- Updated dependencies [5d40ad2]
  - @labre/affine-widget-linked-doc@0.54.0
  - @labre/affine-block-surface@0.54.0
  - @labre/affine-shared@0.54.0
  - @labre/affine-components@0.54.0
  - @labre/data-view@0.54.0
  - @labre/affine-block-database@0.54.0
  - @labre/affine-inline-reference@0.54.0
  - @labre/affine-inline-link@0.54.0
  - @labre/affine-block-attachment@0.54.0
  - @labre/affine-block-embed@0.54.0
  - @labre/affine-block-image@0.54.0
  - @labre/affine-block-note@0.54.0
  - @labre/affine-block-surface-ref@0.54.0
  - @labre/affine-fragment-doc-title@0.54.0
  - @labre/affine-block-latex@0.54.0
  - @labre/affine-block-list@0.54.0
  - @labre/affine-block-paragraph@0.54.0
  - @labre/affine-inline-latex@0.54.0
  - @labre/affine-inline-preset@0.54.0
  - @labre/affine-rich-text@0.54.0
  - @labre/affine-ext-loader@0.54.0
  - @labre/affine-model@0.54.0
  - @labre/global@0.54.0
  - @labre/std@0.54.0
  - @labre/store@0.54.0

## 0.53.0

### Patch Changes

- Updated dependencies [3d9e204]
  - @labre/affine-shared@0.53.0
  - @labre/affine-block-attachment@0.53.0
  - @labre/affine-block-database@0.53.0
  - @labre/affine-block-embed@0.53.0
  - @labre/affine-block-image@0.53.0
  - @labre/affine-block-latex@0.53.0
  - @labre/affine-block-list@0.53.0
  - @labre/affine-block-note@0.53.0
  - @labre/affine-block-paragraph@0.53.0
  - @labre/affine-block-surface@0.53.0
  - @labre/affine-block-surface-ref@0.53.0
  - @labre/affine-components@0.53.0
  - @labre/data-view@0.53.0
  - @labre/affine-fragment-doc-title@0.53.0
  - @labre/affine-inline-latex@0.53.0
  - @labre/affine-inline-link@0.53.0
  - @labre/affine-inline-preset@0.53.0
  - @labre/affine-inline-reference@0.53.0
  - @labre/affine-rich-text@0.53.0
  - @labre/affine-widget-linked-doc@0.53.0
  - @labre/affine-ext-loader@0.53.0
  - @labre/affine-model@0.53.0
  - @labre/global@0.53.0
  - @labre/std@0.53.0
  - @labre/store@0.53.0

## 0.52.0

### Patch Changes

- Updated dependencies [2124f31]
  - @labre/affine-shared@0.52.0
  - @labre/affine-block-surface@0.52.0
  - @labre/affine-block-attachment@0.52.0
  - @labre/affine-block-database@0.52.0
  - @labre/affine-block-embed@0.52.0
  - @labre/affine-block-image@0.52.0
  - @labre/affine-block-latex@0.52.0
  - @labre/affine-block-list@0.52.0
  - @labre/affine-block-note@0.52.0
  - @labre/affine-block-paragraph@0.52.0
  - @labre/affine-block-surface-ref@0.52.0
  - @labre/affine-components@0.52.0
  - @labre/data-view@0.52.0
  - @labre/affine-fragment-doc-title@0.52.0
  - @labre/affine-inline-latex@0.52.0
  - @labre/affine-inline-link@0.52.0
  - @labre/affine-inline-preset@0.52.0
  - @labre/affine-inline-reference@0.52.0
  - @labre/affine-rich-text@0.52.0
  - @labre/affine-widget-linked-doc@0.52.0
  - @labre/affine-ext-loader@0.52.0
  - @labre/affine-model@0.52.0
  - @labre/global@0.52.0
  - @labre/std@0.52.0
  - @labre/store@0.52.0

## 0.51.0

### Minor Changes

- e043634: Images and files can come from the host's own asset library, through a new
  optional host seam, `AssetPickerProvider`
  (`AssetPickerExtension({ pick })`, `@labre/affine/shared/services`).
  `pick({ kind: 'image' | 'file', mode: 'insert' | 'replace', multiple?, docId })`
  resolves with `AssetRef[]` (`{ sourceId, name, type, size, width?, height? }`,
  blobs the host already stores) or `null` when the viewer cancels. With a host,
  the slash menu's Image, Attachment and PDF, the mobile keyboard toolbar's
  Image and Attachment, and the canvas's image and file buttons open it instead
  of the system file chooser, and the image toolbar gains "Replace" (page and
  canvas), which swaps the picture in place, keeping the displayed width and
  following the new ratio, in one undo step. Blocks reference the picked blob by
  its `sourceId`: the bytes are never sent again. Without a host nothing
  changes; pasting and dropping files never go through the seam.

  New exports: `addSiblingImageBlocksFromAssets`, `addImagesFromAssets`,
  `replaceImage`, `pickAndAddSiblingImageBlocks`, `pickAndAddImages`
  (`@labre/affine/blocks/image`); `addSiblingAttachmentBlocksFromAssets`,
  `addAttachmentsFromAssets`, `pickAndAddSiblingAttachmentBlocks`,
  `pickAndAddAttachments` (`@labre/affine/blocks/attachment`). New key:
  `com.labre.image.toolbar.replace`. No stored format changes.

### Patch Changes

- Updated dependencies [e043634]
- Updated dependencies [e043634]
- Updated dependencies [e043634]
- Updated dependencies [e043634]
- Updated dependencies [e043634]
- Updated dependencies [e043634]
- Updated dependencies [e043634]
- Updated dependencies [e043634]
- Updated dependencies [e043634]
  - @labre/affine-shared@0.51.0
  - @labre/affine-block-image@0.51.0
  - @labre/affine-block-attachment@0.51.0
  - @labre/affine-block-surface@0.51.0
  - @labre/affine-model@0.51.0
  - @labre/affine-inline-link@0.51.0
  - @labre/affine-block-embed@0.51.0
  - @labre/affine-block-database@0.51.0
  - @labre/affine-widget-linked-doc@0.51.0
  - @labre/affine-block-latex@0.51.0
  - @labre/affine-block-list@0.51.0
  - @labre/affine-block-note@0.51.0
  - @labre/affine-block-paragraph@0.51.0
  - @labre/affine-block-surface-ref@0.51.0
  - @labre/affine-components@0.51.0
  - @labre/data-view@0.51.0
  - @labre/affine-fragment-doc-title@0.51.0
  - @labre/affine-inline-latex@0.51.0
  - @labre/affine-inline-preset@0.51.0
  - @labre/affine-inline-reference@0.51.0
  - @labre/affine-rich-text@0.51.0
  - @labre/affine-ext-loader@0.51.0
  - @labre/global@0.51.0
  - @labre/std@0.51.0
  - @labre/store@0.51.0

## 0.50.0

### Patch Changes

- Updated dependencies [f3582d9]
- Updated dependencies [f3582d9]
- Updated dependencies [f3582d9]
- Updated dependencies [f3582d9]
  - @labre/data-view@0.50.0
  - @labre/affine-components@0.50.0
  - @labre/affine-model@0.50.0
  - @labre/affine-shared@0.50.0
  - @labre/affine-block-database@0.50.0
  - @labre/affine-fragment-doc-title@0.50.0
  - @labre/affine-block-attachment@0.50.0
  - @labre/affine-block-embed@0.50.0
  - @labre/affine-block-image@0.50.0
  - @labre/affine-block-latex@0.50.0
  - @labre/affine-block-list@0.50.0
  - @labre/affine-block-note@0.50.0
  - @labre/affine-block-paragraph@0.50.0
  - @labre/affine-block-surface@0.50.0
  - @labre/affine-block-surface-ref@0.50.0
  - @labre/affine-inline-latex@0.50.0
  - @labre/affine-inline-link@0.50.0
  - @labre/affine-inline-preset@0.50.0
  - @labre/affine-inline-reference@0.50.0
  - @labre/affine-rich-text@0.50.0
  - @labre/affine-widget-linked-doc@0.50.0
  - @labre/affine-ext-loader@0.50.0
  - @labre/global@0.50.0
  - @labre/std@0.50.0
  - @labre/store@0.50.0

## 0.49.0

### Patch Changes

- Updated dependencies [651ffab]
- Updated dependencies [651ffab]
- Updated dependencies [651ffab]
- Updated dependencies [651ffab]
- Updated dependencies [651ffab]
- Updated dependencies [651ffab]
- Updated dependencies [651ffab]
- Updated dependencies [651ffab]
- Updated dependencies [651ffab]
- Updated dependencies [651ffab]
- Updated dependencies [651ffab]
- Updated dependencies [651ffab]
- Updated dependencies [651ffab]
- Updated dependencies [651ffab]
  - @labre/data-view@0.49.0
  - @labre/affine-components@0.49.0
  - @labre/affine-block-database@0.49.0
  - @labre/affine-shared@0.49.0
  - @labre/affine-fragment-doc-title@0.49.0
  - @labre/affine-model@0.49.0
  - @labre/affine-block-attachment@0.49.0
  - @labre/affine-block-embed@0.49.0
  - @labre/affine-block-image@0.49.0
  - @labre/affine-block-latex@0.49.0
  - @labre/affine-block-list@0.49.0
  - @labre/affine-block-note@0.49.0
  - @labre/affine-block-paragraph@0.49.0
  - @labre/affine-block-surface@0.49.0
  - @labre/affine-block-surface-ref@0.49.0
  - @labre/affine-inline-latex@0.49.0
  - @labre/affine-inline-link@0.49.0
  - @labre/affine-inline-preset@0.49.0
  - @labre/affine-inline-reference@0.49.0
  - @labre/affine-rich-text@0.49.0
  - @labre/affine-widget-linked-doc@0.49.0
  - @labre/affine-ext-loader@0.49.0
  - @labre/global@0.49.0
  - @labre/std@0.49.0
  - @labre/store@0.49.0

## 0.48.0

### Patch Changes

- Updated dependencies [846e42c]
- Updated dependencies [846e42c]
- Updated dependencies [846e42c]
  - @labre/affine-shared@0.48.0
  - @labre/data-view@0.48.0
  - @labre/affine-fragment-doc-title@0.48.0
  - @labre/affine-block-database@0.48.0
  - @labre/affine-block-attachment@0.48.0
  - @labre/affine-block-embed@0.48.0
  - @labre/affine-block-image@0.48.0
  - @labre/affine-block-latex@0.48.0
  - @labre/affine-block-list@0.48.0
  - @labre/affine-block-note@0.48.0
  - @labre/affine-block-paragraph@0.48.0
  - @labre/affine-block-surface@0.48.0
  - @labre/affine-block-surface-ref@0.48.0
  - @labre/affine-components@0.48.0
  - @labre/affine-inline-latex@0.48.0
  - @labre/affine-inline-link@0.48.0
  - @labre/affine-inline-preset@0.48.0
  - @labre/affine-inline-reference@0.48.0
  - @labre/affine-rich-text@0.48.0
  - @labre/affine-widget-linked-doc@0.48.0
  - @labre/affine-ext-loader@0.48.0
  - @labre/affine-model@0.48.0
  - @labre/global@0.48.0
  - @labre/std@0.48.0
  - @labre/store@0.48.0

## 0.47.1

### Patch Changes

- Updated dependencies [c22a43d]
- Updated dependencies [d796aed]
  - @labre/affine-block-surface@0.47.1
  - @labre/affine-block-attachment@0.47.1
  - @labre/affine-block-embed@0.47.1
  - @labre/affine-block-note@0.47.1
  - @labre/affine-block-surface-ref@0.47.1
  - @labre/affine-components@0.47.1
  - @labre/affine-fragment-doc-title@0.47.1
  - @labre/affine-shared@0.47.1
  - @labre/affine-widget-linked-doc@0.47.1
  - @labre/affine-block-image@0.47.1
  - @labre/affine-block-latex@0.47.1
  - @labre/affine-block-database@0.47.1
  - @labre/affine-block-list@0.47.1
  - @labre/affine-block-paragraph@0.47.1
  - @labre/data-view@0.47.1
  - @labre/affine-inline-latex@0.47.1
  - @labre/affine-inline-link@0.47.1
  - @labre/affine-inline-preset@0.47.1
  - @labre/affine-inline-reference@0.47.1
  - @labre/affine-rich-text@0.47.1
  - @labre/affine-ext-loader@0.47.1
  - @labre/affine-model@0.47.1
  - @labre/global@0.47.1
  - @labre/std@0.47.1
  - @labre/store@0.47.1

## 0.47.0

### Patch Changes

- Updated dependencies [9318a00]
- Updated dependencies [9318a00]
  - @labre/affine-shared@0.47.0
  - @labre/affine-fragment-doc-title@0.47.0
  - @labre/affine-block-note@0.47.0
  - @labre/data-view@0.47.0
  - @labre/std@0.47.0
  - @labre/affine-block-surface@0.47.0
  - @labre/affine-block-attachment@0.47.0
  - @labre/affine-block-database@0.47.0
  - @labre/affine-block-embed@0.47.0
  - @labre/affine-block-image@0.47.0
  - @labre/affine-block-latex@0.47.0
  - @labre/affine-block-list@0.47.0
  - @labre/affine-block-paragraph@0.47.0
  - @labre/affine-block-surface-ref@0.47.0
  - @labre/affine-components@0.47.0
  - @labre/affine-inline-latex@0.47.0
  - @labre/affine-inline-link@0.47.0
  - @labre/affine-inline-preset@0.47.0
  - @labre/affine-inline-reference@0.47.0
  - @labre/affine-rich-text@0.47.0
  - @labre/affine-widget-linked-doc@0.47.0
  - @labre/affine-model@0.47.0
  - @labre/affine-ext-loader@0.47.0
  - @labre/global@0.47.0
  - @labre/store@0.47.0

## 0.46.2

### Patch Changes

- Updated dependencies [cc86d33]
  - @labre/affine-shared@0.46.2
  - @labre/affine-inline-link@0.46.2
  - @labre/affine-block-embed@0.46.2
  - @labre/affine-block-database@0.46.2
  - @labre/affine-components@0.46.2
  - @labre/affine-block-attachment@0.46.2
  - @labre/affine-block-image@0.46.2
  - @labre/affine-block-latex@0.46.2
  - @labre/affine-block-list@0.46.2
  - @labre/affine-block-note@0.46.2
  - @labre/affine-block-paragraph@0.46.2
  - @labre/affine-block-surface@0.46.2
  - @labre/affine-block-surface-ref@0.46.2
  - @labre/data-view@0.46.2
  - @labre/affine-fragment-doc-title@0.46.2
  - @labre/affine-inline-latex@0.46.2
  - @labre/affine-inline-preset@0.46.2
  - @labre/affine-inline-reference@0.46.2
  - @labre/affine-rich-text@0.46.2
  - @labre/affine-widget-linked-doc@0.46.2
  - @labre/affine-ext-loader@0.46.2
  - @labre/affine-model@0.46.2
  - @labre/global@0.46.2
  - @labre/std@0.46.2
  - @labre/store@0.46.2

## 0.46.1

### Patch Changes

- @labre/affine-block-database@0.46.1
- @labre/affine-block-attachment@0.46.1
- @labre/affine-block-embed@0.46.1
- @labre/affine-block-image@0.46.1
- @labre/affine-block-latex@0.46.1
- @labre/affine-block-list@0.46.1
- @labre/affine-block-note@0.46.1
- @labre/affine-block-paragraph@0.46.1
- @labre/affine-block-surface@0.46.1
- @labre/affine-block-surface-ref@0.46.1
- @labre/affine-components@0.46.1
- @labre/data-view@0.46.1
- @labre/affine-ext-loader@0.46.1
- @labre/affine-fragment-doc-title@0.46.1
- @labre/affine-inline-latex@0.46.1
- @labre/affine-inline-link@0.46.1
- @labre/affine-inline-preset@0.46.1
- @labre/affine-inline-reference@0.46.1
- @labre/affine-model@0.46.1
- @labre/affine-rich-text@0.46.1
- @labre/affine-shared@0.46.1
- @labre/affine-widget-linked-doc@0.46.1
- @labre/global@0.46.1
- @labre/std@0.46.1
- @labre/store@0.46.1

## 0.46.0

### Patch Changes

- Updated dependencies [f076627]
  - @labre/affine-shared@0.46.0
  - @labre/affine-block-surface-ref@0.46.0
  - @labre/affine-block-attachment@0.46.0
  - @labre/affine-block-database@0.46.0
  - @labre/affine-block-embed@0.46.0
  - @labre/affine-block-image@0.46.0
  - @labre/affine-block-latex@0.46.0
  - @labre/affine-block-list@0.46.0
  - @labre/affine-block-note@0.46.0
  - @labre/affine-block-paragraph@0.46.0
  - @labre/affine-block-surface@0.46.0
  - @labre/affine-components@0.46.0
  - @labre/data-view@0.46.0
  - @labre/affine-fragment-doc-title@0.46.0
  - @labre/affine-inline-latex@0.46.0
  - @labre/affine-inline-link@0.46.0
  - @labre/affine-inline-preset@0.46.0
  - @labre/affine-inline-reference@0.46.0
  - @labre/affine-rich-text@0.46.0
  - @labre/affine-widget-linked-doc@0.46.0
  - @labre/affine-ext-loader@0.46.0
  - @labre/affine-model@0.46.0
  - @labre/global@0.46.0
  - @labre/std@0.46.0
  - @labre/store@0.46.0

## 0.45.1

### Patch Changes

- Updated dependencies [ffe75a2]
  - @labre/affine-shared@0.45.1
  - @labre/affine-block-attachment@0.45.1
  - @labre/affine-block-database@0.45.1
  - @labre/affine-block-embed@0.45.1
  - @labre/affine-block-image@0.45.1
  - @labre/affine-block-latex@0.45.1
  - @labre/affine-block-list@0.45.1
  - @labre/affine-block-note@0.45.1
  - @labre/affine-block-paragraph@0.45.1
  - @labre/affine-block-surface@0.45.1
  - @labre/affine-block-surface-ref@0.45.1
  - @labre/affine-components@0.45.1
  - @labre/data-view@0.45.1
  - @labre/affine-fragment-doc-title@0.45.1
  - @labre/affine-inline-latex@0.45.1
  - @labre/affine-inline-link@0.45.1
  - @labre/affine-inline-preset@0.45.1
  - @labre/affine-inline-reference@0.45.1
  - @labre/affine-rich-text@0.45.1
  - @labre/affine-widget-linked-doc@0.45.1
  - @labre/affine-ext-loader@0.45.1
  - @labre/affine-model@0.45.1
  - @labre/global@0.45.1
  - @labre/std@0.45.1
  - @labre/store@0.45.1

## 0.45.0

### Patch Changes

- Updated dependencies [aab35cf]
- Updated dependencies [bfce95b]
- Updated dependencies [77998d4]
- Updated dependencies [1e1a703]
- Updated dependencies [6fd3606]
- Updated dependencies [aa245ce]
  - @labre/affine-shared@0.45.0
  - @labre/data-view@0.45.0
  - @labre/affine-components@0.45.0
  - @labre/std@0.45.0
  - @labre/affine-block-surface@0.45.0
  - @labre/affine-block-note@0.45.0
  - @labre/affine-block-attachment@0.45.0
  - @labre/affine-block-database@0.45.0
  - @labre/affine-block-embed@0.45.0
  - @labre/affine-block-image@0.45.0
  - @labre/affine-block-latex@0.45.0
  - @labre/affine-block-list@0.45.0
  - @labre/affine-block-paragraph@0.45.0
  - @labre/affine-block-surface-ref@0.45.0
  - @labre/affine-fragment-doc-title@0.45.0
  - @labre/affine-inline-latex@0.45.0
  - @labre/affine-inline-link@0.45.0
  - @labre/affine-inline-preset@0.45.0
  - @labre/affine-inline-reference@0.45.0
  - @labre/affine-rich-text@0.45.0
  - @labre/affine-widget-linked-doc@0.45.0
  - @labre/affine-model@0.45.0
  - @labre/affine-ext-loader@0.45.0
  - @labre/global@0.45.0
  - @labre/store@0.45.0

## 0.44.0

### Patch Changes

- Updated dependencies [38c4a78]
- Updated dependencies [1ab40a5]
- Updated dependencies [c982522]
- Updated dependencies [a7c4643]
- Updated dependencies [871e571]
- Updated dependencies [e13b46e]
- Updated dependencies [68242dc]
- Updated dependencies [11a7710]
- Updated dependencies [11a7710]
- Updated dependencies [4d12815]
- Updated dependencies [2f4df91]
- Updated dependencies [2447500]
- Updated dependencies [5918f84]
- Updated dependencies [900dade]
- Updated dependencies [dc738fa]
- Updated dependencies [2908a50]
- Updated dependencies [e677a3b]
- Updated dependencies [4697435]
- Updated dependencies [8ce6769]
- Updated dependencies [c4cfd0e]
- Updated dependencies [2908a50]
- Updated dependencies [dfc4baa]
- Updated dependencies [c6ab710]
- Updated dependencies [dfc4baa]
- Updated dependencies [4d12815]
- Updated dependencies [e13b46e]
- Updated dependencies [83fc2d3]
- Updated dependencies [066b754]
- Updated dependencies [b6dc00a]
- Updated dependencies [33e4341]
  - @labre/affine-block-surface@0.44.0
  - @labre/affine-block-embed@0.44.0
  - @labre/affine-shared@0.44.0
  - @labre/std@0.44.0
  - @labre/affine-block-surface-ref@0.44.0
  - @labre/affine-model@0.44.0
  - @labre/affine-components@0.44.0
  - @labre/affine-block-image@0.44.0
  - @labre/affine-block-attachment@0.44.0
  - @labre/affine-inline-preset@0.44.0
  - @labre/affine-block-latex@0.44.0
  - @labre/affine-rich-text@0.44.0
  - @labre/affine-block-note@0.44.0
  - @labre/affine-fragment-doc-title@0.44.0
  - @labre/affine-block-database@0.44.0
  - @labre/affine-block-list@0.44.0
  - @labre/affine-block-paragraph@0.44.0
  - @labre/data-view@0.44.0
  - @labre/affine-inline-latex@0.44.0
  - @labre/affine-inline-link@0.44.0
  - @labre/affine-inline-reference@0.44.0
  - @labre/affine-ext-loader@0.44.0
  - @labre/global@0.44.0
  - @labre/store@0.44.0

## 0.43.1

### Patch Changes

- Updated dependencies [2602909]
  - @labre/affine-shared@0.43.1
  - @labre/affine-model@0.43.1
  - @labre/affine-block-attachment@0.43.1
  - @labre/affine-block-database@0.43.1
  - @labre/affine-block-embed@0.43.1
  - @labre/affine-block-image@0.43.1
  - @labre/affine-block-latex@0.43.1
  - @labre/affine-block-list@0.43.1
  - @labre/affine-block-note@0.43.1
  - @labre/affine-block-paragraph@0.43.1
  - @labre/affine-block-surface@0.43.1
  - @labre/affine-block-surface-ref@0.43.1
  - @labre/affine-components@0.43.1
  - @labre/data-view@0.43.1
  - @labre/affine-fragment-doc-title@0.43.1
  - @labre/affine-inline-latex@0.43.1
  - @labre/affine-inline-link@0.43.1
  - @labre/affine-inline-preset@0.43.1
  - @labre/affine-inline-reference@0.43.1
  - @labre/affine-rich-text@0.43.1
  - @labre/affine-ext-loader@0.43.1
  - @labre/global@0.43.1
  - @labre/std@0.43.1
  - @labre/store@0.43.1

## 0.43.0

### Patch Changes

- Updated dependencies [da68dbb]
- Updated dependencies [72f7282]
- Updated dependencies [8f54236]
- Updated dependencies [f1a4af7]
- Updated dependencies [8a927dd]
  - @labre/affine-shared@0.43.0
  - @labre/affine-block-surface@0.43.0
  - @labre/affine-components@0.43.0
  - @labre/affine-block-embed@0.43.0
  - @labre/affine-block-attachment@0.43.0
  - @labre/affine-block-database@0.43.0
  - @labre/affine-block-image@0.43.0
  - @labre/affine-block-latex@0.43.0
  - @labre/affine-block-list@0.43.0
  - @labre/affine-block-note@0.43.0
  - @labre/affine-block-paragraph@0.43.0
  - @labre/affine-block-surface-ref@0.43.0
  - @labre/data-view@0.43.0
  - @labre/affine-fragment-doc-title@0.43.0
  - @labre/affine-inline-latex@0.43.0
  - @labre/affine-inline-link@0.43.0
  - @labre/affine-inline-preset@0.43.0
  - @labre/affine-inline-reference@0.43.0
  - @labre/affine-rich-text@0.43.0
  - @labre/affine-ext-loader@0.43.0
  - @labre/affine-model@0.43.0
  - @labre/global@0.43.0
  - @labre/std@0.43.0
  - @labre/store@0.43.0

## 0.42.0

### Patch Changes

- 4899136: Raise the floor of three runtime dependencies that ship inside the published
  bundles to their smallest patched release: `fflate` (infinite loop on a
  malformed ZIP64 archive), `nanoid` (infinite loop on a negative or zero id
  size) and, transitively, `mdast-util-to-hast` (unsanitized `class` attribute).
  Generated ids are unchanged: same alphabet, same default length.
- Updated dependencies [87ef822]
- Updated dependencies [90ddf64]
- Updated dependencies [f294deb]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [0dcd69b]
- Updated dependencies [911d143]
- Updated dependencies [a441d96]
- Updated dependencies [4899136]
- Updated dependencies [2f5c621]
- Updated dependencies [911d143]
- Updated dependencies [9ecfc77]
- Updated dependencies [48213e7]
- Updated dependencies [512ab39]
- Updated dependencies [f5acc9b]
- Updated dependencies [7437481]
- Updated dependencies [2e179bb]
- Updated dependencies [911d143]
- Updated dependencies [4f5faa3]
- Updated dependencies [e5d0e6e]
- Updated dependencies [911d143]
- Updated dependencies [f3f412a]
- Updated dependencies [d756a4a]
- Updated dependencies [6bc897b]
- Updated dependencies [f6ece47]
- Updated dependencies [ef0e3da]
- Updated dependencies [e2f6ca5]
- Updated dependencies [d1851b1]
- Updated dependencies [5a8ec30]
- Updated dependencies [549056e]
- Updated dependencies [2bb7318]
- Updated dependencies [c73b25f]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [55d9f13]
  - @labre/std@0.42.0
  - @labre/affine-block-surface@0.42.0
  - @labre/affine-model@0.42.0
  - @labre/affine-shared@0.42.0
  - @labre/affine-block-surface-ref@0.42.0
  - @labre/store@0.42.0
  - @labre/affine-inline-preset@0.42.0
  - @labre/affine-block-embed@0.42.0
  - @labre/affine-components@0.42.0
  - @labre/global@0.42.0
  - @labre/affine-block-paragraph@0.42.0
  - @labre/affine-block-note@0.42.0
  - @labre/affine-block-list@0.42.0
  - @labre/affine-block-attachment@0.42.0
  - @labre/affine-block-database@0.42.0
  - @labre/affine-block-image@0.42.0
  - @labre/affine-block-latex@0.42.0
  - @labre/data-view@0.42.0
  - @labre/affine-fragment-doc-title@0.42.0
  - @labre/affine-inline-latex@0.42.0
  - @labre/affine-inline-link@0.42.0
  - @labre/affine-inline-reference@0.42.0
  - @labre/affine-rich-text@0.42.0
  - @labre/affine-ext-loader@0.42.0

## 0.41.0

### Patch Changes

- Updated dependencies [a513f05]
- Updated dependencies [6cfe313]
- Updated dependencies [5776733]
- Updated dependencies [75770e1]
- Updated dependencies [4ed9484]
- Updated dependencies [c4661f2]
- Updated dependencies [6271b11]
- Updated dependencies [924f7d6]
- Updated dependencies [5744cfd]
- Updated dependencies [feca957]
- Updated dependencies [1dac32d]
- Updated dependencies [b2781b5]
- Updated dependencies [223b280]
- Updated dependencies [47d4ac6]
  - @labre/affine-block-note@0.41.0
  - @labre/affine-block-surface-ref@0.41.0
  - @labre/affine-shared@0.41.0
  - @labre/affine-block-embed@0.41.0
  - @labre/affine-block-surface@0.41.0
  - @labre/std@0.41.0
  - @labre/affine-block-attachment@0.41.0
  - @labre/affine-block-image@0.41.0
  - @labre/affine-block-paragraph@0.41.0
  - @labre/affine-block-latex@0.41.0
  - @labre/affine-components@0.41.0
  - @labre/affine-rich-text@0.41.0
  - @labre/affine-inline-latex@0.41.0
  - @labre/affine-inline-link@0.41.0
  - @labre/affine-inline-preset@0.41.0
  - @labre/affine-inline-reference@0.41.0
  - @labre/affine-fragment-doc-title@0.41.0
  - @labre/affine-block-database@0.41.0
  - @labre/affine-block-list@0.41.0
  - @labre/data-view@0.41.0
  - @labre/affine-model@0.41.0
  - @labre/affine-ext-loader@0.41.0
  - @labre/global@0.41.0
  - @labre/store@0.41.0

## 0.40.0

### Patch Changes

- Updated dependencies [5b41d83]
- Updated dependencies [95ff0a5]
- Updated dependencies [95ff0a5]
  - @labre/affine-inline-preset@0.40.0
  - @labre/affine-shared@0.40.0
  - @labre/affine-block-paragraph@0.40.0
  - @labre/affine-block-note@0.40.0
  - @labre/affine-block-surface@0.40.0
  - @labre/affine-block-database@0.40.0
  - @labre/affine-block-list@0.40.0
  - @labre/affine-block-attachment@0.40.0
  - @labre/affine-block-embed@0.40.0
  - @labre/affine-block-image@0.40.0
  - @labre/affine-block-latex@0.40.0
  - @labre/affine-block-surface-ref@0.40.0
  - @labre/affine-components@0.40.0
  - @labre/data-view@0.40.0
  - @labre/affine-fragment-doc-title@0.40.0
  - @labre/affine-inline-latex@0.40.0
  - @labre/affine-inline-link@0.40.0
  - @labre/affine-inline-reference@0.40.0
  - @labre/affine-rich-text@0.40.0
  - @labre/affine-ext-loader@0.40.0
  - @labre/affine-model@0.40.0
  - @labre/global@0.40.0
  - @labre/std@0.40.0
  - @labre/store@0.40.0

## 0.39.3

### Patch Changes

- Updated dependencies [4ab8a5b]
- Updated dependencies [0a07883]
- Updated dependencies [070e1ec]
  - @labre/affine-block-surface@0.39.3
  - @labre/affine-block-paragraph@0.39.3
  - @labre/affine-block-list@0.39.3
  - @labre/affine-components@0.39.3
  - @labre/affine-block-attachment@0.39.3
  - @labre/affine-block-embed@0.39.3
  - @labre/affine-block-image@0.39.3
  - @labre/affine-block-note@0.39.3
  - @labre/affine-block-surface-ref@0.39.3
  - @labre/affine-fragment-doc-title@0.39.3
  - @labre/affine-block-database@0.39.3
  - @labre/affine-block-latex@0.39.3
  - @labre/data-view@0.39.3
  - @labre/affine-inline-latex@0.39.3
  - @labre/affine-inline-link@0.39.3
  - @labre/affine-inline-preset@0.39.3
  - @labre/affine-inline-reference@0.39.3
  - @labre/affine-rich-text@0.39.3
  - @labre/affine-ext-loader@0.39.3
  - @labre/affine-model@0.39.3
  - @labre/affine-shared@0.39.3
  - @labre/global@0.39.3
  - @labre/std@0.39.3
  - @labre/store@0.39.3

## 0.39.2

### Patch Changes

- Updated dependencies [07b47b8]
  - @labre/affine-shared@0.39.2
  - @labre/affine-block-surface@0.39.2
  - @labre/affine-block-attachment@0.39.2
  - @labre/affine-block-database@0.39.2
  - @labre/affine-block-embed@0.39.2
  - @labre/affine-block-image@0.39.2
  - @labre/affine-block-latex@0.39.2
  - @labre/affine-block-list@0.39.2
  - @labre/affine-block-note@0.39.2
  - @labre/affine-block-paragraph@0.39.2
  - @labre/affine-block-surface-ref@0.39.2
  - @labre/affine-components@0.39.2
  - @labre/data-view@0.39.2
  - @labre/affine-fragment-doc-title@0.39.2
  - @labre/affine-inline-latex@0.39.2
  - @labre/affine-inline-link@0.39.2
  - @labre/affine-inline-preset@0.39.2
  - @labre/affine-inline-reference@0.39.2
  - @labre/affine-rich-text@0.39.2
  - @labre/affine-ext-loader@0.39.2
  - @labre/affine-model@0.39.2
  - @labre/global@0.39.2
  - @labre/std@0.39.2
  - @labre/store@0.39.2

## 0.39.1

### Patch Changes

- 82c0d48: Opening a page-mode document in a mobile browser no longer throws when the host
  registers no `VirtualKeyboardProvider`. That provider is host-supplied, and the
  keyboard toolbar and the mobile linked-doc menu were both demanding it outright:
  on a plain web host the document open died with
  `Service [VirtualKeyboardProvider] not found in container`. Both now treat it as
  optional — the keyboard toolbar falls back to its built-in behaviour, and the
  linked-doc menu sits at a zero keyboard offset.
- Updated dependencies [186cd6d]
- Updated dependencies [00eab3d]
  - @labre/affine-block-database@0.39.1
  - @labre/affine-model@0.39.1
  - @labre/affine-block-surface-ref@0.39.1
  - @labre/affine-fragment-doc-title@0.39.1
  - @labre/affine-block-attachment@0.39.1
  - @labre/affine-block-embed@0.39.1
  - @labre/affine-block-image@0.39.1
  - @labre/affine-block-latex@0.39.1
  - @labre/affine-block-list@0.39.1
  - @labre/affine-block-note@0.39.1
  - @labre/affine-block-paragraph@0.39.1
  - @labre/affine-block-surface@0.39.1
  - @labre/affine-components@0.39.1
  - @labre/affine-inline-latex@0.39.1
  - @labre/affine-inline-link@0.39.1
  - @labre/affine-inline-preset@0.39.1
  - @labre/affine-inline-reference@0.39.1
  - @labre/affine-rich-text@0.39.1
  - @labre/affine-shared@0.39.1
  - @labre/data-view@0.39.1
  - @labre/affine-ext-loader@0.39.1
  - @labre/global@0.39.1
  - @labre/std@0.39.1
  - @labre/store@0.39.1

## 0.39.0

### Patch Changes

- @labre/affine-block-attachment@0.39.0
- @labre/affine-block-database@0.39.0
- @labre/affine-block-embed@0.39.0
- @labre/affine-block-image@0.39.0
- @labre/affine-block-latex@0.39.0
- @labre/affine-block-list@0.39.0
- @labre/affine-block-note@0.39.0
- @labre/affine-block-paragraph@0.39.0
- @labre/affine-block-surface@0.39.0
- @labre/affine-block-surface-ref@0.39.0
- @labre/affine-components@0.39.0
- @labre/data-view@0.39.0
- @labre/affine-ext-loader@0.39.0
- @labre/affine-fragment-doc-title@0.39.0
- @labre/affine-inline-latex@0.39.0
- @labre/affine-inline-link@0.39.0
- @labre/affine-inline-preset@0.39.0
- @labre/affine-inline-reference@0.39.0
- @labre/affine-model@0.39.0
- @labre/affine-rich-text@0.39.0
- @labre/affine-shared@0.39.0
- @labre/global@0.39.0
- @labre/std@0.39.0
- @labre/store@0.39.0

## 0.38.2

### Patch Changes

- Updated dependencies [0ffa45b]
  - @labre/std@0.38.2
  - @labre/affine-block-attachment@0.38.2
  - @labre/affine-block-database@0.38.2
  - @labre/affine-block-embed@0.38.2
  - @labre/affine-block-image@0.38.2
  - @labre/affine-block-latex@0.38.2
  - @labre/affine-block-list@0.38.2
  - @labre/affine-block-note@0.38.2
  - @labre/affine-block-paragraph@0.38.2
  - @labre/affine-block-surface@0.38.2
  - @labre/affine-block-surface-ref@0.38.2
  - @labre/affine-components@0.38.2
  - @labre/data-view@0.38.2
  - @labre/affine-fragment-doc-title@0.38.2
  - @labre/affine-inline-latex@0.38.2
  - @labre/affine-inline-link@0.38.2
  - @labre/affine-inline-preset@0.38.2
  - @labre/affine-inline-reference@0.38.2
  - @labre/affine-model@0.38.2
  - @labre/affine-rich-text@0.38.2
  - @labre/affine-shared@0.38.2
  - @labre/affine-ext-loader@0.38.2
  - @labre/global@0.38.2
  - @labre/store@0.38.2

## 0.38.1

### Patch Changes

- @labre/affine-block-attachment@0.38.1
- @labre/affine-block-database@0.38.1
- @labre/affine-block-embed@0.38.1
- @labre/affine-block-image@0.38.1
- @labre/affine-block-latex@0.38.1
- @labre/affine-block-list@0.38.1
- @labre/affine-block-note@0.38.1
- @labre/affine-block-paragraph@0.38.1
- @labre/affine-block-surface@0.38.1
- @labre/affine-block-surface-ref@0.38.1
- @labre/affine-components@0.38.1
- @labre/data-view@0.38.1
- @labre/affine-ext-loader@0.38.1
- @labre/affine-fragment-doc-title@0.38.1
- @labre/affine-inline-latex@0.38.1
- @labre/affine-inline-link@0.38.1
- @labre/affine-inline-preset@0.38.1
- @labre/affine-inline-reference@0.38.1
- @labre/affine-model@0.38.1
- @labre/affine-rich-text@0.38.1
- @labre/affine-shared@0.38.1
- @labre/global@0.38.1
- @labre/std@0.38.1
- @labre/store@0.38.1

## 0.38.0

### Patch Changes

- Updated dependencies [28c0609]
- Updated dependencies [206b5a1]
- Updated dependencies [6a7c31a]
- Updated dependencies [90a23e1]
- Updated dependencies [b202320]
- Updated dependencies [4566e8f]
- Updated dependencies [6aa0081]
- Updated dependencies [f28a24f]
- Updated dependencies [13d17cf]
- Updated dependencies [65bfe30]
- Updated dependencies [dd22937]
- Updated dependencies [2b18c93]
  - @labre/affine-block-surface@0.38.0
  - @labre/affine-model@0.38.0
  - @labre/affine-inline-link@0.38.0
  - @labre/affine-shared@0.38.0
  - @labre/affine-block-attachment@0.38.0
  - @labre/affine-block-embed@0.38.0
  - @labre/affine-block-image@0.38.0
  - @labre/affine-block-note@0.38.0
  - @labre/affine-block-surface-ref@0.38.0
  - @labre/affine-fragment-doc-title@0.38.0
  - @labre/affine-block-database@0.38.0
  - @labre/affine-block-latex@0.38.0
  - @labre/affine-block-list@0.38.0
  - @labre/affine-block-paragraph@0.38.0
  - @labre/affine-components@0.38.0
  - @labre/affine-inline-latex@0.38.0
  - @labre/affine-inline-preset@0.38.0
  - @labre/affine-inline-reference@0.38.0
  - @labre/affine-rich-text@0.38.0
  - @labre/data-view@0.38.0
  - @labre/affine-ext-loader@0.38.0
  - @labre/global@0.38.0
  - @labre/std@0.38.0
  - @labre/store@0.38.0

## 0.37.0

### Patch Changes

- Updated dependencies [9c7947d]
  - @labre/affine-block-surface@0.37.0
  - @labre/affine-block-attachment@0.37.0
  - @labre/affine-block-embed@0.37.0
  - @labre/affine-block-image@0.37.0
  - @labre/affine-block-note@0.37.0
  - @labre/affine-block-surface-ref@0.37.0
  - @labre/affine-fragment-doc-title@0.37.0
  - @labre/affine-block-latex@0.37.0
  - @labre/affine-block-database@0.37.0
  - @labre/affine-block-list@0.37.0
  - @labre/affine-block-paragraph@0.37.0
  - @labre/affine-components@0.37.0
  - @labre/data-view@0.37.0
  - @labre/affine-ext-loader@0.37.0
  - @labre/affine-inline-latex@0.37.0
  - @labre/affine-inline-link@0.37.0
  - @labre/affine-inline-preset@0.37.0
  - @labre/affine-inline-reference@0.37.0
  - @labre/affine-model@0.37.0
  - @labre/affine-rich-text@0.37.0
  - @labre/affine-shared@0.37.0
  - @labre/global@0.37.0
  - @labre/std@0.37.0
  - @labre/store@0.37.0

## 0.36.0

### Patch Changes

- Updated dependencies [9fa662a]
- Updated dependencies [60fb357]
- Updated dependencies [3db21ea]
- Updated dependencies [7381b0b]
- Updated dependencies [f7c5b9b]
  - @labre/affine-components@0.36.0
  - @labre/affine-block-surface@0.36.0
  - @labre/affine-shared@0.36.0
  - @labre/std@0.36.0
  - @labre/affine-model@0.36.0
  - @labre/affine-block-attachment@0.36.0
  - @labre/affine-block-database@0.36.0
  - @labre/affine-block-embed@0.36.0
  - @labre/affine-block-image@0.36.0
  - @labre/affine-block-latex@0.36.0
  - @labre/affine-block-list@0.36.0
  - @labre/affine-block-note@0.36.0
  - @labre/affine-block-paragraph@0.36.0
  - @labre/affine-block-surface-ref@0.36.0
  - @labre/data-view@0.36.0
  - @labre/affine-fragment-doc-title@0.36.0
  - @labre/affine-inline-latex@0.36.0
  - @labre/affine-inline-link@0.36.0
  - @labre/affine-inline-preset@0.36.0
  - @labre/affine-inline-reference@0.36.0
  - @labre/affine-rich-text@0.36.0
  - @labre/affine-ext-loader@0.36.0
  - @labre/global@0.36.0
  - @labre/store@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [ea5d249]
- Updated dependencies [e9cd7e1]
- Updated dependencies [de3560d]
- Updated dependencies [7f09608]
- Updated dependencies [cf0d8a1]
  - @labre/affine-components@0.35.0
  - @labre/affine-block-surface@0.35.0
  - @labre/affine-shared@0.35.0
  - @labre/std@0.35.0
  - @labre/affine-model@0.35.0
  - @labre/affine-block-attachment@0.35.0
  - @labre/affine-block-database@0.35.0
  - @labre/affine-block-embed@0.35.0
  - @labre/affine-block-image@0.35.0
  - @labre/affine-block-latex@0.35.0
  - @labre/affine-block-list@0.35.0
  - @labre/affine-block-note@0.35.0
  - @labre/affine-block-paragraph@0.35.0
  - @labre/affine-block-surface-ref@0.35.0
  - @labre/data-view@0.35.0
  - @labre/affine-fragment-doc-title@0.35.0
  - @labre/affine-inline-latex@0.35.0
  - @labre/affine-inline-link@0.35.0
  - @labre/affine-inline-preset@0.35.0
  - @labre/affine-inline-reference@0.35.0
  - @labre/affine-rich-text@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-block-attachment@0.34.2
- @labre/affine-block-database@0.34.2
- @labre/affine-block-embed@0.34.2
- @labre/affine-block-image@0.34.2
- @labre/affine-block-latex@0.34.2
- @labre/affine-block-list@0.34.2
- @labre/affine-block-note@0.34.2
- @labre/affine-block-paragraph@0.34.2
- @labre/affine-block-surface@0.34.2
- @labre/affine-block-surface-ref@0.34.2
- @labre/affine-components@0.34.2
- @labre/data-view@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-fragment-doc-title@0.34.2
- @labre/affine-inline-latex@0.34.2
- @labre/affine-inline-link@0.34.2
- @labre/affine-inline-preset@0.34.2
- @labre/affine-inline-reference@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-rich-text@0.34.2
- @labre/affine-shared@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2
- @labre/store@0.34.2

## 0.34.1

### Patch Changes

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-block-surface@0.34.1
  - @labre/affine-block-attachment@0.34.1
  - @labre/affine-block-database@0.34.1
  - @labre/affine-block-embed@0.34.1
  - @labre/affine-block-image@0.34.1
  - @labre/affine-block-latex@0.34.1
  - @labre/affine-block-list@0.34.1
  - @labre/affine-block-note@0.34.1
  - @labre/affine-block-paragraph@0.34.1
  - @labre/affine-block-surface-ref@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-fragment-doc-title@0.34.1
  - @labre/affine-inline-latex@0.34.1
  - @labre/affine-inline-link@0.34.1
  - @labre/affine-inline-preset@0.34.1
  - @labre/affine-inline-reference@0.34.1
  - @labre/affine-rich-text@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/data-view@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1
  - @labre/store@0.34.1

## 0.34.0

### Patch Changes

- 8b00f7d: fix(blocks): core toasts, board tooltips, catalogue headers and seed texts cross the translation seam

  A host that wires `TranslationExtension` now gets a catalogue that covers the
  editor, instead of one that covers everything except the parts a user actually
  reads first. Six families of hard-coded English are gone (refs #182, #183);
  every one of them is a `com.labre.*` key with the previous literal as its
  English fallback, so an editor with no `TranslationProvider` registered reads
  exactly what it read before.

  - **Toasts** — "Copied to clipboard", "Linked doc created", "Note removed from
    Page Mode", "Frame inserted into Page.", "No link found".
  - **Board toolbars** — the resize toggle every framework board carries, and the
    two legend wordings, declared once in `@labre/affine-shared` rather than
    eight times.
  - **Editor chrome** — the toolbar verbs (Copy, Duplicate, Delete, Lock, Link,
    More, Bring to Front, Send to Back, Create linked doc, Draw connector), the
    view switcher (Switch / Inline / Card / Embed view) and the linked-doc card's
    four "nothing to show" sentences. `ToolbarAction` gained `labelWording` /
    `tooltipWording`: a declared `[key, English]` pair the toolbar resolves when
    it builds the row, which keeps a call site one line and keeps the row's width
    planning honest about what it is about to say.
  - **Catalogue headers** — every framework now contributes its own
    `com.labre.catalogue.category.*` keys. Core's registry names no framework
    category once `build:bundles` has stripped it, so a bundled host was drawing
    translated entries under English headers.
  - **BPMN import remarks** — the three whose wording is a fixed sentence carry a
    key (`InterchangeNote.messageKey`). The ones that name an element, an id or a
    count of lanes do not: the seam has no interpolation.
  - **Seed texts** — the caption a placed BPMN or EDGY artefact is given, and a
    C4 board's name, are resolved AT PLACEMENT. What lands in the document is
    content the author owns from that moment on and is never re-translated.

  `getTranslationKeyManifest()` gains all of it, including a new `'seed'` source
  for the words a framework writes onto the canvas.

  Three surfaces are deliberately left English, and each one is a refusal rather
  than an oversight. The **C4 component tier seeds** (`NODE_LABEL`,
  `C4_TYPE_PLACEHOLDER`, `DESCRIPTION_PLACEHOLDER`) are read back as SENTINELS by
  the morph and by the mermaid exporter, which is a pure function of the board
  and has no `std` to re-resolve them with — translating them would change what
  an export writes. The **code block's "⋮"** is a `MenuItemGroup` rendered over a
  generic context that carries no `std`. The **slash menu** and the **mobile
  keyboard toolbar** item names are their own vocabularies, untouched apart from
  the toasts they raise.

- Updated dependencies [881d3f5]
- Updated dependencies [6c1bdfb]
- Updated dependencies [8b00f7d]
- Updated dependencies [5f76ab3]
- Updated dependencies [f09d68c]
  - @labre/std@0.34.0
  - @labre/affine-shared@0.34.0
  - @labre/affine-block-surface@0.34.0
  - @labre/affine-block-attachment@0.34.0
  - @labre/affine-block-database@0.34.0
  - @labre/affine-block-embed@0.34.0
  - @labre/affine-block-image@0.34.0
  - @labre/affine-block-note@0.34.0
  - @labre/affine-block-surface-ref@0.34.0
  - @labre/affine-components@0.34.0
  - @labre/affine-inline-link@0.34.0
  - @labre/affine-inline-reference@0.34.0
  - @labre/affine-block-latex@0.34.0
  - @labre/affine-block-list@0.34.0
  - @labre/affine-block-paragraph@0.34.0
  - @labre/data-view@0.34.0
  - @labre/affine-fragment-doc-title@0.34.0
  - @labre/affine-inline-latex@0.34.0
  - @labre/affine-inline-preset@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-rich-text@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Patch Changes

- Updated dependencies [3fbf69c]
- Updated dependencies [f929e12]
- Updated dependencies [13360cd]
- Updated dependencies [5c39582]
- Updated dependencies [8890efe]
- Updated dependencies [c03090c]
- Updated dependencies [32e4d45]
- Updated dependencies [139d77b]
- Updated dependencies [6bba40c]
- Updated dependencies [a8325bb]
- Updated dependencies [ff19911]
- Updated dependencies [7aa932c]
- Updated dependencies [b03132c]
- Updated dependencies [48049d6]
- Updated dependencies [7136db0]
- Updated dependencies [932bf35]
- Updated dependencies [5737a56]
- Updated dependencies [168617d]
- Updated dependencies [932bf35]
- Updated dependencies [9022c92]
- Updated dependencies [b97efc6]
- Updated dependencies [edfaba2]
- Updated dependencies [46ce0c9]
- Updated dependencies [334bd61]
- Updated dependencies [2ec39c0]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [4a3b26e]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-block-surface@0.33.0
  - @labre/affine-components@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-block-attachment@0.33.0
  - @labre/affine-block-embed@0.33.0
  - @labre/affine-block-image@0.33.0
  - @labre/affine-block-note@0.33.0
  - @labre/affine-block-surface-ref@0.33.0
  - @labre/affine-fragment-doc-title@0.33.0
  - @labre/affine-block-database@0.33.0
  - @labre/affine-block-latex@0.33.0
  - @labre/affine-block-list@0.33.0
  - @labre/affine-block-paragraph@0.33.0
  - @labre/data-view@0.33.0
  - @labre/affine-inline-latex@0.33.0
  - @labre/affine-inline-link@0.33.0
  - @labre/affine-inline-preset@0.33.0
  - @labre/affine-inline-reference@0.33.0
  - @labre/affine-rich-text@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Patch Changes

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [913da26]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [50ab9ae]
- Updated dependencies [f832f27]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [90a9168]
- Updated dependencies [6417a2f]
- Updated dependencies [9ffab42]
- Updated dependencies [c6eac56]
- Updated dependencies [acbec17]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [9fe5773]
- Updated dependencies [50ab9ae]
- Updated dependencies [6264dfc]
- Updated dependencies [89b90e9]
- Updated dependencies [c2e1020]
- Updated dependencies [ceb2761]
- Updated dependencies [f7f23b2]
- Updated dependencies [865abd4]
- Updated dependencies [3b30d8f]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [5ac0c68]
- Updated dependencies [630633b]
- Updated dependencies [1fa46c1]
- Updated dependencies [d8eb24a]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [86e7562]
- Updated dependencies [492bac6]
- Updated dependencies [72b334c]
- Updated dependencies [9bf1d3e]
- Updated dependencies [fc52023]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [5076cb8]
- Updated dependencies [3c5c97e]
- Updated dependencies [9cf65a2]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [c7612da]
- Updated dependencies [3e1665b]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [1c37478]
- Updated dependencies [b684b4c]
- Updated dependencies [48e90f4]
- Updated dependencies [8f339d1]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [025d6f5]
- Updated dependencies [b1ed4ef]
- Updated dependencies [985a92f]
- Updated dependencies [b889326]
- Updated dependencies [1efc6d5]
- Updated dependencies [4162e4a]
- Updated dependencies [3ac3587]
- Updated dependencies [fad4c08]
- Updated dependencies [7b940cf]
- Updated dependencies [7b66d8d]
- Updated dependencies [184c412]
- Updated dependencies [4bb44ef]
- Updated dependencies [30061cb]
- Updated dependencies [c2735aa]
- Updated dependencies [346b5d9]
- Updated dependencies [77b0100]
- Updated dependencies [8d33c60]
- Updated dependencies [061729e]
- Updated dependencies [7a3458a]
  - @labre/std@0.32.0
  - @labre/affine-shared@0.32.0
  - @labre/store@0.32.0
  - @labre/affine-block-note@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/data-view@0.32.0
  - @labre/affine-block-database@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-block-surface@0.32.0
  - @labre/affine-block-latex@0.32.0
  - @labre/affine-inline-latex@0.32.0
  - @labre/affine-inline-preset@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-inline-link@0.32.0
  - @labre/affine-block-attachment@0.32.0
  - @labre/affine-block-embed@0.32.0
  - @labre/affine-block-image@0.32.0
  - @labre/affine-block-list@0.32.0
  - @labre/affine-block-paragraph@0.32.0
  - @labre/affine-block-surface-ref@0.32.0
  - @labre/affine-fragment-doc-title@0.32.0
  - @labre/affine-inline-reference@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-attachment@0.31.0
  - @labre/affine-block-database@0.31.0
  - @labre/affine-block-embed@0.31.0
  - @labre/affine-block-image@0.31.0
  - @labre/affine-block-latex@0.31.0
  - @labre/affine-block-list@0.31.0
  - @labre/affine-block-note@0.31.0
  - @labre/affine-block-paragraph@0.31.0
  - @labre/affine-block-surface@0.31.0
  - @labre/affine-block-surface-ref@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/data-view@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-fragment-doc-title@0.31.0
  - @labre/affine-inline-latex@0.31.0
  - @labre/affine-inline-link@0.31.0
  - @labre/affine-inline-preset@0.31.0
  - @labre/affine-inline-reference@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-attachment@0.30.2
- @labre/affine-block-database@0.30.2
- @labre/affine-block-embed@0.30.2
- @labre/affine-block-image@0.30.2
- @labre/affine-block-latex@0.30.2
- @labre/affine-block-list@0.30.2
- @labre/affine-block-note@0.30.2
- @labre/affine-block-paragraph@0.30.2
- @labre/affine-block-surface@0.30.2
- @labre/affine-block-surface-ref@0.30.2
- @labre/affine-components@0.30.2
- @labre/data-view@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-fragment-doc-title@0.30.2
- @labre/affine-inline-latex@0.30.2
- @labre/affine-inline-link@0.30.2
- @labre/affine-inline-preset@0.30.2
- @labre/affine-inline-reference@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-rich-text@0.30.2
- @labre/affine-shared@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-block-attachment@0.30.1
- @labre/affine-block-database@0.30.1
- @labre/affine-block-embed@0.30.1
- @labre/affine-block-image@0.30.1
- @labre/affine-block-latex@0.30.1
- @labre/affine-block-list@0.30.1
- @labre/affine-block-note@0.30.1
- @labre/affine-block-paragraph@0.30.1
- @labre/affine-block-surface@0.30.1
- @labre/affine-block-surface-ref@0.30.1
- @labre/affine-components@0.30.1
- @labre/data-view@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-fragment-doc-title@0.30.1
- @labre/affine-inline-latex@0.30.1
- @labre/affine-inline-link@0.30.1
- @labre/affine-inline-preset@0.30.1
- @labre/affine-inline-reference@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-rich-text@0.30.1
- @labre/affine-shared@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-block-attachment@0.30.0
  - @labre/affine-block-database@0.30.0
  - @labre/affine-block-embed@0.30.0
  - @labre/affine-block-image@0.30.0
  - @labre/affine-block-latex@0.30.0
  - @labre/affine-block-list@0.30.0
  - @labre/affine-block-note@0.30.0
  - @labre/affine-block-paragraph@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-block-surface-ref@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/data-view@0.30.0
  - @labre/affine-fragment-doc-title@0.30.0
  - @labre/affine-inline-latex@0.30.0
  - @labre/affine-inline-link@0.30.0
  - @labre/affine-inline-preset@0.30.0
  - @labre/affine-inline-reference@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-attachment@0.29.1
- @labre/affine-block-database@0.29.1
- @labre/affine-block-embed@0.29.1
- @labre/affine-block-image@0.29.1
- @labre/affine-block-latex@0.29.1
- @labre/affine-block-list@0.29.1
- @labre/affine-block-note@0.29.1
- @labre/affine-block-paragraph@0.29.1
- @labre/affine-block-surface@0.29.1
- @labre/affine-block-surface-ref@0.29.1
- @labre/affine-components@0.29.1
- @labre/data-view@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-fragment-doc-title@0.29.1
- @labre/affine-inline-latex@0.29.1
- @labre/affine-inline-link@0.29.1
- @labre/affine-inline-preset@0.29.1
- @labre/affine-inline-reference@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-rich-text@0.29.1
- @labre/affine-shared@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-attachment@0.29.0
  - @labre/affine-block-database@0.29.0
  - @labre/affine-block-embed@0.29.0
  - @labre/affine-block-image@0.29.0
  - @labre/affine-block-latex@0.29.0
  - @labre/affine-block-list@0.29.0
  - @labre/affine-block-note@0.29.0
  - @labre/affine-block-paragraph@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-block-surface-ref@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/data-view@0.29.0
  - @labre/affine-fragment-doc-title@0.29.0
  - @labre/affine-inline-latex@0.29.0
  - @labre/affine-inline-link@0.29.0
  - @labre/affine-inline-preset@0.29.0
  - @labre/affine-inline-reference@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [1cd6c92]
- Updated dependencies [65cc055]
  - @labre/affine-block-database@0.28.0
  - @labre/data-view@0.28.0
  - @labre/std@0.28.0
  - @labre/affine-block-attachment@0.28.0
  - @labre/affine-block-embed@0.28.0
  - @labre/affine-block-image@0.28.0
  - @labre/affine-block-latex@0.28.0
  - @labre/affine-block-list@0.28.0
  - @labre/affine-block-note@0.28.0
  - @labre/affine-block-paragraph@0.28.0
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-block-surface-ref@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-fragment-doc-title@0.28.0
  - @labre/affine-inline-latex@0.28.0
  - @labre/affine-inline-link@0.28.0
  - @labre/affine-inline-preset@0.28.0
  - @labre/affine-inline-reference@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [14ef3e7]
- Updated dependencies [91f6397]
  - @labre/affine-block-database@0.27.0
  - @labre/std@0.27.0
  - @labre/affine-block-attachment@0.27.0
  - @labre/affine-block-embed@0.27.0
  - @labre/affine-block-image@0.27.0
  - @labre/affine-block-latex@0.27.0
  - @labre/affine-block-list@0.27.0
  - @labre/affine-block-note@0.27.0
  - @labre/affine-block-paragraph@0.27.0
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-block-surface-ref@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/data-view@0.27.0
  - @labre/affine-fragment-doc-title@0.27.0
  - @labre/affine-inline-latex@0.27.0
  - @labre/affine-inline-link@0.27.0
  - @labre/affine-inline-preset@0.27.0
  - @labre/affine-inline-reference@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-block-database@0.26.0
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-block-attachment@0.26.0
  - @labre/affine-block-embed@0.26.0
  - @labre/affine-block-image@0.26.0
  - @labre/affine-block-latex@0.26.0
  - @labre/affine-block-list@0.26.0
  - @labre/affine-block-note@0.26.0
  - @labre/affine-block-paragraph@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-block-surface-ref@0.26.0
  - @labre/affine-fragment-doc-title@0.26.0
  - @labre/affine-inline-latex@0.26.0
  - @labre/affine-inline-link@0.26.0
  - @labre/affine-inline-preset@0.26.0
  - @labre/affine-inline-reference@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/data-view@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.25.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-block-database@0.25.0
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-block-attachment@0.25.0
  - @labre/affine-block-embed@0.25.0
  - @labre/affine-block-image@0.25.0
  - @labre/affine-block-latex@0.25.0
  - @labre/affine-block-list@0.25.0
  - @labre/affine-block-note@0.25.0
  - @labre/affine-block-paragraph@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-block-surface-ref@0.25.0
  - @labre/affine-fragment-doc-title@0.25.0
  - @labre/affine-inline-latex@0.25.0
  - @labre/affine-inline-link@0.25.0
  - @labre/affine-inline-preset@0.25.0
  - @labre/affine-inline-reference@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/data-view@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-block-attachment@0.24.0
- @labre/affine-block-database@0.24.0
- @labre/affine-block-embed@0.24.0
- @labre/affine-block-image@0.24.0
- @labre/affine-block-latex@0.24.0
- @labre/affine-block-list@0.24.0
- @labre/affine-block-note@0.24.0
- @labre/affine-block-paragraph@0.24.0
- @labre/affine-block-surface@0.24.0
- @labre/affine-block-surface-ref@0.24.0
- @labre/affine-components@0.24.0
- @labre/data-view@0.24.0
- @labre/affine-ext-loader@0.24.0
- @labre/affine-fragment-doc-title@0.24.0
- @labre/affine-inline-latex@0.24.0
- @labre/affine-inline-link@0.24.0
- @labre/affine-inline-preset@0.24.0
- @labre/affine-inline-reference@0.24.0
- @labre/affine-model@0.24.0
- @labre/affine-rich-text@0.24.0
- @labre/affine-shared@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-block-attachment@0.23.3
  - @labre/affine-block-database@0.23.3
  - @labre/affine-block-embed@0.23.3
  - @labre/affine-block-image@0.23.3
  - @labre/affine-block-latex@0.23.3
  - @labre/affine-block-list@0.23.3
  - @labre/affine-block-note@0.23.3
  - @labre/affine-block-paragraph@0.23.3
  - @labre/affine-block-surface@0.23.3
  - @labre/affine-block-surface-ref@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/data-view@0.23.3
  - @labre/affine-fragment-doc-title@0.23.3
  - @labre/affine-inline-latex@0.23.3
  - @labre/affine-inline-link@0.23.3
  - @labre/affine-inline-preset@0.23.3
  - @labre/affine-inline-reference@0.23.3
  - @labre/affine-rich-text@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-block-attachment@0.23.2
  - @labre/affine-block-database@0.23.2
  - @labre/affine-block-embed@0.23.2
  - @labre/affine-block-image@0.23.2
  - @labre/affine-block-latex@0.23.2
  - @labre/affine-block-list@0.23.2
  - @labre/affine-block-note@0.23.2
  - @labre/affine-block-paragraph@0.23.2
  - @labre/affine-block-surface@0.23.2
  - @labre/affine-block-surface-ref@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/data-view@0.23.2
  - @labre/affine-fragment-doc-title@0.23.2
  - @labre/affine-inline-latex@0.23.2
  - @labre/affine-inline-link@0.23.2
  - @labre/affine-inline-preset@0.23.2
  - @labre/affine-inline-reference@0.23.2
  - @labre/affine-rich-text@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-block-attachment@0.23.1
  - @labre/affine-block-database@0.23.1
  - @labre/affine-block-embed@0.23.1
  - @labre/affine-block-image@0.23.1
  - @labre/affine-block-latex@0.23.1
  - @labre/affine-block-list@0.23.1
  - @labre/affine-block-note@0.23.1
  - @labre/affine-block-paragraph@0.23.1
  - @labre/affine-block-surface@0.23.1
  - @labre/affine-block-surface-ref@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/data-view@0.23.1
  - @labre/affine-fragment-doc-title@0.23.1
  - @labre/affine-inline-latex@0.23.1
  - @labre/affine-inline-link@0.23.1
  - @labre/affine-inline-preset@0.23.1
  - @labre/affine-inline-reference@0.23.1
  - @labre/affine-rich-text@0.23.1
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
  - @labre/affine-block-surface@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-block-attachment@0.23.0
  - @labre/affine-block-database@0.23.0
  - @labre/affine-block-embed@0.23.0
  - @labre/affine-block-image@0.23.0
  - @labre/affine-block-latex@0.23.0
  - @labre/affine-block-list@0.23.0
  - @labre/affine-block-note@0.23.0
  - @labre/affine-block-paragraph@0.23.0
  - @labre/affine-block-surface-ref@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-fragment-doc-title@0.23.0
  - @labre/affine-inline-latex@0.23.0
  - @labre/affine-inline-link@0.23.0
  - @labre/affine-inline-preset@0.23.0
  - @labre/affine-inline-reference@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/data-view@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
