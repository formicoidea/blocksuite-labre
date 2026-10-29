---
'@labre/affine': minor
---

New optional `requireSource` on the data-source picker (`DataSourcePickerExtension({ ..., requireSource: true })`): a database block with no source and no row draws an empty view ("No source connected") instead of the native table, with a "Connect a source" button that reopens the creation popover; no row can be added to it natively, and closing the popover still writes nothing. A native database that has rows keeps rendering them. New: `awaitsSource` (`@labre/affine/blocks/database`) and two keys, `com.labre.database.source-required` and `com.labre.database.source-required.hint`; the button reuses `com.labre.database.creation.title`, whose declaration moves to core (`DATABASE_CREATION_TITLE`, same key). A host that does not set it sees no change.
