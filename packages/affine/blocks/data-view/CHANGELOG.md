# @labre/affine-block-data-view

## 0.54.0

### Patch Changes

- 5d40ad2: Base views on a phone. The mobile table scrolls sideways inside its own wrapper, the title column stays pinned and opaque, and the row actions no longer cover the title. A context menu on a phone (view settings, filter, sort) opens as a bottom action sheet over a scrim, and a tap on the scrim closes it. The view menu, search, "+ New" and "+ Add filter" are 44px under a coarse pointer. Search now shows on a phone; filter and sort were already in the view menu. "N more" and "+" no longer wrap over "+ Add filter". When the tabs and the tools do not fit side by side, the tools drop to their own line. The full-page base hides its own title row and narrows its margins to 24px under 640px. New keys: `com.labre.data-view.new-record`, `com.labre.data-view.new-record.short`, `com.labre.data-view.group.ungrouped`, `com.labre.data-view.filter.add`, `com.labre.data-view.search.placeholder`, `com.labre.data-view.search.clear-hint`. A base's empty title reads `com.labre.doc.untitled`. No stored format change.
- Updated dependencies [5d40ad2]
- Updated dependencies [5d40ad2]
- Updated dependencies [5d40ad2]
- Updated dependencies [5d40ad2]
- Updated dependencies [5d40ad2]
  - @labre/affine-shared@0.54.0
  - @labre/affine-components@0.54.0
  - @labre/data-view@0.54.0
  - @labre/affine-block-database@0.54.0
  - @labre/affine-widget-slash-menu@0.54.0
  - @labre/affine-ext-loader@0.54.0
  - @labre/affine-model@0.54.0
  - @labre/global@0.54.0
  - @labre/std@0.54.0
  - @labre/store@0.54.0

## 0.53.0

### Patch Changes

- Updated dependencies [3d9e204]
  - @labre/affine-shared@0.53.0
  - @labre/affine-block-database@0.53.0
  - @labre/affine-components@0.53.0
  - @labre/data-view@0.53.0
  - @labre/affine-widget-slash-menu@0.53.0
  - @labre/affine-ext-loader@0.53.0
  - @labre/affine-model@0.53.0
  - @labre/global@0.53.0
  - @labre/std@0.53.0
  - @labre/store@0.53.0

## 0.52.0

### Patch Changes

- Updated dependencies [2124f31]
  - @labre/affine-shared@0.52.0
  - @labre/affine-block-database@0.52.0
  - @labre/affine-components@0.52.0
  - @labre/data-view@0.52.0
  - @labre/affine-widget-slash-menu@0.52.0
  - @labre/affine-ext-loader@0.52.0
  - @labre/affine-model@0.52.0
  - @labre/global@0.52.0
  - @labre/std@0.52.0
  - @labre/store@0.52.0

## 0.51.0

### Patch Changes

- Updated dependencies [e043634]
- Updated dependencies [e043634]
- Updated dependencies [e043634]
- Updated dependencies [e043634]
- Updated dependencies [e043634]
  - @labre/affine-shared@0.51.0
  - @labre/affine-model@0.51.0
  - @labre/affine-block-database@0.51.0
  - @labre/affine-components@0.51.0
  - @labre/data-view@0.51.0
  - @labre/affine-widget-slash-menu@0.51.0
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
  - @labre/affine-widget-slash-menu@0.50.0
  - @labre/affine-ext-loader@0.50.0
  - @labre/global@0.50.0
  - @labre/std@0.50.0
  - @labre/store@0.50.0

## 0.49.0

### Minor Changes

