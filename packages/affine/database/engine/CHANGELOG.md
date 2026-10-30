# @labre/data-view

## 2.3.3

### Patch Changes

- @labre/affine-components@2.3.3
- @labre/affine-model@2.3.3
- @labre/affine-shared@2.3.3
- @labre/global@2.3.3
- @labre/std@2.3.3
- @labre/store@2.3.3

## 2.3.2

### Patch Changes

- @labre/affine-components@2.3.2
- @labre/affine-model@2.3.2
- @labre/affine-shared@2.3.2
- @labre/global@2.3.2
- @labre/std@2.3.2
- @labre/store@2.3.2

## 2.3.1

### Patch Changes

- @labre/affine-components@2.3.1
- @labre/affine-model@2.3.1
- @labre/affine-shared@2.3.1
- @labre/global@2.3.1
- @labre/std@2.3.1
- @labre/store@2.3.1

## 2.3.0

### Patch Changes

- @labre/affine-components@2.3.0
- @labre/affine-model@2.3.0
- @labre/affine-shared@2.3.0
- @labre/global@2.3.0
- @labre/std@2.3.0
- @labre/store@2.3.0

## 2.2.1

### Patch Changes

- @labre/affine-components@2.2.1
- @labre/affine-model@2.2.1
- @labre/affine-shared@2.2.1
- @labre/global@2.2.1
- @labre/std@2.2.1
- @labre/store@2.2.1

## 2.2.0

### Patch Changes

- @labre/affine-components@2.2.0
- @labre/affine-model@2.2.0
- @labre/affine-shared@2.2.0
- @labre/global@2.2.0
- @labre/std@2.2.0
- @labre/store@2.2.0

## 2.1.3

### Patch Changes

- @labre/affine-components@2.1.3
- @labre/affine-model@2.1.3
- @labre/affine-shared@2.1.3
- @labre/global@2.1.3
- @labre/std@2.1.3
- @labre/store@2.1.3

## 2.1.2

### Patch Changes

- @labre/affine-components@2.1.2
- @labre/affine-model@2.1.2
- @labre/affine-shared@2.1.2
- @labre/global@2.1.2
- @labre/std@2.1.2
- @labre/store@2.1.2

## 2.1.1

### Patch Changes

- @labre/affine-components@2.1.1
- @labre/affine-model@2.1.1
- @labre/affine-shared@2.1.1
- @labre/global@2.1.1
- @labre/std@2.1.1
- @labre/store@2.1.1

## 2.1.0

### Patch Changes

- @labre/affine-components@2.1.0
- @labre/affine-model@2.1.0
- @labre/affine-shared@2.1.0
- @labre/global@2.1.0
- @labre/std@2.1.0
- @labre/store@2.1.0

## 2.0.1

### Patch Changes

- @labre/affine-components@2.0.1
- @labre/affine-model@2.0.1
- @labre/affine-shared@2.0.1
- @labre/global@2.0.1
- @labre/std@2.0.1
- @labre/store@2.0.1

## 2.0.0

### Patch Changes

- @labre/affine-components@2.0.0
- @labre/affine-model@2.0.0
- @labre/affine-shared@2.0.0
- @labre/global@2.0.0
- @labre/std@2.0.0
- @labre/store@2.0.0

## 1.1.0

### Patch Changes

- @labre/affine-components@1.1.0
- @labre/affine-model@1.1.0
- @labre/affine-shared@1.1.0
- @labre/global@1.1.0
- @labre/std@1.1.0
- @labre/store@1.1.0

## 1.0.0

### Patch Changes

- @labre/affine-components@1.0.0
- @labre/affine-model@1.0.0
- @labre/affine-shared@1.0.0
- @labre/global@1.0.0
- @labre/std@1.0.0
- @labre/store@1.0.0

## 0.61.0

### Patch Changes

- @labre/affine-components@0.61.0
- @labre/affine-model@0.61.0
- @labre/affine-shared@0.61.0
- @labre/global@0.61.0
- @labre/std@0.61.0
- @labre/store@0.61.0

## 0.60.0

### Patch Changes

- @labre/affine-components@0.60.0
- @labre/affine-model@0.60.0
- @labre/affine-shared@0.60.0
- @labre/global@0.60.0
- @labre/std@0.60.0
- @labre/store@0.60.0

## 0.59.0

### Patch Changes

- 8c10a71: The full-page database draws the host's page title: `<affine-database-page>` gains `heading` (an element, typically `<doc-title>` with its `bodyBlockId`) and renders it first in its own viewport, which is now the page's only scroller, so a long table no longer shows a second scrollbar inside the page. On that page the title sits on the view bar (no bottom padding under the title, no top margin or padding on the block), and a table view scrolls with the page in both directions: its column header sticks natively to the top (it no longer jumps while scrolling) and the title and the view bar stay in view sideways. The table's wrapper and scroller gain the stable classes `dv-table-wrapper` and `dv-table-scroll-container`, and the column header no longer offsets itself by script when a host makes it sticky. Without `heading`, the page renders as before; a host that wrapped the page in its own viewport should pass its title as `heading` instead.
  - @labre/affine-components@0.59.0
  - @labre/affine-model@0.59.0
  - @labre/affine-shared@0.59.0
  - @labre/global@0.59.0
  - @labre/std@0.59.0
  - @labre/store@0.59.0

## 0.58.0

### Patch Changes

- @labre/affine-components@0.57.0
- @labre/affine-model@0.57.0
- @labre/affine-shared@0.57.0
- @labre/global@0.57.0
- @labre/std@0.57.0
- @labre/store@0.57.0

## 0.56.0

### Patch Changes

- Updated dependencies [4b760e7]
  - @labre/store@0.56.0
  - @labre/affine-components@0.56.0
  - @labre/affine-model@0.56.0
  - @labre/affine-shared@0.56.0
  - @labre/std@0.56.0
  - @labre/global@0.56.0

## 0.55.0

### Minor Changes

