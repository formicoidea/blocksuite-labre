---
'@labre/store': patch
---

An optional prop on a flat block answers before it is ever filled in

A flat block's props each get a companion signal (`title$`, `cols$`, …) built
from what the document actually stores. A prop declared with `undefined` as its
default is, by design, never written to the document, so it had no entry to be
built from: `model.props.foo$` was simply missing until something assigned
`model.props.foo` a value. Anything that wanted to observe such a prop — or set
it through its signal — from the moment the block loaded hit `undefined` instead
of a signal.

Optional props now get their signal at load time, holding `undefined` until the
prop is given a value, and assigning through it writes to the document like any
other prop. What is stored is unchanged: a prop with an `undefined` default is
still never written, and defaults that do have a value are still applied at the
same point, so documents written before this change load and round-trip
byte-for-byte identically.