- 651ffab: The tag menu, the date picker and new views' names speak the host's catalogue (ADR 0023). The tag menu of select and multi-select cells (the inline table, the bases, the chips band) keys its placeholder, tip, "Create", "Delete" and colour names; the date picker keys "Today", "Clear" and its arrows, and draws its day and month names with `Intl` in the editor's locale (`en-US` by default, which reads as before). A cell resolves these while it is in the editor and hands them to the popup (`BaseCellRenderer.wording`, `TagManagerOptions.wording`, `DatePicker.wording` and `DatePicker.locale`, all optional). A new view is named in the author's language at the gesture: each preset declares `defaultNameKey` beside its unchanged English `defaultName`, `viewDefaultName(meta, std)` resolves it, and `ViewManager.viewAdd(type, name?)`, `databaseViewInitTemplate(…, std?)` and `initDatabaseBlock(…, std?)` write the resolved name; the views bar's `addView`, which `AddViewMenuContext` hands the bundle, resolves it for "on an existing source" and "with a new source" too, and the bundle's preset entries show the resolved name; the table's group fold button keys "Expand group" / "Collapse group" (`com.labre.data-view.group.{expand,collapse}`); without an editor the English seed is written, as in 0.48, and a stored name is never re-translated. `SelectOptionColor` gains an optional `wording`. New keys (FR in the host): `com.labre.data-view.view.default-name.{table,kanban,calendar,gallery,list}`, `com.labre.data-view.tag.{placeholder,tip,create,color.teal}`, `com.labre.date-picker.{today,clear,previous-month,next-month}`; the colours reuse `com.labre.palette-name.*` and "Delete" `com.labre.toolbar.delete`.
- 651ffab: The `database` and `data-view` flags gate tooling, never a stored database (ADR 0009 amendment of 2026-10-14, ADR 0035 §5). The database view is split the callout's way: the new `DatabaseRenderViewExtension` (block view, flavour, `effects()`, the title band's link cell) is always registered, and `DatabaseViewExtension` keeps only the creation tooling under `database`: the slash entries, "+ view" / "Create …" in the views bar (through the new `DatabaseViewCreationIdentifier`; absent, the block sets the new data-view key `ViewCreationOffKey` on its source), and the host's `configure` of the block's "⋯" menu, so `viewManager.configure(DatabaseViewExtension, …)` still compiles. Same split for the data-view block: `DataViewRenderViewExtension` always on, `DataViewViewExtension` gated and empty. With `{ database: false, 'data-view': false }` a stored database renders with all its views, its cells stay editable and its rows open. A host that registers these extensions by hand (rather than through `getInternalViewExtensions`) must add the render halves.

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
  - @labre/affine-model@0.49.0
  - @labre/affine-widget-slash-menu@0.49.0
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
  - @labre/affine-block-database@0.48.0
  - @labre/affine-components@0.48.0
  - @labre/affine-widget-slash-menu@0.48.0
  - @labre/affine-ext-loader@0.48.0
  - @labre/affine-model@0.48.0
  - @labre/global@0.48.0
  - @labre/std@0.48.0
  - @labre/store@0.48.0

## 0.47.1

### Patch Changes

- Updated dependencies [d796aed]
  - @labre/affine-components@0.47.1
  - @labre/affine-shared@0.47.1
  - @labre/affine-widget-slash-menu@0.47.1
  - @labre/affine-block-database@0.47.1
  - @labre/data-view@0.47.1
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
  - @labre/data-view@0.47.0
  - @labre/std@0.47.0
  - @labre/affine-block-database@0.47.0
  - @labre/affine-components@0.47.0
  - @labre/affine-widget-slash-menu@0.47.0
  - @labre/affine-model@0.47.0
  - @labre/affine-ext-loader@0.47.0
  - @labre/global@0.47.0
  - @labre/store@0.47.0

## 0.46.2

### Patch Changes

- Updated dependencies [cc86d33]
  - @labre/affine-shared@0.46.2
  - @labre/affine-block-database@0.46.2
  - @labre/affine-components@0.46.2
  - @labre/data-view@0.46.2
  - @labre/affine-widget-slash-menu@0.46.2
  - @labre/affine-ext-loader@0.46.2
  - @labre/affine-model@0.46.2
  - @labre/global@0.46.2
  - @labre/std@0.46.2
  - @labre/store@0.46.2

## 0.46.1

### Patch Changes

