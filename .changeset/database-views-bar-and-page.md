---
'@labre/data-view': minor
'@labre/affine-block-database': minor
'@labre/affine-database-editor': minor
---

The database view bar behaves like Notion's and a database can be shown as a full page (ADR 0035 B11, B13).

- **View bar (core).** As many tabs as the width allows, the rest under "N more" (`com.labre.data-view.views-bar.more`, `{{count}}`), which lists the views without a tab. The current view always keeps its tab, in place of the last one that would have fitted. "+" is always drawn after the tabs (no longer only when every tab fits) and is the bar's only creation entry: "N more" no longer offers "Create …". On a phone the tabs, "N more" and "+" are 44px tall. The tab menu's wordings are keys now (`com.labre.data-view.views-bar.view-name`, `.edit-view`, `.move-left`, `.move-right`, `.add-view`). `component-overflow` takes a `pinned` item and passes the hidden indices to `renderMore` as a second argument. New registry `AddViewMenuExtension` / `AddViewMenuIdentifier`, filled by the bundle, never by a host: absent, "+" lists the creatable presets as before.
- **Hosted sources.** `HostedDataSourceBase` gains `resolvesSources` and `sourceOf(sourceId)`, read-only.
- **`@labre/core-database`.** `DatabaseEditorToolingViewExtension` gives "+" its source entries on a source that resolves sources: "On an existing source" (each source the views read, and the sources of its database that the host's `DataSourcePickerExtension` lists with no view yet) and "With a new source" when that picker has `createSource`; a view added on a source stores its `sourceId`, and its default data is derived from that source. `DatabaseEditorViewExtension` defines `<affine-database-page .store .extensions .hostBlockId>` (`DatabasePageHost`): it builds a page editor on the database document that draws the views' block alone, without its title row or the page root's chrome; the schema blocks and the note can be neither selected, deleted, moved nor inserted into, and nothing is written. New keys: `com.labre.database.add-view.existing-source`, `.new-source`, `.untitled-source`, `com.labre.database.page.host-missing`.
