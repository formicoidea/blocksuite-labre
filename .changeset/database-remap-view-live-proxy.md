---
'@labre/affine': patch
---

`remapView` and `viewTemplateData` (`@labre/affine-database-editor`) accept a store's live view: they copied their input with `structuredClone`, which throws a `DataCloneError` on a `Proxy`, so a host passing the block's reactive view data crashed (seen in labre on import). They now take a JSON copy, which holds every key a view stores.