- @labre/affine-block-database@0.46.1
- @labre/affine-components@0.46.1
- @labre/data-view@0.46.1
- @labre/affine-ext-loader@0.46.1
- @labre/affine-model@0.46.1
- @labre/affine-shared@0.46.1
- @labre/affine-widget-slash-menu@0.46.1
- @labre/global@0.46.1
- @labre/std@0.46.1
- @labre/store@0.46.1

## 0.46.0

### Patch Changes

- Updated dependencies [f076627]
  - @labre/affine-shared@0.46.0
  - @labre/affine-block-database@0.46.0
  - @labre/affine-components@0.46.0
  - @labre/data-view@0.46.0
  - @labre/affine-widget-slash-menu@0.46.0
  - @labre/affine-ext-loader@0.46.0
  - @labre/affine-model@0.46.0
  - @labre/global@0.46.0
  - @labre/std@0.46.0
  - @labre/store@0.46.0

## 0.45.1

### Patch Changes

- Updated dependencies [ffe75a2]
  - @labre/affine-shared@0.45.1
  - @labre/affine-block-database@0.45.1
  - @labre/affine-components@0.45.1
  - @labre/data-view@0.45.1
  - @labre/affine-widget-slash-menu@0.45.1
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
  - @labre/affine-shared@0.45.0
  - @labre/data-view@0.45.0
  - @labre/affine-components@0.45.0
  - @labre/std@0.45.0
  - @labre/affine-block-database@0.45.0
  - @labre/affine-widget-slash-menu@0.45.0
  - @labre/affine-model@0.45.0
  - @labre/affine-ext-loader@0.45.0
  - @labre/global@0.45.0
  - @labre/store@0.45.0

## 0.44.0

### Patch Changes

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
- Updated dependencies [e677a3b]
- Updated dependencies [8ce6769]
- Updated dependencies [2908a50]
- Updated dependencies [dfc4baa]
- Updated dependencies [4d12815]
  - @labre/affine-shared@0.44.0
  - @labre/std@0.44.0
  - @labre/affine-model@0.44.0
  - @labre/affine-components@0.44.0
  - @labre/affine-block-database@0.44.0
  - @labre/data-view@0.44.0
  - @labre/affine-widget-slash-menu@0.44.0
  - @labre/affine-ext-loader@0.44.0
  - @labre/global@0.44.0
  - @labre/store@0.44.0

## 0.43.1

### Patch Changes

- Updated dependencies [2602909]
  - @labre/affine-shared@0.43.1
  - @labre/affine-model@0.43.1
  - @labre/affine-block-database@0.43.1
  - @labre/affine-components@0.43.1
  - @labre/data-view@0.43.1
  - @labre/affine-widget-slash-menu@0.43.1
  - @labre/affine-ext-loader@0.43.1
  - @labre/global@0.43.1
  - @labre/std@0.43.1
  - @labre/store@0.43.1

## 0.43.0

### Patch Changes

- Updated dependencies [da68dbb]
- Updated dependencies [8f54236]
- Updated dependencies [f1a4af7]
- Updated dependencies [8a927dd]
  - @labre/affine-shared@0.43.0
  - @labre/affine-components@0.43.0
  - @labre/affine-widget-slash-menu@0.43.0
  - @labre/affine-block-database@0.43.0
  - @labre/data-view@0.43.0
  - @labre/affine-ext-loader@0.43.0
  - @labre/affine-model@0.43.0
  - @labre/global@0.43.0
  - @labre/std@0.43.0
  - @labre/store@0.43.0

## 0.42.0

### Patch Changes