- c213d34: Edit a base on a phone, after Notion's phone table. A tap on a table cell now edits it: up to 0.54 every tap threw before the cell could enter editing (the mobile table and kanban cells called the view logic's `setSelection` detached). Select, multi-select and date values are edited in the bottom sheet. The title column carries an "Open" chip (`com.labre.open-doc.open`, `data-testid="dv-row-open"`, also on the desktop row's open button) that opens the row through the root's detail panel, where the two floating ops used to cover the title; the row menu (Open, Delete) moved to a long press on the row. Filter and sort show in a phone's toolbar, 44px, their menus as sheets; the filter and sort bar follows the same rule as on a desktop instead of standing empty under every phone table. The toolbar's add button is a blue "+" on a phone (labelled `com.labre.data-view.new-page`), the footer row reads "+ New page" at 44px, and both open the row they add, as the desktop table does; the phone board's "+" does too. The header's "+" opens the "Property settings" sheet of the property it adds (it opened the previous last one) and is 44px. A tap on a kanban card, a gallery card or a list row opens the row on a phone instead of editing the value under the finger. Removed: `DATA_VIEW_NEW_RECORD_SHORT` (`com.labre.data-view.new-record.short`) from `@labre/data-view/translations`, now unused; the phone's "+" is labelled by `DATA_VIEW_NEW_PAGE`. No new key, no new seam, no stored format change.

### Patch Changes

- @labre/affine-components@0.55.0
- @labre/affine-model@0.55.0
- @labre/affine-shared@0.55.0
- @labre/global@0.55.0
- @labre/std@0.55.0
- @labre/store@0.55.0

## 0.54.0

### Patch Changes

- 5d40ad2: Dark canvas for the notations (ADR 0039). With `data-theme="dark"` the framework boards are no longer white cards: the paper and the inks drawn on it resolve at paint time through `NOTATION_NEUTRALS_DARK` and each framework's `NotationDarkPaletteExtension`, while the hues of every standard (EDGY's facets, the C4 ladder) stay as drawn. Nothing stored changes, a colour typed by hand is painted as stored, and the SVG export always paints light. New exports: `NOTATION_NEUTRALS_DARK` (`@labre/affine-shared/consts`), `NotationTint`, `notationColor`, `NotationDarkPaletteExtension` and `CanvasRenderer.withColorScheme` / `getInkColorValue` (`@labre/affine-block-surface`). The chrome's last hard-coded light colours (data-view drag bars, colour picker caption, menu input focus ring, scrollbar thumb, `@` menu mask, auto-connect navigator, auto-complete arrows, keyboard toolbar pressed state) now go through theme tokens.
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
  - @labre/affine-model@0.54.0
  - @labre/global@0.54.0
  - @labre/std@0.54.0
  - @labre/store@0.54.0

## 0.53.0

### Patch Changes

- Updated dependencies [3d9e204]
  - @labre/affine-shared@0.53.0
  - @labre/affine-components@0.53.0
  - @labre/affine-model@0.53.0
  - @labre/global@0.53.0
  - @labre/std@0.53.0
  - @labre/store@0.53.0

## 0.52.0

### Patch Changes

- Updated dependencies [2124f31]
  - @labre/affine-shared@0.52.0
  - @labre/affine-components@0.52.0
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
  - @labre/affine-shared@0.51.0
  - @labre/affine-model@0.51.0
  - @labre/affine-components@0.51.0
  - @labre/global@0.51.0
  - @labre/std@0.51.0
  - @labre/store@0.51.0

## 0.50.0

### Minor Changes

