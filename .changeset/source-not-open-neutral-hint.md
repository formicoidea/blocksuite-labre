---
'@labre/affine-database-block': patch
---

The English fallback of `com.labre.database.source-not-open.hint` no longer
tells the reader to open the source (issue #704): only a reader who cannot
open it sees that state. It now reads "This view reads a source that is not
open to this page." A host that names who may open the source keeps doing so
in its own catalogue; the key is unchanged.