- Updated dependencies [87ef822]
- Updated dependencies [f294deb]
- Updated dependencies [911d143]
- Updated dependencies [0dcd69b]
- Updated dependencies [4899136]
- Updated dependencies [2f5c621]
- Updated dependencies [911d143]
- Updated dependencies [48213e7]
- Updated dependencies [512ab39]
- Updated dependencies [7437481]
- Updated dependencies [2e179bb]
- Updated dependencies [911d143]
- Updated dependencies [4f5faa3]
- Updated dependencies [f3f412a]
- Updated dependencies [f6ece47]
- Updated dependencies [e2f6ca5]
- Updated dependencies [d1851b1]
- Updated dependencies [5a8ec30]
- Updated dependencies [549056e]
- Updated dependencies [2bb7318]
- Updated dependencies [c73b25f]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [55d9f13]
  - @labre/std@0.42.0
  - @labre/affine-model@0.42.0
  - @labre/affine-shared@0.42.0
  - @labre/store@0.42.0
  - @labre/affine-components@0.42.0
  - @labre/global@0.42.0
  - @labre/affine-block-database@0.42.0
  - @labre/data-view@0.42.0
  - @labre/affine-widget-slash-menu@0.42.0
  - @labre/affine-ext-loader@0.42.0

## 0.41.0

### Patch Changes

- Updated dependencies [a513f05]
- Updated dependencies [6cfe313]
- Updated dependencies [5776733]
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
  - @labre/affine-shared@0.41.0
  - @labre/affine-widget-slash-menu@0.41.0
  - @labre/std@0.41.0
  - @labre/affine-components@0.41.0
  - @labre/affine-block-database@0.41.0
  - @labre/data-view@0.41.0
  - @labre/affine-model@0.41.0
  - @labre/affine-ext-loader@0.41.0
  - @labre/global@0.41.0
  - @labre/store@0.41.0

## 0.40.0

### Patch Changes

- Updated dependencies [95ff0a5]
- Updated dependencies [95ff0a5]
  - @labre/affine-shared@0.40.0
  - @labre/affine-block-database@0.40.0
  - @labre/affine-components@0.40.0
  - @labre/data-view@0.40.0
  - @labre/affine-widget-slash-menu@0.40.0
  - @labre/affine-ext-loader@0.40.0
  - @labre/affine-model@0.40.0
  - @labre/global@0.40.0
  - @labre/std@0.40.0
  - @labre/store@0.40.0

## 0.39.3

### Patch Changes

- Updated dependencies [070e1ec]
  - @labre/affine-components@0.39.3
  - @labre/affine-block-database@0.39.3
  - @labre/data-view@0.39.3
  - @labre/affine-widget-slash-menu@0.39.3
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
  - @labre/affine-block-database@0.39.2
  - @labre/affine-components@0.39.2
  - @labre/data-view@0.39.2
  - @labre/affine-widget-slash-menu@0.39.2
  - @labre/affine-ext-loader@0.39.2
  - @labre/affine-model@0.39.2
  - @labre/global@0.39.2
  - @labre/std@0.39.2
  - @labre/store@0.39.2

## 0.39.1

### Patch Changes

- Updated dependencies [186cd6d]
- Updated dependencies [00eab3d]
  - @labre/affine-block-database@0.39.1
  - @labre/affine-model@0.39.1
  - @labre/affine-components@0.39.1
  - @labre/affine-shared@0.39.1
  - @labre/data-view@0.39.1
  - @labre/affine-widget-slash-menu@0.39.1
  - @labre/affine-ext-loader@0.39.1
  - @labre/global@0.39.1
  - @labre/std@0.39.1
  - @labre/store@0.39.1

## 0.39.0

### Patch Changes

- @labre/affine-block-database@0.39.0
- @labre/affine-components@0.39.0
- @labre/data-view@0.39.0
- @labre/affine-ext-loader@0.39.0
- @labre/affine-model@0.39.0
- @labre/affine-shared@0.39.0
- @labre/affine-widget-slash-menu@0.39.0
- @labre/global@0.39.0
- @labre/std@0.39.0
- @labre/store@0.39.0

## 0.38.2

### Patch Changes

