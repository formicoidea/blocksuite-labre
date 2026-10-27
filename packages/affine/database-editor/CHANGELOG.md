# @labre/affine-database-editor

## 0.60.0

### Patch Changes

- @labre/affine-block-database@0.60.0
- @labre/affine-components@0.60.0
- @labre/data-view@0.60.0
- @labre/affine-ext-loader@0.60.0
- @labre/affine-shared@0.60.0
- @labre/affine-widget-slash-menu@0.60.0
- @labre/global@0.60.0
- @labre/std@0.60.0
- @labre/store@0.60.0

## 0.59.0

### Minor Changes

- 8c10a71: The full-page database draws the host's page title: `<affine-database-page>` gains `heading` (an element, typically `<doc-title>` with its `bodyBlockId`) and renders it first in its own viewport, which is now the page's only scroller, so a long table no longer shows a second scrollbar inside the page. On that page the title sits on the view bar (no bottom padding under the title, no top margin or padding on the block), and a table view scrolls with the page in both directions: its column header sticks natively to the top (it no longer jumps while scrolling) and the title and the view bar stay in view sideways. The table's wrapper and scroller gain the stable classes `dv-table-wrapper` and `dv-table-scroll-container`, and the column header no longer offsets itself by script when a host makes it sticky. Without `heading`, the page renders as before; a host that wrapped the page in its own viewport should pass its title as `heading` instead.

### Patch Changes

- Updated dependencies [8c10a71]
  - @labre/data-view@0.59.0
  - @labre/affine-block-database@0.59.0
  - @labre/affine-components@0.59.0
  - @labre/affine-ext-loader@0.59.0
  - @labre/affine-shared@0.59.0
  - @labre/affine-widget-slash-menu@0.59.0
  - @labre/global@0.59.0
  - @labre/std@0.59.0
  - @labre/store@0.59.0

## 0.58.0

### Patch Changes

- @labre/affine-block-database@0.57.0
- @labre/affine-components@0.57.0
- @labre/data-view@0.57.0
- @labre/affine-ext-loader@0.57.0
- @labre/affine-shared@0.57.0
- @labre/affine-widget-slash-menu@0.57.0
- @labre/global@0.57.0
- @labre/std@0.57.0
- @labre/store@0.57.0

## 0.56.0

### Patch Changes

- Updated dependencies [4b760e7]
  - @labre/store@0.56.0
  - @labre/affine-block-database@0.56.0
  - @labre/affine-components@0.56.0
  - @labre/data-view@0.56.0
  - @labre/affine-ext-loader@0.56.0
  - @labre/affine-shared@0.56.0
  - @labre/affine-widget-slash-menu@0.56.0
  - @labre/std@0.56.0
  - @labre/global@0.56.0

## 0.55.0

### Patch Changes

- Updated dependencies [c213d34]
  - @labre/data-view@0.55.0
  - @labre/affine-block-database@0.55.0
  - @labre/affine-components@0.55.0
  - @labre/affine-ext-loader@0.55.0
  - @labre/affine-shared@0.55.0
  - @labre/affine-widget-slash-menu@0.55.0
  - @labre/global@0.55.0
  - @labre/std@0.55.0
  - @labre/store@0.55.0

## 0.54.0

### Patch Changes

- 5d40ad2: A base's "View settings" and "Property settings" sheets on a phone now speak the host's catalogue: every entry goes through a `com.labre.*` key, and "Done" (`com.labre.context-menu.done`) is translated on the sheet and on any sub-sheet it opens. A phone's sheet hangs from the body, out of the editor's DOM; its modal now provides the editor of the element it opens from (`PopupTarget.element`, optional, set by `popupTargetFromElement`). The view settings' "Layout" shows the preset's translated name, and the phone's column header reads the same property menu as the desktop's (`propertyMenuItems`).

  Reused keys: `com.labre.database.view-menu.layout` and `.group` (now declared by `@labre/data-view`, restated by the database editor), `com.labre.selection-pane.filter`, `com.labre.database.properties-panel.title`, `com.labre.data-view.views-bar.view-name`, `.move-left`, `.move-right`, `com.labre.toolbar.duplicate`, `.delete`. New keys: `com.labre.data-view.view-settings`, `.sort`, `.sort.count`, `.filter.count`, `.properties.shown`, `.property.settings`, `.property.name`, `.property.type-entry`, `.property.insert-left`, `.property.insert-right`. A sheet's "Done" is no longer cut to its first letters by a longer translation ("Terminé"): it takes the width it needs and the title stays centred. "Insert Left Column", "Insert Right Column", "Move Left" and "Move Right" read in sentence case on the phone.

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
  - @labre/global@0.52.0
  - @labre/std@0.52.0
  - @labre/store@0.52.0

