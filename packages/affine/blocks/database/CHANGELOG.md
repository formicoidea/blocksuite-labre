# @labre/affine-block-database

## 0.49.0

### Minor Changes

- 651ffab: The tag menu, the date picker and new views' names speak the host's catalogue (ADR 0023). The tag menu of select and multi-select cells (the inline table, the bases, the chips band) keys its placeholder, tip, "Create", "Delete" and colour names; the date picker keys "Today", "Clear" and its arrows, and draws its day and month names with `Intl` in the editor's locale (`en-US` by default, which reads as before). A cell resolves these while it is in the editor and hands them to the popup (`BaseCellRenderer.wording`, `TagManagerOptions.wording`, `DatePicker.wording` and `DatePicker.locale`, all optional). A new view is named in the author's language at the gesture: each preset declares `defaultNameKey` beside its unchanged English `defaultName`, `viewDefaultName(meta, std)` resolves it, and `ViewManager.viewAdd(type, name?)`, `databaseViewInitTemplate(…, std?)` and `initDatabaseBlock(…, std?)` write the resolved name; the views bar's `addView`, which `AddViewMenuContext` hands the bundle, resolves it for "on an existing source" and "with a new source" too, and the bundle's preset entries show the resolved name; the table's group fold button keys "Expand group" / "Collapse group" (`com.labre.data-view.group.{expand,collapse}`); without an editor the English seed is written, as in 0.48, and a stored name is never re-translated. `SelectOptionColor` gains an optional `wording`. New keys (FR in the host): `com.labre.data-view.view.default-name.{table,kanban,calendar,gallery,list}`, `com.labre.data-view.tag.{placeholder,tip,create,color.teal}`, `com.labre.date-picker.{today,clear,previous-month,next-month}`; the colours reuse `com.labre.palette-name.*` and "Delete" `com.labre.toolbar.delete`.
- 651ffab: Two new database views, Gallery and List (ADR 0035 §1, issues B6 and B7), stored under the modes `gallery` and `list`. A gallery draws one card per row, its title then its visible properties; a list draws one line per row, the title on the left and the visible properties as chips on the right (an empty value draws no chip; on a narrow screen the chips wrap under the title). Both are the table transposed, not a new drawing: every value is drawn and edited by the cell renderer a table cell mounts, with the table's tag menu, date picker and inputs, and while a value edits the rows hold still as in a table. Per-view visibility is stored as table and kanban store it, `columns[].hide`, and the view's Properties popover hides, shows and reorders; filter, sort and search are the engine's. "New page" adds a row at the end and opens it; a click on a card or a row outside its values, or on its open button, opens the row through the detail panel, as the table and kanban open buttons do. A new gallery or list shows the title only, as in Notion; switching a table, a board or a calendar to a gallery or a list (and back to a table or a board) keeps the filter and the sort. One UI serves desktop and mobile (44px rows on a touch screen); editing on mobile follows the block's read-only state. A card has no cover image yet. Nothing is written when a stored gallery or list view is drawn. A value a hosted source has not delivered yet draws the table's skeleton and cannot be edited over; a source whose rows are documents titles its cards and rows through `titleOf`, as its table does.

  The database block registers both presets and gives them the table's toolbar (filter, sort, search, view options, New). New key `com.labre.data-view.new-page` ("New page", `@labre/data-view/translations`); the open button reuses `com.labre.open-doc.open`. `<dv-standalone-cell>` gains an optional `onEditingChange(editing)` callback, told when its editor opens and closes.

  A host older than this version meeting a stored `gallery` or `list` view takes its unknown-view path (ADR 0035 §6).

