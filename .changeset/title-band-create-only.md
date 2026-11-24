---
'@labre/affine-shared': minor
'@labre/affine-database-engine': minor
'@labre/affine-fragment-doc-title': minor
---

A title band chip can create options without offering "Rename" (issue #710):
`TitleBandProperty` gains an optional `optionEdits` (`'create'` or
`'create-rename'`, absent reading `'create-rename'` as before), read when the
property is `dataWritable`. With `'create'`, the tag menu keeps "Create" and
draws no option menu, for options whose id is their label. `TagOptionEdits`
gains `'create'` (append-only).
