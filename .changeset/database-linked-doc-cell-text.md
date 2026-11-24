---
'@labre/affine-database-engine': minor
'@labre/affine-database-block': patch
---

A database title or text cell holding a linked-doc reference now reads as
the editor shows it (#742, upstream toeverything/AFFiNE#15865): the linked
doc's title, or the alias the reference carries. The view search finds the
row by that title, and the cell's copy, `stringValue$` and export
(`jsonValue$`) carry it, where they held a blank placeholder (search, copy)
or ignored the alias (export). A reference to a deleted or untitled doc
reads with the editor's own wordings, through the existing translation keys.

The title is read from the workspace's doc metadata: no store of the linked
doc is created and no doc is loaded, so a table linking many docs costs a
lookup per reference. A rename of the linked doc, local or from a peer, is
followed by the cell's `stringValue$` and `jsonValue$` and by the view
search; a one-off read (an adapter's export) gets the title of the moment.
A host's override of `DocDisplayMetaProvider` titles is not consulted here.
A data source built outside an editor keeps the raw text, as before.

An empty rich-text cell exports as `null`, as it always did; its JSON schema
is unchanged.

Property types: `PropertyConfig.rawValue.toString` receives an optional
`dataSource` (a view's cell passes it). A type written against the previous
shape keeps compiling and keeps its behaviour, and a call without it still
compiles.