- 651ffab: Three database seams and option edits from the title band (ADR 0035 §9a to §9c, issues B9, B10, B12). `DatabaseOpenRowExtension({ open })` (`@labre/affine/blocks/database`) receives every row a view opens when the source's rows are documents, with the view's stored `openIn` as `mode` (`side` when absent) and `newTab` for a Ctrl/Cmd click; without it, rows open in the detail panel as before. The view options' "Properties" asks `PropertiesPanelExtension` with `scope: 'source'`, and the bundle's `affine-database-properties-panel` element draws the view's properties list for the host to mount where it wants; without the seam, the popover stays. `DataSourcePickerExtension({ list, createDatabase?, createSource? })` (`@labre/affine/shared/services`) adds a "Linked view of a database" slash entry that inserts a view of an existing source (`popDataSourcePicker` in `@labre/core-database/view`); registered without `createDatabase`, "Table View" and "Kanban View" leave the slash menu, with it they ask the host for a new database. `TitleBandService.setData?` and `TitleBandProperty.dataWritable?` let a select chip create and rename options. New keys: `com.labre.database.properties-panel.{title,show-all,hide-all,unavailable}`, `com.labre.database.picker.{title,new-source,new-database,empty}`, `com.labre.database.slash.linked-view` and `.linked-view.description`. Nothing is written on load.
- 651ffab: Hosted database sources (ADR 0035 §7, §9e, §9f; issues B1, B2, B15).

  `HostedDataSourceBase(hostModel, resolveSource?)` replaces `ExternalDataSourceBase(model)`, which stays exported as an alias with the same one-argument constructor: a 0.48 host source compiles and reads its rows unchanged. The views stay in `hostModel.props.views`; with `resolveSource`, each view reads the source its stored `sourceId` names (absent: the host's implicit source), `resolveSource` returning `{ schema, rows }` (the `affine:database` block that owns the source's schema and a signal of its row ids). The data layer answers for the current view's source (`source# @labre/affine-block-database, `schema# @labre/affine-block-database, `rows# @labre/affine-block-database); a source the host cannot resolve (`null`, `sourceMissing# @labre/affine-block-database) draws "Source not found" under the database title and its view bar instead of the view, never an error, and nothing is rewritten. Without `resolveSource`, every view reads the block itself, as in 0.48. `HostedSource` and `ResolveHostedSource` are exported.

  Cell hydration, a widening of the data-source contract: `cellStatus(rowId, propertyId)` (`ready`, `pending`, `error`), `valuesState# @labre/affine-block-database (`{ status: 'loading' | 'ready' | 'error', since }`) and an optional `retryValues()`, `ready`by default on`DataSourceBase`, so the inline source and every 0.48 host source are unchanged. A pending cell draws a skeleton and a failed one stays empty in every table and kanban cell (desktop, virtual and mobile); neither mounts its editor, and `Cell.valueSet`/`jsonValueSet` do nothing on them, so no paste, fill or drop writes over an undelivered value. Group counts and column statistics show "…" until values are ready; a banner says values are still loading after 3 s (`com.labre.database.values.loading`) and, on error, that they could not be loaded (`com.labre.database.values.error`) with Retry (`com.labre.resource.status.retry`, the existing word) when the source offers `retryValues`. New exports in `@labre/data-view`: `CellStatus`, `ValuesState`, `ValuesStatus`, `DataSourceHydration`, `cellStatusOf`, `valuesStateOf`, `valuesReady`, `valuesBannerOf`, `VALUES_READY`, `VALUES_SLOW_AFTER_MS`, `VALUES_PENDING_MARK`, `renderCellStatus`; `Cell`gains an optional`status# @labre/affine-block-database; `DataViewRendererConfig` an optional `viewPlaceholder`.

  Rows that are documents: a hosted source overrides `rowsAreDocuments`, answers titles from its own store with `titleOf(rowId)` and returns the new `hostedTitleColumnConfig` from `propertyMetaGet('title')`: the title column keeps its `title` type and fixed rules, its value is a plain string drawn and edited by the plain-text cell, and no row's document is loaded to draw it.

  New keys, English fallbacks in `@labre/affine-block-database/translations` (`DATABASE_WORDINGS`, a new entry point): `com.labre.database.source-missing`, `com.labre.database.source-missing.hint`, `com.labre.database.values.loading` and `com.labre.database.values.error`.

