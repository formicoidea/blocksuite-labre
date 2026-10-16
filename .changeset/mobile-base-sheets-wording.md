---
'@labre/data-view': patch
'@labre/affine-components': patch
'@labre/affine-database-editor': patch
---

A base's "View settings" and "Property settings" sheets on a phone now speak the host's catalogue: every entry goes through a `com.labre.*` key, and "Done" (`com.labre.context-menu.done`) is translated on the sheet and on any sub-sheet it opens. A phone's sheet hangs from the body, out of the editor's DOM; its modal now provides the editor of the element it opens from (`PopupTarget.element`, optional, set by `popupTargetFromElement`). The view settings' "Layout" shows the preset's translated name, and the phone's column header reads the same property menu as the desktop's (`propertyMenuItems`).

Reused keys: `com.labre.database.view-menu.layout` and `.group` (now declared by `@labre/data-view`, restated by the database editor), `com.labre.selection-pane.filter`, `com.labre.database.properties-panel.title`, `com.labre.data-view.views-bar.view-name`, `.move-left`, `.move-right`, `com.labre.toolbar.duplicate`, `.delete`. New keys: `com.labre.data-view.view-settings`, `.sort`, `.sort.count`, `.filter.count`, `.properties.shown`, `.property.settings`, `.property.name`, `.property.type-entry`, `.property.insert-left`, `.property.insert-right`. "Insert Left Column", "Insert Right Column", "Move Left" and "Move Right" read in sentence case on the phone.
