---
'@labre/affine': minor
---

A host may name a new source where it is created. With the data-source picker's new optional `sourceName` (`{ suggest, check }`), "New source", "New database", "With a new source" and "New empty source" open a naming step in the same menu cascade (the field on your suggestion, your verdict under it, "Create source") and pass the trimmed name to `createSource(databaseId, sourceName)` / `createDatabase(sourceName)`. Without it nothing changes. The context menu's input gains an optional `onEnter` that may keep the menu open. New wordings `com.labre.database.source-name.{placeholder,ok,taken,empty,create}`.
