---
'@labre/affine-database-block': patch
---

"Duplicate property" on a select or multi-select column now gives the copy its own option ids, and the duplicated cells point at them: the two columns no longer share an option, so editing a tag in one leaves the other alone. Labels, colours and the source column are unchanged, the duplicate is one undo step, and nothing is written on a read-only document. `copyCellsByProperty` takes an optional fourth argument mapping each copied value.