- f3582d9: The database colour grid (a select option's colour, a conditional colour rule's, the kanban group header's) now pages like the canvas colour picker: the ten chip colours stay on the first page, then one page per framework whose tooling is on, its colours softened into chip colours that read in light and dark (ADR 0036 amendment of 2026-10-14, "framework pages"). A framework switched off offers no page; a colour picked from it keeps painting.

  - A softened colour is stored as one string, `color-mix(in srgb, #rrggbb NN%, var(--affine-v2-layer-background-primary))`: 30% of the framework colour, or, for a colour that is already pastel, the share that keeps its light look exactly. Every swatch carries primary text above WCAG AA in both themes (8.8:1 light, 5.4:1 dark at worst). A host theme must keep the `--affine-v2-layer-background-primary` name defined in both schemes (the Labre theme's `--affine-*` aliases do).
  - A conditional colour rule now paints such a value too, through a strict check of that exact shape (`isSoftenedChipColor`); any other unknown value is still refused. Picking a first-page colour writes exactly what it wrote before.
  - New exports from `@labre/data-view`: `softenedChipColor`, `isSoftenedChipColor`, `SOFTENED_BACKGROUND_TOKEN`, `SOFTENED_SHARE`, `PASTEL_MAX_SHARE`, `softenedFrameworkPalettes`, `selectOptionColorPages`, `DataViewColorCarousel` (`<dv-color-carousel>`, registered by `coreEffects`); `selectOptionColorGrid` and `TagSelectOptions` take an optional `std`. From `@labre/affine-components/color-picker`: `contributedFrameworkPalettes(std)`.
  - Every framework palette (`FrameworkPaletteExtension`) now registers in the page scope as well as the edgeless one, still from the flag-gated view extension.

- f3582d9: A database view can colour its rows and cards by a condition on their properties (conditional colours, ADR 0036).

  - `ViewBasicDataType` gains `colorRules?: DatabaseViewColorRule[]` (`{ id, color, filter }`, new exported types `DatabaseViewColorRule` and `DatabaseViewColorRuleFilter`). Optional and never written until a gesture adds a rule: no migration, a 0.49 client ignores and keeps it. The first rule that matches a row wins; `filter` is a view filter's own group shape, `color` a colour of the select options' palette.
  - Every table row, board card, gallery card and list row paints its rule's colour as a light background, in core, whatever the flags or bundles. Only a palette colour is painted; an unknown one paints nothing.
  - The view settings gain "Conditional colors", the rule editor made of the view filter's editor and the options' colour picker; the full page's "This view" lists it as the `'view-menu'` command `database.view.color-rules`.
  - A view template keeps the rules. `remapView` rewrites them through the property mapping, removes a rule that reads an ignored property, and counts it in the new `RemapDropped.colorRules`, for an import dialog to say so.
  - `evalFilter(filter, row, undecided?)` gains an optional third argument (default `true`, the previous behaviour). `selectOptionColorActions` is the select options' colour picker as menu entries. Seven new keys under `com.labre.data-view.color-rules`.

- f3582d9: A view's « Properties » list manages the properties, as in Notion, wherever it is drawn: the view options' "Properties" and the database's side panel (`affine-database-properties-panel`), for every view type, kanban, gallery and list included. A click on a row (not its eye, not its drag bar) opens the property's menu, the very one the table's column header opens: rename, type, hide in view, duplicate, delete. A last row « New property » adds one at the end of the source through the type picker, then opens its menu for the rename. Rename, type, duplicate, delete and add write the data source, so every view sees them; hiding and reordering stay per view. Read-only, the rows open nothing and « New property » is not drawn; the title keeps the header's rules (no type change, no hide, no delete). The menu is now one core builder, `propertyMenuItems(property, slots?)` / `popPropertyMenu(target, property, slots?)` in `data-view/src/core/common/property-menu.ts`, which the table header opens with its own entries (number format, filter, sort, insert, move) as slots; the header's menu is unchanged. `data-view-properties-setting` takes an optional `wording` (English without it), as do `popPropertiesSetting`, `typeConfig` and the menu builder; the table header resolves it from the editor. The menu's "Hide In View", "Duplicate" and "Delete", the "Property type" title and the popover's "Properties" now cross the translation seam ("Duplicate" and "Delete" reuse `com.labre.toolbar.{duplicate,delete}`; "Properties" reuses `com.labre.database.properties-panel.title`, now declared by `@labre/data-view` as `DATA_VIEW_PROPERTIES`, `PROPERTIES_PANEL_TITLE` being that wording). Nothing stored changes. New keys (FR in the host): `com.labre.data-view.properties.new`, `com.labre.data-view.property.{type,hide-in-view}`.

### Patch Changes

- f3582d9: A select option's colour and a conditional colour rule's are now picked from the canvas colour grid (`<edgeless-color-panel>`) instead of a list of ten menu rows, in the option menu, the rule menu and the kanban group header: the same ten chip colours, each named in the host's language, the current one ringed. The value written is unchanged, the same `selectOptionColors` string as before (ADR 0036 amendment of 2026-10-14).

  - `selectOptionColorGrid` (the grid as one menu entry) and `selectOptionColorPalettes` replace `selectOptionColorActions`, introduced in the same release.
  - Every colour panel, the canvas's included, is keyboard-operable: one Tab stop, the arrow keys move between swatches, Enter or Space picks, a focused swatch shows a focus ring. A swatch shows its colour name as a tooltip. Pointer picking is unchanged.
  - A colour panel swatch also paints through an inline `fill` style, so a CSS variable colour string paints in every engine; a plain colour paints as before.

- Updated dependencies [f3582d9]
- Updated dependencies [f3582d9]
- Updated dependencies [f3582d9]
  - @labre/affine-components@0.50.0
  - @labre/affine-model@0.50.0
  - @labre/affine-shared@0.50.0
  - @labre/global@0.50.0
  - @labre/std@0.50.0
  - @labre/store@0.50.0

## 0.49.0

### Minor Changes

- 651ffab: The tag menu, the date picker and new views' names speak the host's catalogue (ADR 0023). The tag menu of select and multi-select cells (the inline table, the bases, the chips band) keys its placeholder, tip, "Create", "Delete" and colour names; the date picker keys "Today", "Clear" and its arrows, and draws its day and month names with `Intl` in the editor's locale (`en-US` by default, which reads as before). A cell resolves these while it is in the editor and hands them to the popup (`BaseCellRenderer.wording`, `TagManagerOptions.wording`, `DatePicker.wording` and `DatePicker.locale`, all optional). A new view is named in the author's language at the gesture: each preset declares `defaultNameKey` beside its unchanged English `defaultName`, `viewDefaultName(meta, std)` resolves it, and `ViewManager.viewAdd(type, name?)`, `databaseViewInitTemplate(…, std?)` and `initDatabaseBlock(…, std?)` write the resolved name; the views bar's `addView`, which `AddViewMenuContext` hands the bundle, resolves it for "on an existing source" and "with a new source" too, and the bundle's preset entries show the resolved name; the table's group fold button keys "Expand group" / "Collapse group" (`com.labre.data-view.group.{expand,collapse}`); without an editor the English seed is written, as in 0.48, and a stored name is never re-translated. `SelectOptionColor` gains an optional `wording`. New keys (FR in the host): `com.labre.data-view.view.default-name.{table,kanban,calendar,gallery,list}`, `com.labre.data-view.tag.{placeholder,tip,create,color.teal}`, `com.labre.date-picker.{today,clear,previous-month,next-month}`; the colours reuse `com.labre.palette-name.*` and "Delete" `com.labre.toolbar.delete`.
- 651ffab: Two new database views, Gallery and List (ADR 0035 §1, issues B6 and B7), stored under the modes `gallery` and `list`. A gallery draws one card per row, its title then its visible properties; a list draws one line per row, the title on the left and the visible properties as chips on the right (an empty value draws no chip; on a narrow screen the chips wrap under the title). Both are the table transposed, not a new drawing: every value is drawn and edited by the cell renderer a table cell mounts, with the table's tag menu, date picker and inputs, and while a value edits the rows hold still as in a table. Per-view visibility is stored as table and kanban store it, `columns[].hide`, and the view's Properties popover hides, shows and reorders; filter, sort and search are the engine's. "New page" adds a row at the end and opens it; a click on a card or a row outside its values, or on its open button, opens the row through the detail panel, as the table and kanban open buttons do. A new gallery or list shows the title only, as in Notion; switching a table, a board or a calendar to a gallery or a list (and back to a table or a board) keeps the filter and the sort. One UI serves desktop and mobile (44px rows on a touch screen); editing on mobile follows the block's read-only state. A card has no cover image yet. Nothing is written when a stored gallery or list view is drawn. A value a hosted source has not delivered yet draws the table's skeleton and cannot be edited over; a source whose rows are documents titles its cards and rows through `titleOf`, as its table does.

  The database block registers both presets and gives them the table's toolbar (filter, sort, search, view options, New). New key `com.labre.data-view.new-page` ("New page", `@labre/data-view/translations`); the open button reuses `com.labre.open-doc.open`. `<dv-standalone-cell>` gains an optional `onEditingChange(editing)` callback, told when its editor opens and closes.

  A host older than this version meeting a stored `gallery` or `list` view takes its unknown-view path (ADR 0035 §6).

- 651ffab: Grouping on every database layout, hidden and folded groups, and "Open pages in" (ADR 0035 §8, issue B8; no new stored field).

  Gallery and List now group like Table and Board, from the same stored `groupBy` and `groupProperties`: View settings → Group picks the property, each group is drawn under the table's group header (name, count, "+" adding a page into the group, a menu), and switching a layout into a gallery or a list keeps the grouping. In every layout a group can be hidden for everyone ("Hide group" in its menu, or its eye in the Group settings), which writes the existing `groupProperties[].hide`; hidden groups are listed at the end of the view, each with "Show group" (no button on a read-only view). A group can also be folded: a personal state kept in `localStorage` on this device, never in the document; a Board column folds to its header. The table's fold moves from `sessionStorage` to that store, so a fold made before this version is not restored once.

  View settings gain "Open pages in" (side peek, center peek, full page) when the source's rows are documents (`rowsAreDocuments`): it writes the view's optional `openIn` on the pick, never when the pick changes nothing and never on load; absent reads side peek. New exports in `@labre/data-view`: `viewOpenIn`, `viewOpenInSet`, `rowsArePages`, `DEFAULT_OPEN_IN`; `GroupTrait` gains `visibleGroups# @labre/data-view, `hiddenGroups# @labre/data-view, `groupsCanHide`, `groupHideSet`, `collapsed# @labre/data-view and `collapsedSet`, and its ops two optional members, `groupHidden`and`groupHideSet`. `popViewOptions`and`popGroupSetting` take an optional wording resolver as their last argument.

  New keys, English fallbacks in `@labre/data-view/translations`: `com.labre.data-view.group.hide` ("Hide group"), `.group.show` ("Show group"), `.group.hidden` ("Hidden groups"), `.group.collapse` ("Collapse group"), `.group.expand` ("Expand group"), `com.labre.data-view.open-in` ("Open pages in"), `.open-in.side` ("Side peek"), `.open-in.center` ("Center peek"), `.open-in.full` ("Full page").

- 651ffab: Three database seams and option edits from the title band (ADR 0035 §9a to §9c, issues B9, B10, B12). `DatabaseOpenRowExtension({ open })` (`@labre/affine/blocks/database`) receives every row a view opens when the source's rows are documents, with the view's stored `openIn` as `mode` (`side` when absent) and `newTab` for a Ctrl/Cmd click; without it, rows open in the detail panel as before. The view options' "Properties" asks `PropertiesPanelExtension` with `scope: 'source'`, and the bundle's `affine-database-properties-panel` element draws the view's properties list for the host to mount where it wants; without the seam, the popover stays. `DataSourcePickerExtension({ list, createDatabase?, createSource? })` (`@labre/affine/shared/services`) adds a "Linked view of a database" slash entry that inserts a view of an existing source (`popDataSourcePicker` in `@labre/core-database/view`); registered without `createDatabase`, "Table View" and "Kanban View" leave the slash menu, with it they ask the host for a new database. `TitleBandService.setData?` and `TitleBandProperty.dataWritable?` let a select chip create and rename options. New keys: `com.labre.database.properties-panel.{title,show-all,hide-all,unavailable}`, `com.labre.database.picker.{title,new-source,new-database,empty}`, `com.labre.database.slash.linked-view` and `.linked-view.description`. Nothing is written on load.
- 651ffab: Hosted database sources (ADR 0035 §7, §9e, §9f; issues B1, B2, B15).

  `HostedDataSourceBase(hostModel, resolveSource?)` replaces `ExternalDataSourceBase(model)`, which stays exported as an alias with the same one-argument constructor: a 0.48 host source compiles and reads its rows unchanged. The views stay in `hostModel.props.views`; with `resolveSource`, each view reads the source its stored `sourceId` names (absent: the host's implicit source), `resolveSource` returning `{ schema, rows }` (the `affine:database` block that owns the source's schema and a signal of its row ids). The data layer answers for the current view's source (`source# @labre/data-view, `schema# @labre/data-view, `rows# @labre/data-view); a source the host cannot resolve (`null`, `sourceMissing# @labre/data-view) draws "Source not found" under the database title and its view bar instead of the view, never an error, and nothing is rewritten. Without `resolveSource`, every view reads the block itself, as in 0.48. `HostedSource` and `ResolveHostedSource` are exported.

  Cell hydration, a widening of the data-source contract: `cellStatus(rowId, propertyId)` (`ready`, `pending`, `error`), `valuesState# @labre/data-view (`{ status: 'loading' | 'ready' | 'error', since }`) and an optional `retryValues()`, `ready`by default on`DataSourceBase`, so the inline source and every 0.48 host source are unchanged. A pending cell draws a skeleton and a failed one stays empty in every table and kanban cell (desktop, virtual and mobile); neither mounts its editor, and `Cell.valueSet`/`jsonValueSet` do nothing on them, so no paste, fill or drop writes over an undelivered value. Group counts and column statistics show "…" until values are ready; a banner says values are still loading after 3 s (`com.labre.database.values.loading`) and, on error, that they could not be loaded (`com.labre.database.values.error`) with Retry (`com.labre.resource.status.retry`, the existing word) when the source offers `retryValues`. New exports in `@labre/data-view`: `CellStatus`, `ValuesState`, `ValuesStatus`, `DataSourceHydration`, `cellStatusOf`, `valuesStateOf`, `valuesReady`, `valuesBannerOf`, `VALUES_READY`, `VALUES_SLOW_AFTER_MS`, `VALUES_PENDING_MARK`, `renderCellStatus`; `Cell`gains an optional`status# @labre/data-view; `DataViewRendererConfig` an optional `viewPlaceholder`.

  Rows that are documents: a hosted source overrides `rowsAreDocuments`, answers titles from its own store with `titleOf(rowId)` and returns the new `hostedTitleColumnConfig` from `propertyMetaGet('title')`: the title column keeps its `title` type and fixed rules, its value is a plain string drawn and edited by the plain-text cell, and no row's document is loaded to draw it.

  New keys, English fallbacks in `@labre/affine-block-database/translations` (`DATABASE_WORDINGS`, a new entry point): `com.labre.database.source-missing`, `com.labre.database.source-missing.hint`, `com.labre.database.values.loading` and `com.labre.database.values.error`.

- 651ffab: Databases are editable on mobile (ADR 0035 §1, B5): `ExternalDataSourceBase.readonly# @labre/data-view is the store's read-only state alone and no longer adds `IS_MOBILE`. Editing goes through the touch renderers the table and kanban presets already ship (cell tap to edit, the mobile row and card menus, the mobile tag and date pickers); nothing new is drawn. Their touch targets grow to 44px: table rows and column headers, kanban cells and "add card", and the row and card ops through an invisible hit area that keeps their drawn size.
- 651ffab: Two additions for a host that backs a database with its own pages (ADR 0035, amendment of 2026-10-14). **The menu beside "New":** `DatabaseNewRowMenuExtension({ open })` (`@labre/affine/blocks/database`, identifier `DatabaseNewRowMenuProvider`) draws a chevron beside the "New" button of every view (table, kanban, gallery, list, calendar, inline and on the full page); a click calls `open({ anchor, blockId, viewId })` and the host draws its menu (its templates). "New" itself still adds a row through the source's `rowAdd`, where a host applies its default template. Absent or `null`, "New" is the single button it was. The chevron's label and tooltip is the new key `com.labre.database.new-record.more` ("Templates and options"); 44px on a coarse pointer. **A text column for hosted sources:** `hostedTextColumnConfig` (same entry) is data-view's plain-text preset (type `text`, a string value, the table's plain-text cell) offered by "+ property" and "Type" on a source that lists it in `getPropertyMetas` and answers it from `propertyMetaGet('text')`. The inline database does not offer it: its Text stays `rich-text`. No stored field changes.
- 651ffab: The `database` and `data-view` flags gate tooling, never a stored database (ADR 0009 amendment of 2026-10-14, ADR 0035 §5). The database view is split the callout's way: the new `DatabaseRenderViewExtension` (block view, flavour, `effects()`, the title band's link cell) is always registered, and `DatabaseViewExtension` keeps only the creation tooling under `database`: the slash entries, "+ view" / "Create …" in the views bar (through the new `DatabaseViewCreationIdentifier`; absent, the block sets the new data-view key `ViewCreationOffKey` on its source), and the host's `configure` of the block's "⋯" menu, so `viewManager.configure(DatabaseViewExtension, …)` still compiles. Same split for the data-view block: `DataViewRenderViewExtension` always on, `DataViewViewExtension` gated and empty. With `{ database: false, 'data-view': false }` a stored database renders with all its views, its cells stay editable and its rows open. A host that registers these extensions by hand (rather than through `getInternalViewExtensions`) must add the render halves.
- 651ffab: Database telemetry (ADR 0035 §12, B17), documented in the telemetry README's new "Databases" section with the boundary between the library's `Database*` events and the host's own `base.*`. New events, ids and closed vocabularies only, never a row id, a value, a title or a name: `DatabaseViewAdded { viewType, source: 'existing' | 'new' }` (the views bar's "+", once per gesture; "with a new source" reports `new` through `AddViewMenuContext.addView(type, source?)`, whose new parameter is optional), `DatabaseViewTypeChanged { fromViewType, toViewType }` (the Layout switch), `DatabaseGroupChanged { groupBy, propertyType? }` (every grouping menu, through `GroupTrait`), `DatabaseRowOpened { mode, newTab, rowKind }` (every preset's row open, gallery and list included, from the database block's `openDetailPanel` once B9's row-open request is built: the host's mode, `side` for the library's own peek or detail) and `DatabaseValuesLoadFailed { retryable }` (once per failure of a hosted source). Filters and sorts keep their historical `CreateDatabaseFilter` and `DatabaseSort*` series. `AddDatabaseView` is no longer emitted (replaced by `DatabaseViewAdded`); it and the never-emitted `CreateDatabaseView`, `ChangeDatabaseLayout` and `CreateDatabaseGroup` stay in `TelemetryEventMap`, deprecated. A host that forwards `track(event, props)` needs nothing; one that types an exhaustive `Record<keyof TelemetryEventMap, …>` adds the five keys. New in `@labre/data-view`: `DataViewEventTraceKey` (the tracer a database block gives its source), `traceViewEvent`. New in `@labre/affine-block-database`: `rowOpenedParams`.
- 651ffab: The full page of a database lists its view settings for a host's menu, and a view can be imported from another database (ADR 0035, amendment of 2026-10-14; labre PRD REQ-DB-2, DB-4, DB-10). **"This view":** `<affine-database-page>` registers six `'view-menu'` commands (`database.view.layout`, `.group`, `.open-in`, `.properties`, `.save-template`, `.import`), so `getViewActions(std, 'page')` lists them and `runViewAction` runs them, on the full page only; a setting opens the very menu of the view settings entry (`openSetting(key)` of the view's options button, `popViewSetting` in `@labre/data-view`), listed where the view offers it and never on a read-only page. New keys `com.labre.database.view-menu.{layout,group,save-template,import}` ("Layout", "Group", "Save as template", "Import a view…"); "Open pages in" and "Properties" reuse `com.labre.data-view.open-in` and `com.labre.database.properties-panel.title`. **Import and templates, through the picker:** `DataSourcePickerService` gains two optional verbs, `importView(request)` (the host picks a view and maps its properties, then calls `request.add({ view, properties, mapping })`, which copies it as a new view on the current view's source, one undo step) and `saveViewTemplate(template)` (the current view without its filters, sorts and manual orders). "+ view" adds "Import a view from another database" (`com.labre.database.add-view.import`) when the picker imports. `remapView`, `defaultMapping` and `viewTemplateData` (pure, `@labre/core-database`) preview the copy for the host's dialog. `DatabaseViewAdded.source` gains `import`. No stored field changes.
- 651ffab: A stored database view whose mode has no preset here (a `timeline` from an import, a mode written by a newer client) renders as a table instead of throwing `Unknown view type` and blanking the whole database (ADR 0035 §6). `viewMetaGet` never throws: the database answers the table preset over the source's properties. Such a view reads the table's default settings, never rewrites its stored data (`SingleView.dataUpdate` is a no-op on it), keeps editable cells, and its tab says "Shown as a table" (`com.labre.data-view.view.shown-as-table`); its menu offers "Duplicate as table" (`com.labre.data-view.view.duplicate-as-table`) instead of rename, Edit View and Duplicate. New on `SingleView`: `shownAsFallback# @labre/data-view; new in `@labre/data-view`: `duplicateAsShownPreset(manager, viewId)`and`./translations` (`DATA_VIEW_WORDINGS`). Calendar becomes render-only: a stored calendar view still renders and edits as a calendar and can still be switched to a table or a board, but no path creates one any more (the slash "Calendar View" entry is gone, `databaseBlockViews`, the list the views bar and Layout read, no longer holds calendar, and `databaseBlockViewConverts`drops the conversions into calendar). New exports:`databaseBlockRenderableViews`, `databaseBlockFallbackView`, `databaseBlockViewMetaGet(mode)`; `databaseBlockViewMap`has no prototype, so a mode named`constructor` falls back too. The view menu's Duplicate and Delete now read the toolbar's keys (`com.labre.toolbar.duplicate`, `com.labre.toolbar.delete`).
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
  - @labre/affine-components@0.49.0
  - @labre/affine-shared@0.49.0
  - @labre/affine-model@0.49.0
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
  - @labre/affine-shared@0.48.0
  - @labre/affine-components@0.48.0
  - @labre/affine-model@0.48.0
  - @labre/global@0.48.0
  - @labre/std@0.48.0
  - @labre/store@0.48.0

## 0.47.1

### Patch Changes

- Updated dependencies [d796aed]
  - @labre/affine-components@0.47.1
  - @labre/affine-shared@0.47.1
  - @labre/affine-model@0.47.1
  - @labre/global@0.47.1
  - @labre/std@0.47.1
  - @labre/store@0.47.1

## 0.47.0

### Minor Changes

- 9318a00: A band of property chips under the page title and at the head of the page note on the canvas, fed by the host (ADR 0035 §9d and §11). New seam `TitleBandExtension(service)` / `TitleBandProvider` in `@labre/affine/shared/services`: `sheet$(docId)` returns the page's visible properties as data-view types and cell values (`loading`, `ready`, `missing`, `error`), `set(docId, propertyId, value)` hands every edit back (the chip shows pending until it settles, the band never applies a value), and the optional `add`, `collapsed# @labre/data-view / `setCollapsed`and`notShown# @labre/data-view draw the "+", remember the collapse and, on the canvas only, a "Not shown in this document" row of page links. An empty visible property draws an empty chip that can still be clicked. On the canvas the band lives inside the note, so it follows the zoom. Without the seam nothing is drawn and nothing changes: no value lives in the document.

  New seam `PropertiesPanelExtension({ open, close } | null)` / `PropertiesPanelProvider`: the band's panel button sends `open({ scope: 'page', docId })`; absent or `null`, there is no button. The request type also declares `scope: 'source'` for the database chrome to come.

  `@labre/affine/host-panels` gains `formatPropertyValue(property, locale?)` and `isPropertyValueEmpty(property)`, so a host's panel reads values as the chips do, and re-exports the sheet and request types.

  The page title reads its family from `--labre-doc-title-font-family`, falling back to the body family: a host sets the title's face (Cabinet Grotesk in the Labre app) without touching the headings.

  `@labre/data-view/property-pure-presets` exports the number preset's `formatNumber`, `NumberFormat` and `NumberFormatSchema`. New keys `com.labre.title-band.*` (add, clear, collapse, empty, expand with `{{count}}`, label, loading, not-shown, open-panel).

### Patch Changes

- Updated dependencies [9318a00]
- Updated dependencies [9318a00]
  - @labre/affine-shared@0.47.0
  - @labre/std@0.47.0
  - @labre/affine-components@0.47.0
  - @labre/affine-model@0.47.0
  - @labre/global@0.47.0
  - @labre/store@0.47.0

## 0.46.2

### Patch Changes

- Updated dependencies [cc86d33]
  - @labre/affine-shared@0.46.2
  - @labre/affine-components@0.46.2
  - @labre/affine-model@0.46.2
  - @labre/global@0.46.2
  - @labre/std@0.46.2
  - @labre/store@0.46.2

## 0.46.1

### Patch Changes

- @labre/affine-components@0.46.1
- @labre/affine-model@0.46.1
- @labre/affine-shared@0.46.1
- @labre/global@0.46.1
- @labre/std@0.46.1
- @labre/store@0.46.1

## 0.46.0

### Patch Changes

- Updated dependencies [f076627]
  - @labre/affine-shared@0.46.0
  - @labre/affine-components@0.46.0
  - @labre/affine-model@0.46.0
  - @labre/global@0.46.0
  - @labre/std@0.46.0
  - @labre/store@0.46.0

## 0.45.1

### Patch Changes

- Updated dependencies [ffe75a2]
  - @labre/affine-shared@0.45.1
  - @labre/affine-components@0.45.1
  - @labre/affine-model@0.45.1
  - @labre/global@0.45.1
  - @labre/std@0.45.1
  - @labre/store@0.45.1

## 0.45.0

### Patch Changes

- bfce95b: The core bundle no longer installs a test runner: `vitest` leaves its
  dependencies, and the `vitest` helpers it used to carry as unreachable files
  are gone. It also no longer ships `getAttachmentFileIconRC` in
  `components/icons`, a React helper that loaded `react/jsx-runtime` although
  the bundle never declared `react`; `getAttachmentFileIcon` (Lit) is the icon
  lookup to use. No other API change.
- Updated dependencies [aab35cf]
- Updated dependencies [bfce95b]
- Updated dependencies [77998d4]
  - @labre/affine-shared@0.45.0
  - @labre/affine-components@0.45.0
  - @labre/std@0.45.0
  - @labre/affine-model@0.45.0
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
  - @labre/affine-components@0.44.0
  - @labre/global@0.44.0
  - @labre/store@0.44.0

## 0.43.1

### Patch Changes

- Updated dependencies [2602909]
  - @labre/affine-shared@0.43.1
  - @labre/affine-components@0.43.1
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
  - @labre/global@0.43.0
  - @labre/std@0.43.0
  - @labre/store@0.43.0

## 0.42.0

### Patch Changes

- Updated dependencies [87ef822]
- Updated dependencies [911d143]
- Updated dependencies [0dcd69b]
- Updated dependencies [4899136]
- Updated dependencies [2f5c621]
- Updated dependencies [911d143]
- Updated dependencies [48213e7]
- Updated dependencies [512ab39]
- Updated dependencies [7437481]
- Updated dependencies [2e179bb]
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
- Updated dependencies [55d9f13]
  - @labre/std@0.42.0
  - @labre/affine-shared@0.42.0
  - @labre/store@0.42.0
  - @labre/affine-components@0.42.0
  - @labre/global@0.42.0

## 0.41.0

### Patch Changes

- Updated dependencies [a513f05]
- Updated dependencies [6cfe313]
- Updated dependencies [5776733]
- Updated dependencies [4ed9484]
- Updated dependencies [6271b11]
- Updated dependencies [924f7d6]
- Updated dependencies [5744cfd]
- Updated dependencies [feca957]
- Updated dependencies [1dac32d]
- Updated dependencies [b2781b5]
- Updated dependencies [223b280]
- Updated dependencies [47d4ac6]
  - @labre/affine-shared@0.41.0
  - @labre/std@0.41.0
  - @labre/affine-components@0.41.0
  - @labre/global@0.41.0
  - @labre/store@0.41.0

## 0.40.0

### Patch Changes

- Updated dependencies [95ff0a5]
- Updated dependencies [95ff0a5]
  - @labre/affine-shared@0.40.0
  - @labre/affine-components@0.40.0
  - @labre/global@0.40.0
  - @labre/std@0.40.0
  - @labre/store@0.40.0

## 0.39.3

### Patch Changes

- Updated dependencies [070e1ec]
  - @labre/affine-components@0.39.3
  - @labre/affine-shared@0.39.3
  - @labre/global@0.39.3
  - @labre/std@0.39.3
  - @labre/store@0.39.3

## 0.39.2

### Patch Changes

- Updated dependencies [07b47b8]
  - @labre/affine-shared@0.39.2
  - @labre/affine-components@0.39.2
  - @labre/global@0.39.2
  - @labre/std@0.39.2
  - @labre/store@0.39.2

## 0.39.1

### Patch Changes

- @labre/affine-components@0.39.1
- @labre/affine-shared@0.39.1
- @labre/global@0.39.1
- @labre/std@0.39.1
- @labre/store@0.39.1

## 0.39.0

### Patch Changes

- @labre/affine-components@0.39.0
- @labre/affine-shared@0.39.0
- @labre/global@0.39.0
- @labre/std@0.39.0
- @labre/store@0.39.0

## 0.38.2

### Patch Changes

- Updated dependencies [0ffa45b]
  - @labre/std@0.38.2
  - @labre/affine-components@0.38.2
  - @labre/affine-shared@0.38.2
  - @labre/global@0.38.2
  - @labre/store@0.38.2

## 0.38.1

### Patch Changes

- @labre/affine-components@0.38.1
- @labre/affine-shared@0.38.1
- @labre/global@0.38.1
- @labre/std@0.38.1
- @labre/store@0.38.1

## 0.38.0

### Patch Changes

- Updated dependencies [6aa0081]
  - @labre/affine-shared@0.38.0
  - @labre/affine-components@0.38.0
  - @labre/global@0.38.0
  - @labre/std@0.38.0
  - @labre/store@0.38.0

## 0.37.0

### Patch Changes

- @labre/affine-components@0.37.0
- @labre/affine-shared@0.37.0
- @labre/global@0.37.0
- @labre/std@0.37.0
- @labre/store@0.37.0

## 0.36.0

### Patch Changes

- Updated dependencies [9fa662a]
- Updated dependencies [60fb357]
  - @labre/affine-components@0.36.0
  - @labre/affine-shared@0.36.0
  - @labre/std@0.36.0
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
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-components@0.34.2
- @labre/affine-shared@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2
- @labre/store@0.34.2

## 0.34.1

### Patch Changes

- Updated dependencies [6120f7a]
  - @labre/std@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-shared@0.34.1
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
  - @labre/affine-components@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Patch Changes

- Updated dependencies [3fbf69c]
- Updated dependencies [f929e12]
- Updated dependencies [13360cd]
- Updated dependencies [32e4d45]
- Updated dependencies [b03132c]
- Updated dependencies [5737a56]
- Updated dependencies [9022c92]
- Updated dependencies [edfaba2]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-components@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/std@0.33.0
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

- 50ab9ae: A date column can group a database, at the grain you choose

  Grouping a table or a kanban board offered tags, text, numbers and booleans —
  never dates, the one axis a roadmap is actually organised along. A date
  property is now groupable, and it is groupable at six grains: relative to
  today (Yesterday, Today, Next 7 days, Last 30 days, then by month further
  out), by day, by week starting Monday, by week starting Sunday, by month, or
  by year.

  The grain and the reading direction live in the group settings menu, beside
  "Group by", and both are stored with the view, so reopening the document
  finds the same reading rather than snapping back to the default. Date groups
  order themselves chronologically — oldest first or newest first — instead of
  offering a manual drag order that a recomputed set of groups could not honour
  anyway; the manual order stays exactly as it was for every other kind of
  grouping.

- f832f27: Dragging a kanban group no longer scrambles the order of the others

  Reordering groups spliced the moved key out of the list by the index of a
  `findIndex` that was never checked. Drop a group onto something the list did not
  know about — a group that had just been renamed away, or the group itself — and
  the index was `-1`: the _last_ group was cut out instead, then the dragged one
  was re-inserted near the end. The manual arrangement, which is what a kanban
  board mostly is, came back wrong and stayed wrong, because that scrambled list
  was written straight to the document.

  A move that cannot be honoured is now a move that does not happen: unknown
  group, unknown drop anchor, or a group dropped where it already sits all leave
  the order exactly as it was, and nothing is written. Legitimate drags behave as
  before.

- 9ffab42: A mobile cell enters and leaves editing mode once, not on every repaint

  On phones, table and kanban cells watched the selection through an effect that
  also read the signal holding the rendered cell component. Every repaint of the
  cell therefore re-ran the branch and called the cell's enter- or exit-editing
  hook again, on a cell whose editing state had not moved. For a number or date
  cell, whose exit hook re-parses and writes back the value, that meant a write on
  every tick — visible as a caret that jumps back, a value reformatted while you
  are still typing, and needless churn in the document.

  Each branch now runs only on a real transition, so the hooks fire once when the
  cell starts being edited and once when it stops.

- c6eac56: A number reads from the left in the record detail panel

  Number cells are right-aligned in a table, where the column edge gives the digits
  something to line up against. The detail panel has no such edge, so it carries a
  rule that flips a number back to the left — except the rule named a class the
  cell never renders, so it matched nothing and every number in the panel stayed
  pushed against the far right of a full-width row, adrift from its own label.

  The rule now names the element the cell actually renders, so numbers in the
  detail panel start where every other field starts.

- 6264dfc: A stored filter resolves to the function it means

  A condition is persisted as a function name and nothing else — the column type
  it was built for is not written down. Resolution took the first function
  answering to that name, whatever type it belonged to, so a name declared by two
  types resolved to the wrong implementation. Its argument then failed
  validation, and a condition that cannot be evaluated reports a match: the
  filter silently let every row through and looked as if it had been ignored.

  Every function answering to the name is now tried, and the first one that can
  actually decide answers. A condition no candidate can apply still lets the row
  through rather than hiding everything, as before.

- c2e1020: A grouped table can be folded down to its headings

  A table grouped by status, owner or phase gives every group its full column
  header, its rows, its add-row line and its statistics bar — useful while you
  work inside one group, in the way while you are looking for another.

  Each group heading now carries a chevron. Clicking it (or pressing Enter or
  Space on it, it is a real focusable control announcing its expanded state)
  folds the group down to its heading alone; clicking again brings the rows
  back. The state is remembered per view and per group for the length of the
  browsing session, so scrolling away and returning finds the table as you left
  it, while a fresh session starts with everything open.

  Both the desktop and the mobile table honour it.

- ceb2761: A view survives its own layout change, and a detail cell stops fighting itself

  Four small pieces of database behaviour that all went wrong on the way out of an
  interaction:

  Switching a view's layout — table to kanban and back — kept the old view's
  controller alive, because the cache holding it was keyed by the view id and the
  id does not change when the layout does. The board that appeared was still being
  driven by table logic: wrong hotkeys, wrong selection, wrong drag. The cache now
  remembers the layout alongside the id, and drops the entry of a deleted view
  instead of holding it forever.

  Re-picking the layout a view already has now does nothing, instead of resetting
  that view to the defaults of its own type and throwing away its column widths,
  filters and groups.

  Leaving edit mode in the record detail panel could loop: the cell's exit hook
  writes its value back, the write re-asks for the selection, and the selection
  runs the exit hook again. The panel now publishes the new selection before
  running the hook, and ignores a selection identical to the one already applied,
  so each hook fires once.

  Finally, a number column now reads a pasted "11,451.4" or "$1,200" as the number
  it obviously is, rather than discarding it because the grouping separators made
  it unparseable.

- d8eb24a: The Delete key clears a table selection, like Backspace already did

  Table views bound the clearing shortcut to Backspace only. On a full keyboard —
  and on every keyboard where Delete is the obvious key for "empty this" — pressing
  Delete over a selected cell, a rectangle of cells, or a set of rows did nothing
  at all, with no hint that another key was expected.

  Delete now runs the same handler as Backspace in both the standard and the
  virtualised table: it empties the selected cells, or deletes the selected rows.
  Nothing changes for Backspace, and neither key does anything while a cell is
  being edited, where Delete belongs to the text cursor.

- fc52023: A filter keeps working after its column is hidden

  Table and kanban views evaluated their filters against the visible properties
  only. Hide the column a condition points at — a perfectly ordinary way to tidy a
  table once the filter is set — and the condition evaluated against nothing: the
  rows it was hiding came flooding back, while the filter chip in the toolbar
  still claimed to be active.

  Filters are now evaluated against the view's full property list. Hiding a column
  changes what is drawn, never what is kept. The filter itself was never deleted,
  so views that lost their filtering get it back on reload with no migration.

- 9cf65a2: Typing a letter into a select cell searches instead of creating a broken tag

  Start typing over a focused select or multi-select cell and the first character
  was pushed through the generic "set this cell from a string" path. For a tag
  column that meant fabricating a tag out of a single character, and the picker
  then opened with an empty search box — so a one-letter tag could neither be
  found nor selected, only accidentally created.

  The typed character is now staged on the cell and handed to the tag picker as
  its initial search text. Typing `C` over a status cell opens the picker already
  filtered to `C`: existing one-letter tags show up and can be picked, and
  creating a new one stays a deliberate choice. Text, number and date columns keep
  the old behaviour.

- c7612da: A property name typed in the menu survives the menu closing

  Renaming a database/pivot property meant typing into the little input at the top
  of the property menu. That input only handed its value back on an explicit
  completion — Enter, or Escape. Dismiss the menu the way people actually dismiss
  menus, by clicking somewhere else, and the typed name was thrown away: the
  column kept its old title and the edit had to be done again, this time
  remembering to press Enter.

  Menu inputs now report on blur as well, and the property menu listens to that
  report. Losing focus is a save, so the name is kept whichever way the menu goes
  away. Mobile and desktop now follow the same path — the mobile branch used to
  write on every keystroke, which made an abandoned edit unabandonable.

  `menu.input` gains an optional `onBlur` callback; nothing that already passed
  `onComplete` or `onChange` changes behaviour.

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [9e23b5b]
- Updated dependencies [90a9168]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [50ab9ae]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [5ac0c68]
- Updated dependencies [1fa46c1]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [492bac6]
- Updated dependencies [72b334c]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [3c5c97e]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [c7612da]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [48e90f4]
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
  - @labre/global@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-components@0.30.2
- @labre/affine-shared@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-components@0.30.1
- @labre/affine-shared@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-components@0.29.1
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
  - @labre/affine-components@0.29.0
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
