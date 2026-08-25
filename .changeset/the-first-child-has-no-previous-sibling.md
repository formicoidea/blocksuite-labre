---
'@labre/store': patch
---

The first child of a block no longer reports the last one as its previous sibling

`DocCRUD.getPrev` read the previous sibling as `children.at(index - 1)`. For the
first child that is `at(-1)`, which JavaScript resolves from the end of the
array: the first child answered the _last_ child of the same parent instead of
nothing. The sibling walk therefore closed into a ring rather than stopping, so
anything built on it could loop or reach past the start of a block's children.

The first child now answers `null`. `getNext` was already correct — `at(length)`
is simply out of range — and is left as it is.