- Updated dependencies [0ffa45b]
  - @labre/std@0.38.2
  - @labre/affine-block-database@0.38.2
  - @labre/affine-components@0.38.2
  - @labre/data-view@0.38.2
  - @labre/affine-model@0.38.2
  - @labre/affine-shared@0.38.2
  - @labre/affine-widget-slash-menu@0.38.2
  - @labre/affine-ext-loader@0.38.2
  - @labre/global@0.38.2
  - @labre/store@0.38.2

## 0.38.1

### Patch Changes

- @labre/affine-block-database@0.38.1
- @labre/affine-components@0.38.1
- @labre/data-view@0.38.1
- @labre/affine-ext-loader@0.38.1
- @labre/affine-model@0.38.1
- @labre/affine-shared@0.38.1
- @labre/affine-widget-slash-menu@0.38.1
- @labre/global@0.38.1
- @labre/std@0.38.1
- @labre/store@0.38.1

## 0.38.0

### Patch Changes

- Updated dependencies [6a7c31a]
- Updated dependencies [6aa0081]
  - @labre/affine-model@0.38.0
  - @labre/affine-shared@0.38.0
  - @labre/affine-block-database@0.38.0
  - @labre/affine-components@0.38.0
  - @labre/data-view@0.38.0
  - @labre/affine-widget-slash-menu@0.38.0
  - @labre/affine-ext-loader@0.38.0
  - @labre/global@0.38.0
  - @labre/std@0.38.0
  - @labre/store@0.38.0

## 0.37.0

### Patch Changes

- @labre/affine-block-database@0.37.0
- @labre/affine-components@0.37.0
- @labre/data-view@0.37.0
- @labre/affine-ext-loader@0.37.0
- @labre/affine-model@0.37.0
- @labre/affine-shared@0.37.0
- @labre/affine-widget-slash-menu@0.37.0
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
  - @labre/affine-shared@0.36.0
  - @labre/std@0.36.0
  - @labre/affine-model@0.36.0
  - @labre/affine-block-database@0.36.0
  - @labre/data-view@0.36.0
  - @labre/affine-widget-slash-menu@0.36.0
  - @labre/affine-ext-loader@0.36.0
  - @labre/global@0.36.0
  - @labre/store@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [ea5d249]
- Updated dependencies [de3560d]
- Updated dependencies [7f09608]
- Updated dependencies [cf0d8a1]
  - @labre/affine-components@0.35.0
  - @labre/affine-shared@0.35.0
  - @labre/std@0.35.0
  - @labre/affine-model@0.35.0
  - @labre/affine-block-database@0.35.0
  - @labre/data-view@0.35.0
  - @labre/affine-widget-slash-menu@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-block-database@0.34.2
- @labre/affine-components@0.34.2
- @labre/data-view@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-shared@0.34.2
- @labre/affine-widget-slash-menu@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2
- @labre/store@0.34.2

## 0.34.1

### Patch Changes

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-block-database@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/data-view@0.34.1
  - @labre/affine-widget-slash-menu@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1
  - @labre/store@0.34.1

## 0.34.0

### Patch Changes

- Updated dependencies [881d3f5]
- Updated dependencies [6c1bdfb]
- Updated dependencies [8b00f7d]
- Updated dependencies [5f76ab3]
- Updated dependencies [f09d68c]
  - @labre/std@0.34.0
  - @labre/affine-shared@0.34.0
  - @labre/affine-block-database@0.34.0
  - @labre/affine-components@0.34.0
  - @labre/affine-widget-slash-menu@0.34.0
  - @labre/data-view@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Patch Changes

- Updated dependencies [3fbf69c]
- Updated dependencies [f929e12]
- Updated dependencies [13360cd]
- Updated dependencies [c03090c]
- Updated dependencies [32e4d45]
- Updated dependencies [139d77b]
- Updated dependencies [6bba40c]
- Updated dependencies [a8325bb]
- Updated dependencies [ff19911]
- Updated dependencies [b03132c]
- Updated dependencies [48049d6]
- Updated dependencies [7136db0]
- Updated dependencies [5737a56]
- Updated dependencies [168617d]
- Updated dependencies [9022c92]
- Updated dependencies [edfaba2]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [4a3b26e]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-components@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-block-database@0.33.0
  - @labre/data-view@0.33.0
  - @labre/affine-widget-slash-menu@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Patch Changes

