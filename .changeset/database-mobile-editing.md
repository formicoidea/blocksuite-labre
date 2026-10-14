---
'@labre/affine-block-database': minor
'@labre/data-view': minor
---

Databases are editable on mobile (ADR 0035 §1, B5): `ExternalDataSourceBase.readonly$` is the store's read-only state alone and no longer adds `IS_MOBILE`. Editing goes through the touch renderers the table and kanban presets already ship (cell tap to edit, the mobile row and card menus, the mobile tag and date pickers); nothing new is drawn. Their touch targets grow to 44px: table rows and column headers, kanban cells and "add card", and the row and card ops through an invisible hit area that keeps their drawn size.
