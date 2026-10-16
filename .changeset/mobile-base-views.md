---
'@labre/data-view': patch
'@labre/affine-block-database': patch
'@labre/affine-block-data-view': patch
'@labre/affine-components': patch
'@labre/affine-database-editor': patch
---

Base views on a phone. The mobile table scrolls sideways inside its own wrapper, the title column stays pinned and opaque, and the row actions no longer cover the title. A context menu on a phone (view settings, filter, sort) opens as a bottom action sheet over a scrim, and a tap on the scrim closes it. The view menu, search, "+ New" and "+ Add filter" are 44px under a coarse pointer. Search now shows on a phone; filter and sort were already in the view menu. "N more" and "+" no longer wrap over "+ Add filter". When the tabs and the tools do not fit side by side, the tools drop to their own line. The full-page base hides its own title row and narrows its margins to 24px under 640px. New keys: `com.labre.data-view.new-record`, `com.labre.data-view.new-record.short`, `com.labre.data-view.group.ungrouped`, `com.labre.data-view.filter.add`, `com.labre.data-view.search.placeholder`, `com.labre.data-view.search.clear-hint`. A base's empty title reads `com.labre.doc.untitled`. No stored format change.
