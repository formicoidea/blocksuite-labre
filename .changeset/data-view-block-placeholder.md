---
'@labre/affine-database-view-block': minor
---

A stored `affine:data-view` block (only documents imported from AFFiNE hold
one) now draws instead of failing on its first render (#745). It shows its
title and its "⋯" menu (rename, copy, delete; hidden on a read-only document),
then a status: "This view cannot be displayed." and "It was created in another
editor; its content is kept." The block is never rewritten: its stored props
are left untouched, and copy, duplicate and resave keep it. It shows whatever
the `data-view` flag says.

The "⋯" is now a real button: in the tab order, pressed by Enter and Space,
named "Block options", with the keyboard focus ring. It was a `<div>` that
only a mouse could reach.

Three new keys for the host's catalogue, exported by the new `./translations`
entry of the package: `com.labre.data-view-block.unavailable`,
`com.labre.data-view-block.unavailable.hint` and
`com.labre.data-view-block.options`. The component's public members are
unchanged; those the block no longer reads are marked `@deprecated`.