## 0.51.0

### Patch Changes

- Updated dependencies [e043634]
- Updated dependencies [e043634]
- Updated dependencies [e043634]
- Updated dependencies [e043634]
  - @labre/affine-shared@0.51.0
  - @labre/affine-block-database@0.51.0
  - @labre/affine-components@0.51.0
  - @labre/data-view@0.51.0
  - @labre/affine-widget-slash-menu@0.51.0
  - @labre/affine-ext-loader@0.51.0
  - @labre/global@0.51.0
  - @labre/std@0.51.0
  - @labre/store@0.51.0

## 0.50.0

### Minor Changes

- f3582d9: A database view can colour its rows and cards by a condition on their properties (conditional colours, ADR 0036).

  - `ViewBasicDataType` gains `colorRules?: DatabaseViewColorRule[]` (`{ id, color, filter }`, new exported types `DatabaseViewColorRule` and `DatabaseViewColorRuleFilter`). Optional and never written until a gesture adds a rule: no migration, a 0.49 client ignores and keeps it. The first rule that matches a row wins; `filter` is a view filter's own group shape, `color` a colour of the select options' palette.
  - Every table row, board card, gallery card and list row paints its rule's colour as a light background, in core, whatever the flags or bundles. Only a palette colour is painted; an unknown one paints nothing.
  - The view settings gain "Conditional colors", the rule editor made of the view filter's editor and the options' colour picker; the full page's "This view" lists it as the `'view-menu'` command `database.view.color-rules`.
  - A view template keeps the rules. `remapView` rewrites them through the property mapping, removes a rule that reads an ignored property, and counts it in the new `RemapDropped.colorRules`, for an import dialog to say so.
  - `evalFilter(filter, row, undecided?)` gains an optional third argument (default `true`, the previous behaviour). `selectOptionColorActions` is the select options' colour picker as menu entries. Seven new keys under `com.labre.data-view.color-rules`.

- f3582d9: A view's « Properties » list manages the properties, as in Notion, wherever it is drawn: the view options' "Properties" and the database's side panel (`affine-database-properties-panel`), for every view type, kanban, gallery and list included. A click on a row (not its eye, not its drag bar) opens the property's menu, the very one the table's column header opens: rename, type, hide in view, duplicate, delete. A last row « New property » adds one at the end of the source through the type picker, then opens its menu for the rename. Rename, type, duplicate, delete and add write the data source, so every view sees them; hiding and reordering stay per view. Read-only, the rows open nothing and « New property » is not drawn; the title keeps the header's rules (no type change, no hide, no delete). The menu is now one core builder, `propertyMenuItems(property, slots?)` / `popPropertyMenu(target, property, slots?)` in `data-view/src/core/common/property-menu.ts`, which the table header opens with its own entries (number format, filter, sort, insert, move) as slots; the header's menu is unchanged. `data-view-properties-setting` takes an optional `wording` (English without it), as do `popPropertiesSetting`, `typeConfig` and the menu builder; the table header resolves it from the editor. The menu's "Hide In View", "Duplicate" and "Delete", the "Property type" title and the popover's "Properties" now cross the translation seam ("Duplicate" and "Delete" reuse `com.labre.toolbar.{duplicate,delete}`; "Properties" reuses `com.labre.database.properties-panel.title`, now declared by `@labre/data-view` as `DATA_VIEW_PROPERTIES`, `PROPERTIES_PANEL_TITLE` being that wording). Nothing stored changes. New keys (FR in the host): `com.labre.data-view.properties.new`, `com.labre.data-view.property.{type,hide-in-view}`.