- 651ffab: Databases are editable on mobile (ADR 0035 §1, B5): `ExternalDataSourceBase.readonly# @labre/affine-block-database is the store's read-only state alone and no longer adds `IS_MOBILE`. Editing goes through the touch renderers the table and kanban presets already ship (cell tap to edit, the mobile row and card menus, the mobile tag and date pickers); nothing new is drawn. Their touch targets grow to 44px: table rows and column headers, kanban cells and "add card", and the row and card ops through an invisible hit area that keeps their drawn size.
- 651ffab: Two additions for a host that backs a database with its own pages (ADR 0035, amendment of 2026-10-14). **The menu beside "New":** `DatabaseNewRowMenuExtension({ open })` (`@labre/affine/blocks/database`, identifier `DatabaseNewRowMenuProvider`) draws a chevron beside the "New" button of every view (table, kanban, gallery, list, calendar, inline and on the full page); a click calls `open({ anchor, blockId, viewId })` and the host draws its menu (its templates). "New" itself still adds a row through the source's `rowAdd`, where a host applies its default template. Absent or `null`, "New" is the single button it was. The chevron's label and tooltip is the new key `com.labre.database.new-record.more` ("Templates and options"); 44px on a coarse pointer. **A text column for hosted sources:** `hostedTextColumnConfig` (same entry) is data-view's plain-text preset (type `text`, a string value, the table's plain-text cell) offered by "+ property" and "Type" on a source that lists it in `getPropertyMetas` and answers it from `propertyMetaGet('text')`. The inline database does not offer it: its Text stays `rich-text`. No stored field changes.
- 651ffab: The `database` and `data-view` flags gate tooling, never a stored database (ADR 0009 amendment of 2026-10-14, ADR 0035 §5). The database view is split the callout's way: the new `DatabaseRenderViewExtension` (block view, flavour, `effects()`, the title band's link cell) is always registered, and `DatabaseViewExtension` keeps only the creation tooling under `database`: the slash entries, "+ view" / "Create …" in the views bar (through the new `DatabaseViewCreationIdentifier`; absent, the block sets the new data-view key `ViewCreationOffKey` on its source), and the host's `configure` of the block's "⋯" menu, so `viewManager.configure(DatabaseViewExtension, …)` still compiles. Same split for the data-view block: `DataViewRenderViewExtension` always on, `DataViewViewExtension` gated and empty. With `{ database: false, 'data-view': false }` a stored database renders with all its views, its cells stay editable and its rows open. A host that registers these extensions by hand (rather than through `getInternalViewExtensions`) must add the render halves.
- 651ffab: Database telemetry (ADR 0035 §12, B17), documented in the telemetry README's new "Databases" section with the boundary between the library's `Database*` events and the host's own `base.*`. New events, ids and closed vocabularies only, never a row id, a value, a title or a name: `DatabaseViewAdded { viewType, source: 'existing' | 'new' }` (the views bar's "+", once per gesture; "with a new source" reports `new` through `AddViewMenuContext.addView(type, source?)`, whose new parameter is optional), `DatabaseViewTypeChanged { fromViewType, toViewType }` (the Layout switch), `DatabaseGroupChanged { groupBy, propertyType? }` (every grouping menu, through `GroupTrait`), `DatabaseRowOpened { mode, newTab, rowKind }` (every preset's row open, gallery and list included, from the database block's `openDetailPanel` once B9's row-open request is built: the host's mode, `side` for the library's own peek or detail) and `DatabaseValuesLoadFailed { retryable }` (once per failure of a hosted source). Filters and sorts keep their historical `CreateDatabaseFilter` and `DatabaseSort*` series. `AddDatabaseView` is no longer emitted (replaced by `DatabaseViewAdded`); it and the never-emitted `CreateDatabaseView`, `ChangeDatabaseLayout` and `CreateDatabaseGroup` stay in `TelemetryEventMap`, deprecated. A host that forwards `track(event, props)` needs nothing; one that types an exhaustive `Record<keyof TelemetryEventMap, …>` adds the five keys. New in `@labre/data-view`: `DataViewEventTraceKey` (the tracer a database block gives its source), `traceViewEvent`. New in `@labre/affine-block-database`: `rowOpenedParams`.
- 651ffab: A stored database view whose mode has no preset here (a `timeline` from an import, a mode written by a newer client) renders as a table instead of throwing `Unknown view type` and blanking the whole database (ADR 0035 §6). `viewMetaGet` never throws: the database answers the table preset over the source's properties. Such a view reads the table's default settings, never rewrites its stored data (`SingleView.dataUpdate` is a no-op on it), keeps editable cells, and its tab says "Shown as a table" (`com.labre.data-view.view.shown-as-table`); its menu offers "Duplicate as table" (`com.labre.data-view.view.duplicate-as-table`) instead of rename, Edit View and Duplicate. New on `SingleView`: `shownAsFallback# @labre/affine-block-database; new in `@labre/data-view`: `duplicateAsShownPreset(manager, viewId)`and`./translations` (`DATA_VIEW_WORDINGS`). Calendar becomes render-only: a stored calendar view still renders and edits as a calendar and can still be switched to a table or a board, but no path creates one any more (the slash "Calendar View" entry is gone, `databaseBlockViews`, the list the views bar and Layout read, no longer holds calendar, and `databaseBlockViewConverts`drops the conversions into calendar). New exports:`databaseBlockRenderableViews`, `databaseBlockFallbackView`, `databaseBlockViewMetaGet(mode)`; `databaseBlockViewMap`has no prototype, so a mode named`constructor` falls back too. The view menu's Duplicate and Delete now read the toolbar's keys (`com.labre.toolbar.duplicate`, `com.labre.toolbar.delete`).
- 651ffab: The database view bar behaves like Notion's and a database can be shown as a full page (ADR 0035 B11, B13).

  - **View bar (core).** As many tabs as the width allows, the rest under "N more" (`com.labre.data-view.views-bar.more`, `{{count}}`), which lists the views without a tab. The current view always keeps its tab, in place of the last one that would have fitted. "+" is always drawn after the tabs (no longer only when every tab fits) and is the bar's only creation entry: "N more" no longer offers "Create …". On a phone the tabs, "N more" and "+" are 44px tall. The tab menu's wordings are keys now (`com.labre.data-view.views-bar.view-name`, `.edit-view`, `.move-left`, `.move-right`, `.add-view`). `component-overflow` takes a `pinned` item and passes the hidden indices to `renderMore` as a second argument. New registry `AddViewMenuExtension` / `AddViewMenuIdentifier`, filled by the bundle, never by a host: absent, "+" lists the creatable presets as before.
  - **Hosted sources.** `HostedDataSourceBase` gains `resolvesSources` and `sourceOf(sourceId)`, read-only.
  - **`@labre/core-database`.** `DatabaseEditorToolingViewExtension` gives "+" its source entries on a source that resolves sources: "On an existing source" (each source the views read, and the sources of its database that the host's `DataSourcePickerExtension` lists with no view yet) and "With a new source" when that picker has `createSource`; a view added on a source stores its `sourceId`, and its default data is derived from that source. `DatabaseEditorViewExtension` defines `<affine-database-page .store .extensions .hostBlockId>` (`DatabasePageHost`): it builds a page editor on the database document that draws the views' block alone, without its title row or the page root's chrome; the schema blocks and the note can be neither selected, deleted, moved nor inserted into, and nothing is written. New keys: `com.labre.database.add-view.existing-source`, `.new-source`, `.untitled-source`, `com.labre.database.page.host-missing`.

- 651ffab: A database's full page no longer writes into its note from the title, and the menu beside "New" can be offered per database (ADR 0035, amendment of 2026-10-14).

  - `<doc-title>` gains `bodyBlockId` (optional). Set to the database block a full page shows, Enter and ArrowDown leave the title for that block (the first cell of a table or kanban view, through the new `DatabaseBlockComponent.focusFirstCell()`) and never add a paragraph to the note. Unset, the title behaves as before.
  - `DatabaseNewRowMenuService` gains `canOpen?({ blockId, viewId })` (type `DatabaseNewRowMenuTarget`): the chevron beside "New" is drawn only where it returns `true`, asked at each render. Absent, every view keeps its chevron, as before.

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
  - @labre/affine-shared@0.49.0
  - @labre/affine-model@0.49.0
  - @labre/affine-inline-preset@0.49.0
  - @labre/affine-inline-reference@0.49.0
  - @labre/affine-rich-text@0.49.0
  - @labre/affine-widget-drag-handle@0.49.0
  - @labre/affine-widget-slash-menu@0.49.0
  - @labre/affine-ext-loader@0.49.0
  - @labre/global@0.49.0
  - @labre/std@0.49.0
  - @labre/store@0.49.0

## 0.48.0

### Minor Changes

- 846e42c: The title band's chips are now the inline table's own cells (ADR 0035 §11, amended 2026-10-13): each value is drawn and edited by the cell renderer a table cell mounts for its type, with the table's look, in the page view and in the note header on the canvas. The checkbox toggles; a select or multi-select opens the table's tag menu, on the host's options only (no "Create", no option menu, no reordering, since the band cannot write a property's config); a date opens the table's date picker; a number, a progress and the text types open the table's inputs; a `link` or `url` is the database block's link cell. A number reads as in a table cell, unformatted unless `enable_database_number_formatting` is on, and a date reads `yyyy/MM/dd`. `TitleBandService` is unchanged: a committed value still goes through `set`, `null` for an emptied one, nothing for an unchanged one.

  `@labre/data-view` gains a cell outside any view: `createStandaloneCell(meta, source)`, the `<dv-standalone-cell>` element that owns the table's edit lifecycle, and `StandaloneCellMetaExtension(meta)` / `StandaloneCellMetaProvider` for a cell type a package above registers (the database block registers its link cell). `Property` gains an optional `dataCanSet` (absent means writable), and the tag menu's `onOptionsChange` becomes optional: absent, its options are fixed. The text cell no longer writes its old value back after Enter.

  Removed from the `doc-title` entry: `chipEditorKind` and `ChipEditorKind` (unused: the cell of each type decides what a click opens; no replacement). The key `com.labre.title-band.clear` is gone (the date picker's own Clear replaces it).

### Patch Changes

- Updated dependencies [846e42c]
- Updated dependencies [846e42c]
- Updated dependencies [846e42c]
  - @labre/affine-shared@0.48.0
  - @labre/data-view@0.48.0
  - @labre/affine-components@0.48.0
  - @labre/affine-inline-preset@0.48.0
  - @labre/affine-inline-reference@0.48.0
  - @labre/affine-rich-text@0.48.0
  - @labre/affine-widget-drag-handle@0.48.0
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
  - @labre/affine-widget-drag-handle@0.47.1
  - @labre/data-view@0.47.1
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
  - @labre/data-view@0.47.0
  - @labre/std@0.47.0
  - @labre/affine-components@0.47.0
  - @labre/affine-inline-preset@0.47.0
  - @labre/affine-inline-reference@0.47.0
  - @labre/affine-rich-text@0.47.0
  - @labre/affine-widget-drag-handle@0.47.0
  - @labre/affine-widget-slash-menu@0.47.0
  - @labre/affine-model@0.47.0
  - @labre/affine-ext-loader@0.47.0
  - @labre/global@0.47.0
  - @labre/store@0.47.0

## 0.46.2

### Patch Changes

- cc86d33: Links only open `http:`, `https:` and `mailto:` addresses (and scheme-less ones such as `example.com`, read as https). A link stored with any other scheme (`javascript:`, `data:`, `vbscript:`, `file:`, also when spelled with mixed case, spaces or control characters) still shows its text but renders no href and opens nothing: the inline link, its hover preview, the bookmark and the GitHub, YouTube, Loom and Figma embed cards, footnote URL references, the database link cell and the canvas element link button. The Markdown import drops the link mark of such a link and keeps its text. Nothing stored is rewritten. New export `isSafeLinkUrl(url)` in `@labre/affine-shared/utils`, the predicate every one of these sites calls.
- Updated dependencies [cc86d33]
  - @labre/affine-shared@0.46.2
  - @labre/affine-components@0.46.2
  - @labre/data-view@0.46.2
  - @labre/affine-inline-preset@0.46.2
  - @labre/affine-inline-reference@0.46.2
  - @labre/affine-rich-text@0.46.2
  - @labre/affine-widget-drag-handle@0.46.2
  - @labre/affine-widget-slash-menu@0.46.2
  - @labre/affine-ext-loader@0.46.2
  - @labre/affine-model@0.46.2
  - @labre/global@0.46.2
  - @labre/std@0.46.2
  - @labre/store@0.46.2

## 0.46.1

### Patch Changes

- @labre/affine-widget-drag-handle@0.46.1
- @labre/affine-components@0.46.1
- @labre/data-view@0.46.1
- @labre/affine-ext-loader@0.46.1
- @labre/affine-inline-preset@0.46.1
- @labre/affine-inline-reference@0.46.1
- @labre/affine-model@0.46.1
- @labre/affine-rich-text@0.46.1
- @labre/affine-shared@0.46.1
- @labre/affine-widget-slash-menu@0.46.1
- @labre/global@0.46.1
- @labre/std@0.46.1
- @labre/store@0.46.1

## 0.46.0

### Patch Changes

- Updated dependencies [f076627]
  - @labre/affine-shared@0.46.0
  - @labre/affine-components@0.46.0
  - @labre/data-view@0.46.0
  - @labre/affine-inline-preset@0.46.0
  - @labre/affine-inline-reference@0.46.0
  - @labre/affine-rich-text@0.46.0
  - @labre/affine-widget-drag-handle@0.46.0
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
  - @labre/affine-widget-drag-handle@0.45.1
  - @labre/affine-components@0.45.1
  - @labre/data-view@0.45.1
  - @labre/affine-inline-preset@0.45.1
  - @labre/affine-inline-reference@0.45.1
  - @labre/affine-rich-text@0.45.1
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
  - @labre/affine-widget-drag-handle@0.45.0
  - @labre/affine-inline-preset@0.45.0
  - @labre/affine-inline-reference@0.45.0
  - @labre/affine-rich-text@0.45.0
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
- Updated dependencies [b6dc00a]
  - @labre/affine-shared@0.44.0
  - @labre/std@0.44.0
  - @labre/affine-model@0.44.0
  - @labre/affine-components@0.44.0
  - @labre/affine-inline-preset@0.44.0
  - @labre/affine-rich-text@0.44.0
  - @labre/affine-widget-drag-handle@0.44.0
  - @labre/data-view@0.44.0
  - @labre/affine-inline-reference@0.44.0
  - @labre/affine-widget-slash-menu@0.44.0
  - @labre/affine-ext-loader@0.44.0
  - @labre/global@0.44.0
  - @labre/store@0.44.0

## 0.43.1

### Patch Changes

- Updated dependencies [2602909]
  - @labre/affine-shared@0.43.1
  - @labre/affine-model@0.43.1
  - @labre/affine-components@0.43.1
  - @labre/data-view@0.43.1
  - @labre/affine-inline-preset@0.43.1
  - @labre/affine-inline-reference@0.43.1
  - @labre/affine-rich-text@0.43.1
  - @labre/affine-widget-drag-handle@0.43.1
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
  - @labre/data-view@0.43.0
  - @labre/affine-inline-preset@0.43.0
  - @labre/affine-inline-reference@0.43.0
  - @labre/affine-rich-text@0.43.0
  - @labre/affine-widget-drag-handle@0.43.0
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
- Updated dependencies [f5acc9b]
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
  - @labre/affine-inline-preset@0.42.0
  - @labre/affine-components@0.42.0
  - @labre/global@0.42.0
  - @labre/data-view@0.42.0
  - @labre/affine-inline-reference@0.42.0
  - @labre/affine-rich-text@0.42.0
  - @labre/affine-widget-drag-handle@0.42.0
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
  - @labre/affine-widget-drag-handle@0.41.0
  - @labre/affine-widget-slash-menu@0.41.0
  - @labre/std@0.41.0
  - @labre/affine-components@0.41.0
  - @labre/affine-rich-text@0.41.0
  - @labre/affine-inline-preset@0.41.0
  - @labre/affine-inline-reference@0.41.0
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
  - @labre/affine-components@0.40.0
  - @labre/data-view@0.40.0
  - @labre/affine-inline-reference@0.40.0
  - @labre/affine-rich-text@0.40.0
  - @labre/affine-widget-drag-handle@0.40.0
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
  - @labre/affine-widget-drag-handle@0.39.3
  - @labre/data-view@0.39.3
  - @labre/affine-inline-preset@0.39.3
  - @labre/affine-inline-reference@0.39.3
  - @labre/affine-rich-text@0.39.3
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
  - @labre/affine-components@0.39.2
  - @labre/data-view@0.39.2
  - @labre/affine-inline-preset@0.39.2
  - @labre/affine-inline-reference@0.39.2
  - @labre/affine-rich-text@0.39.2
  - @labre/affine-widget-drag-handle@0.39.2
  - @labre/affine-widget-slash-menu@0.39.2
  - @labre/affine-ext-loader@0.39.2
  - @labre/affine-model@0.39.2
  - @labre/global@0.39.2
  - @labre/std@0.39.2
  - @labre/store@0.39.2

## 0.39.1

### Patch Changes

- 186cd6d: Pasting into a database text cell whose inline range cannot be resolved no
  longer swallows the clipboard silently: the cell now lets the default paste
  path act instead of cancelling the event with nothing inserted. The cell's
  clipboard listeners are also removed with the capture flag they were added
  with, so they no longer leak on disconnect. A regression test pins that a
  property of any type added from the Table view shows up in it immediately.
- Updated dependencies [00eab3d]
  - @labre/affine-model@0.39.1
  - @labre/affine-components@0.39.1
  - @labre/affine-inline-preset@0.39.1
  - @labre/affine-inline-reference@0.39.1
  - @labre/affine-rich-text@0.39.1
  - @labre/affine-shared@0.39.1
  - @labre/affine-widget-drag-handle@0.39.1
  - @labre/data-view@0.39.1
  - @labre/affine-widget-slash-menu@0.39.1
  - @labre/affine-ext-loader@0.39.1
  - @labre/global@0.39.1
  - @labre/std@0.39.1
  - @labre/store@0.39.1

## 0.39.0

### Patch Changes

- @labre/affine-components@0.39.0
- @labre/data-view@0.39.0
- @labre/affine-ext-loader@0.39.0
- @labre/affine-inline-preset@0.39.0
- @labre/affine-inline-reference@0.39.0
- @labre/affine-model@0.39.0
- @labre/affine-rich-text@0.39.0
- @labre/affine-shared@0.39.0
- @labre/affine-widget-drag-handle@0.39.0
- @labre/affine-widget-slash-menu@0.39.0
- @labre/global@0.39.0
- @labre/std@0.39.0
- @labre/store@0.39.0

## 0.38.2

### Patch Changes

- Updated dependencies [0ffa45b]
  - @labre/std@0.38.2
  - @labre/affine-components@0.38.2
  - @labre/data-view@0.38.2
  - @labre/affine-inline-preset@0.38.2
  - @labre/affine-inline-reference@0.38.2
  - @labre/affine-model@0.38.2
  - @labre/affine-rich-text@0.38.2
  - @labre/affine-shared@0.38.2
  - @labre/affine-widget-drag-handle@0.38.2
  - @labre/affine-widget-slash-menu@0.38.2
  - @labre/affine-ext-loader@0.38.2
  - @labre/global@0.38.2
  - @labre/store@0.38.2

## 0.38.1

### Patch Changes

- @labre/affine-components@0.38.1
- @labre/data-view@0.38.1
- @labre/affine-ext-loader@0.38.1
- @labre/affine-inline-preset@0.38.1
- @labre/affine-inline-reference@0.38.1
- @labre/affine-model@0.38.1
- @labre/affine-rich-text@0.38.1
- @labre/affine-shared@0.38.1
- @labre/affine-widget-drag-handle@0.38.1
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
  - @labre/affine-widget-drag-handle@0.38.0
  - @labre/affine-components@0.38.0
  - @labre/affine-inline-preset@0.38.0
  - @labre/affine-inline-reference@0.38.0
  - @labre/affine-rich-text@0.38.0
  - @labre/data-view@0.38.0
  - @labre/affine-widget-slash-menu@0.38.0
  - @labre/affine-ext-loader@0.38.0
  - @labre/global@0.38.0
  - @labre/std@0.38.0
  - @labre/store@0.38.0

## 0.37.0

### Patch Changes

- @labre/affine-widget-drag-handle@0.37.0
- @labre/affine-components@0.37.0
- @labre/data-view@0.37.0
- @labre/affine-ext-loader@0.37.0
- @labre/affine-inline-preset@0.37.0
- @labre/affine-inline-reference@0.37.0
- @labre/affine-model@0.37.0
- @labre/affine-rich-text@0.37.0
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
  - @labre/data-view@0.36.0
  - @labre/affine-inline-preset@0.36.0
  - @labre/affine-inline-reference@0.36.0
  - @labre/affine-rich-text@0.36.0
  - @labre/affine-widget-drag-handle@0.36.0
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
  - @labre/data-view@0.35.0
  - @labre/affine-inline-preset@0.35.0
  - @labre/affine-inline-reference@0.35.0
  - @labre/affine-rich-text@0.35.0
  - @labre/affine-widget-drag-handle@0.35.0
  - @labre/affine-widget-slash-menu@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-components@0.34.2
- @labre/data-view@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-inline-preset@0.34.2
- @labre/affine-inline-reference@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-rich-text@0.34.2
- @labre/affine-shared@0.34.2
- @labre/affine-widget-drag-handle@0.34.2
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
  - @labre/affine-components@0.34.1
  - @labre/affine-inline-preset@0.34.1
  - @labre/affine-inline-reference@0.34.1
  - @labre/affine-rich-text@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/affine-widget-drag-handle@0.34.1
  - @labre/data-view@0.34.1
  - @labre/affine-widget-slash-menu@0.34.1
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
  - @labre/affine-components@0.34.0
  - @labre/affine-inline-reference@0.34.0
  - @labre/affine-widget-slash-menu@0.34.0
  - @labre/data-view@0.34.0
  - @labre/affine-inline-preset@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-rich-text@0.34.0
  - @labre/affine-widget-drag-handle@0.34.0
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
  - @labre/affine-widget-drag-handle@0.33.0
  - @labre/data-view@0.33.0
  - @labre/affine-inline-preset@0.33.0
  - @labre/affine-inline-reference@0.33.0
  - @labre/affine-rich-text@0.33.0
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

- acbec17: A link pasted into a database cell no longer swallows the sentence around it

  Pasting into a title or rich-text cell was all-or-nothing: if the whole
  clipboard happened to parse as a URL the entire paste became one link,
  otherwise nothing was linked at all. So `docs:https://example.com` arrived as
  flat text with a dead address in it, and `(https://example.com).` became a link
  that quietly included the closing bracket and the full stop.

  The paste is now read segment by segment: prose stays prose, addresses become
  links, and the punctuation hugging an address stays outside it. A paste that is
  nothing but a single address still resolves to a linked doc when it points at
  one, exactly as before. Title cells also claim the paste before the document
  clipboard sees it, so a paste there can no longer leak into the page.

- 9bf1d3e: Enter on a database title no longer leaves a phantom record behind

  Validating the title of a database with Enter — the one gesture everybody makes
  after typing a name — prepended a row to the table. The user got a title and an
  empty record they never asked for, at the top of their data, and the field kept
  the caret so nothing signalled what had happened.

  Enter now does what it looks like it does: it commits the title and leaves the
  field. Adding a record stays where it belongs, on the "+" affordances of the
  view. An Enter that only confirms an IME composition is still ignored, as
  before.

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
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [50ab9ae]
- Updated dependencies [6264dfc]
- Updated dependencies [c2e1020]
- Updated dependencies [463989f]
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
  - @labre/affine-widget-drag-handle@0.32.0
  - @labre/store@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/data-view@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-inline-preset@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-widget-slash-menu@0.32.0
  - @labre/affine-inline-reference@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/data-view@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-inline-preset@0.31.0
  - @labre/affine-inline-reference@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/affine-widget-drag-handle@0.31.0
  - @labre/affine-widget-slash-menu@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-components@0.30.2
- @labre/data-view@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-inline-preset@0.30.2
- @labre/affine-inline-reference@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-rich-text@0.30.2
- @labre/affine-shared@0.30.2
- @labre/affine-widget-drag-handle@0.30.2
- @labre/affine-widget-slash-menu@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-components@0.30.1
- @labre/data-view@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-inline-preset@0.30.1
- @labre/affine-inline-reference@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-rich-text@0.30.1
- @labre/affine-shared@0.30.1
- @labre/affine-widget-drag-handle@0.30.1
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
  - @labre/affine-components@0.30.0
  - @labre/data-view@0.30.0
  - @labre/affine-inline-preset@0.30.0
  - @labre/affine-inline-reference@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-drag-handle@0.30.0
  - @labre/affine-widget-slash-menu@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-components@0.29.1
- @labre/data-view@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-inline-preset@0.29.1
- @labre/affine-inline-reference@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-rich-text@0.29.1
- @labre/affine-shared@0.29.1
- @labre/affine-widget-drag-handle@0.29.1
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
  - @labre/affine-components@0.29.0
  - @labre/data-view@0.29.0
  - @labre/affine-inline-preset@0.29.0
  - @labre/affine-inline-reference@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-widget-drag-handle@0.29.0
  - @labre/affine-widget-slash-menu@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

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

- Updated dependencies [1cd6c92]
- Updated dependencies [65cc055]
  - @labre/data-view@0.28.0
  - @labre/std@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-inline-preset@0.28.0
  - @labre/affine-inline-reference@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-drag-handle@0.28.0
  - @labre/affine-widget-slash-menu@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- 14ef3e7: feat(database): export databaseBlockViews (view metas) for external DataSources

  An external `DataSource` (the seam from #18) must populate `viewMetas` with the
  table + kanban `ViewMeta`, exactly as the inline `DatabaseBlockDataSource` does
  via `viewMetas = databaseBlockViews`. Those metas were defined in `./views` but
  not re-exported from the package index, so host apps couldn't reach them.

  Re-export `./views` from the package surface — `databaseBlockViews`,
  `databaseBlockViewMap`, `databaseBlockViewConverts` are now importable. No
  behavior change to the inline block.

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/data-view@0.27.0
  - @labre/affine-inline-preset@0.27.0
  - @labre/affine-inline-reference@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-drag-handle@0.27.0
  - @labre/affine-widget-slash-menu@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

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