- 8ded589: A database can now be read as a month

  Until now a database offered two shapes: a table and a kanban board. Neither
  of them answers the question a transformation roadmap asks first — what is
  happening in March? A calendar view now sits beside them: pick it from the
  slash menu ("Calendar View"), from the view switcher, or convert an existing
  table or kanban into one and keep its filters and sort.

  The view maps one date property to the grid and, optionally, a second one to
  close a range, so a workstream that runs from the 4th to the 19th is drawn as
  a single bar across the weeks it spans rather than as a dot on its start day.
  Cards can be dragged from one day to another (a range keeps its length), a
  range can be stretched by its edges, and clicking an empty day creates a row
  already dated. Months are navigated with the arrows or the "Today" button.

  Hosts can feed the same grid from outside the document by registering a
  `CalendarExternalSourceProvider`; the editor ships none, so a standalone
  playground simply shows the database's own rows.

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
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
- Updated dependencies [50ab9ae]
- Updated dependencies [6264dfc]
- Updated dependencies [c2e1020]
- Updated dependencies [ceb2761]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [5ac0c68]
- Updated dependencies [1fa46c1]
- Updated dependencies [d8eb24a]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
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
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [48e90f4]
- Updated dependencies [5a61fb2]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [025d6f5]
- Updated dependencies [b1ed4ef]
- Updated dependencies [985a92f]
- Updated dependencies [b889326]
- Updated dependencies [1efc6d5]
- Updated dependencies [4162e4a]
- Updated dependencies [fad4c08]
- Updated dependencies [7b66d8d]
- Updated dependencies [4bb44ef]
- Updated dependencies [30061cb]
- Updated dependencies [77b0100]
- Updated dependencies [8d33c60]
- Updated dependencies [7a3458a]
  - @labre/std@0.32.0
  - @labre/affine-shared@0.32.0
  - @labre/store@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/data-view@0.32.0
  - @labre/affine-block-database@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-widget-slash-menu@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-database@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/data-view@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/affine-widget-slash-menu@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-database@0.30.2
- @labre/affine-components@0.30.2
- @labre/data-view@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-shared@0.30.2
- @labre/affine-widget-slash-menu@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-block-database@0.30.1
- @labre/affine-components@0.30.1
- @labre/data-view@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-shared@0.30.1
- @labre/affine-widget-slash-menu@0.30.1
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
  - @labre/affine-block-database@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/data-view@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-slash-menu@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-database@0.29.1
- @labre/affine-components@0.29.1
- @labre/data-view@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-shared@0.29.1
- @labre/affine-widget-slash-menu@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-database@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/data-view@0.29.0
  - @labre/affine-widget-slash-menu@0.29.0
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
  - @labre/affine-components@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-slash-menu@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [14ef3e7]
- Updated dependencies [91f6397]
  - @labre/affine-block-database@0.27.0
  - @labre/std@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/data-view@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-slash-menu@0.27.0
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
  - @labre/affine-shared@0.26.0
  - @labre/data-view@0.26.0
  - @labre/affine-widget-slash-menu@0.26.0
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
  - @labre/affine-shared@0.25.0
  - @labre/data-view@0.25.0
  - @labre/affine-widget-slash-menu@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-block-database@0.24.0
- @labre/affine-components@0.24.0
- @labre/data-view@0.24.0
- @labre/affine-ext-loader@0.24.0
- @labre/affine-model@0.24.0
- @labre/affine-shared@0.24.0
- @labre/affine-widget-slash-menu@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-block-database@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/data-view@0.23.3
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
  - @labre/affine-block-database@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/data-view@0.23.2
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
  - @labre/affine-block-database@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/data-view@0.23.1
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
  - @labre/affine-block-database@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/data-view@0.23.0
  - @labre/affine-widget-slash-menu@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