### Patch Changes

- Updated dependencies [f3582d9]
- Updated dependencies [f3582d9]
- Updated dependencies [f3582d9]
- Updated dependencies [f3582d9]
  - @labre/data-view@0.50.0
  - @labre/affine-components@0.50.0
  - @labre/affine-shared@0.50.0
  - @labre/affine-block-database@0.50.0
  - @labre/affine-widget-slash-menu@0.50.0
  - @labre/affine-ext-loader@0.50.0
  - @labre/global@0.50.0
  - @labre/std@0.50.0
  - @labre/store@0.50.0

## 0.49.0

### Minor Changes

- 651ffab: New bundle `@formicoidea/labre-core-database`, built from the new package `@labre/affine-database-editor` (ADR 0035 §4). It will hold the database editing chrome (the view bar, the full-page database, the creation entries); in this release its two extensions are registered but empty, so a host can wire them now: `DatabaseEditorViewExtension` always, `DatabaseEditorToolingViewExtension` under the `database` flag, both listed in `coreDatabaseBundle.extensions` from its `./descriptor`. The bundle depends on the exact `@formicoidea/labre-core` version and nothing else; core never imports it, and keeps rendering and editing every stored database without it. The `database` flag stays in core's `flags.ts`. `@labre/affine/frameworks` gains the data-only list `EDITOR_BUNDLES`; the umbrella registers both extensions, so the playground and the integration suite run them. Every other published bundle is unchanged.
- 651ffab: The tag menu, the date picker and new views' names speak the host's catalogue (ADR 0023). The tag menu of select and multi-select cells (the inline table, the bases, the chips band) keys its placeholder, tip, "Create", "Delete" and colour names; the date picker keys "Today", "Clear" and its arrows, and draws its day and month names with `Intl` in the editor's locale (`en-US` by default, which reads as before). A cell resolves these while it is in the editor and hands them to the popup (`BaseCellRenderer.wording`, `TagManagerOptions.wording`, `DatePicker.wording` and `DatePicker.locale`, all optional). A new view is named in the author's language at the gesture: each preset declares `defaultNameKey` beside its unchanged English `defaultName`, `viewDefaultName(meta, std)` resolves it, and `ViewManager.viewAdd(type, name?)`, `databaseViewInitTemplate(…, std?)` and `initDatabaseBlock(…, std?)` write the resolved name; the views bar's `addView`, which `AddViewMenuContext` hands the bundle, resolves it for "on an existing source" and "with a new source" too, and the bundle's preset entries show the resolved name; the table's group fold button keys "Expand group" / "Collapse group" (`com.labre.data-view.group.{expand,collapse}`); without an editor the English seed is written, as in 0.48, and a stored name is never re-translated. `SelectOptionColor` gains an optional `wording`. New keys (FR in the host): `com.labre.data-view.view.default-name.{table,kanban,calendar,gallery,list}`, `com.labre.data-view.tag.{placeholder,tip,create,color.teal}`, `com.labre.date-picker.{today,clear,previous-month,next-month}`; the colours reuse `com.labre.palette-name.*` and "Delete" `com.labre.toolbar.delete`.
- 651ffab: Three database seams and option edits from the title band (ADR 0035 §9a to §9c, issues B9, B10, B12). `DatabaseOpenRowExtension({ open })` (`@labre/affine/blocks/database`) receives every row a view opens when the source's rows are documents, with the view's stored `openIn` as `mode` (`side` when absent) and `newTab` for a Ctrl/Cmd click; without it, rows open in the detail panel as before. The view options' "Properties" asks `PropertiesPanelExtension` with `scope: 'source'`, and the bundle's `affine-database-properties-panel` element draws the view's properties list for the host to mount where it wants; without the seam, the popover stays. `DataSourcePickerExtension({ list, createDatabase?, createSource? })` (`@labre/affine/shared/services`) adds a "Linked view of a database" slash entry that inserts a view of an existing source (`popDataSourcePicker` in `@labre/core-database/view`); registered without `createDatabase`, "Table View" and "Kanban View" leave the slash menu, with it they ask the host for a new database. `TitleBandService.setData?` and `TitleBandProperty.dataWritable?` let a select chip create and rename options. New keys: `com.labre.database.properties-panel.{title,show-all,hide-all,unavailable}`, `com.labre.database.picker.{title,new-source,new-database,empty}`, `com.labre.database.slash.linked-view` and `.linked-view.description`. Nothing is written on load.
- 651ffab: The full page of a database lists its view settings for a host's menu, and a view can be imported from another database (ADR 0035, amendment of 2026-10-14; labre PRD REQ-DB-2, DB-4, DB-10). **"This view":** `<affine-database-page>` registers six `'view-menu'` commands (`database.view.layout`, `.group`, `.open-in`, `.properties`, `.save-template`, `.import`), so `getViewActions(std, 'page')` lists them and `runViewAction` runs them, on the full page only; a setting opens the very menu of the view settings entry (`openSetting(key)` of the view's options button, `popViewSetting` in `@labre/data-view`), listed where the view offers it and never on a read-only page. New keys `com.labre.database.view-menu.{layout,group,save-template,import}` ("Layout", "Group", "Save as template", "Import a view…"); "Open pages in" and "Properties" reuse `com.labre.data-view.open-in` and `com.labre.database.properties-panel.title`. **Import and templates, through the picker:** `DataSourcePickerService` gains two optional verbs, `importView(request)` (the host picks a view and maps its properties, then calls `request.add({ view, properties, mapping })`, which copies it as a new view on the current view's source, one undo step) and `saveViewTemplate(template)` (the current view without its filters, sorts and manual orders). "+ view" adds "Import a view from another database" (`com.labre.database.add-view.import`) when the picker imports. `remapView`, `defaultMapping` and `viewTemplateData` (pure, `@labre/core-database`) preview the copy for the host's dialog. `DatabaseViewAdded.source` gains `import`. No stored field changes.
- 651ffab: The database view bar behaves like Notion's and a database can be shown as a full page (ADR 0035 B11, B13).

  - **View bar (core).** As many tabs as the width allows, the rest under "N more" (`com.labre.data-view.views-bar.more`, `{{count}}`), which lists the views without a tab. The current view always keeps its tab, in place of the last one that would have fitted. "+" is always drawn after the tabs (no longer only when every tab fits) and is the bar's only creation entry: "N more" no longer offers "Create …". On a phone the tabs, "N more" and "+" are 44px tall. The tab menu's wordings are keys now (`com.labre.data-view.views-bar.view-name`, `.edit-view`, `.move-left`, `.move-right`, `.add-view`). `component-overflow` takes a `pinned` item and passes the hidden indices to `renderMore` as a second argument. New registry `AddViewMenuExtension` / `AddViewMenuIdentifier`, filled by the bundle, never by a host: absent, "+" lists the creatable presets as before.
  - **Hosted sources.** `HostedDataSourceBase` gains `resolvesSources` and `sourceOf(sourceId)`, read-only.
  - **`@labre/core-database`.** `DatabaseEditorToolingViewExtension` gives "+" its source entries on a source that resolves sources: "On an existing source" (each source the views read, and the sources of its database that the host's `DataSourcePickerExtension` lists with no view yet) and "With a new source" when that picker has `createSource`; a view added on a source stores its `sourceId`, and its default data is derived from that source. `DatabaseEditorViewExtension` defines `<affine-database-page .store .extensions .hostBlockId>` (`DatabasePageHost`): it builds a page editor on the database document that draws the views' block alone, without its title row or the page root's chrome; the schema blocks and the note can be neither selected, deleted, moved nor inserted into, and nothing is written. New keys: `com.labre.database.add-view.existing-source`, `.new-source`, `.untitled-source`, `com.labre.database.page.host-missing`.

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
  - @labre/data-view@0.49.0
  - @labre/affine-components@0.49.0
  - @labre/affine-block-database@0.49.0
  - @labre/affine-shared@0.49.0
  - @labre/affine-widget-slash-menu@0.49.0
  - @labre/affine-ext-loader@0.49.0
  - @labre/global@0.49.0
  - @labre/std@0.49.0
  - @labre/store@0.49.0
