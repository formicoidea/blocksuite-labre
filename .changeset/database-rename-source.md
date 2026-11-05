---
'@labre/affine': minor
---

A view's "Source" list can rename the source the view reads, through a new optional
`DataSourcePickerService.renameSource(databaseId, sourceId, name)` verb (issue #576).
With it, "Rename source" heads the list and Enter hands the host the trimmed, changed
name; `{ ok: false, message }` keeps the field open with the message under it. The
library writes nothing: the host renames and updates `list()` and the source's title.
Without the verb, the name stays read-only, as before.
