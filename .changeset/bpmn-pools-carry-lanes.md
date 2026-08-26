---
'@labre/affine-block-surface': patch
'@labre/affine-model': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine': patch
---

feat(blocks): a BPMN pool carries its lanes

A pool can now be divided into lanes (couloirs). "Add lane" and "Remove lane"
sit on the pool's own toolbar; each lane wears a title band down its leading
edge, inside the participant's own, with its name turned on its side — the way
BPMN 2.0 draws a lane. Double-clicking a title band renames what is written in
it, and the separator between two lanes is dragged to give one of them more
room. The lanes are DATA on the pool — how many there are, what they are called
and how the height is shared between them — so the background primitive paints
them and the audit reports an element's lane the same way it reports any other
zone.

A new lane arrives named `Lane 1`, `Lane 2`, and so on: a plain string written
into the document, exactly like the pool's own `Pool` default, and yours to
rewrite immediately. It is what makes the first "Add lane" click visible — a
titled band appears on a pool that had none.

The title band is chrome INSIDE the lane, not a gutter beside it: an element
dropped on a lane's band is in that lane, and naming a lane does not shrink its
share of the pool.

Renaming is now zoned. A double-click renames the band it landed in — the
participant in the pool's own strip, a lane in that lane's — and does nothing
on open canvas. Previously a double-click anywhere on the pool renamed the
participant, which with a name per lane would have made the flow area a
rename target for the one name that is not written there. The `text` cursor
over either band is what says where the names are.

The framework-background primitive grew the band placement to make this
possible (`BackgroundInstanceZonesDef.label.band`). It is purely additive: a
framework that declares no band keeps the corner placement it had, unchanged
down to the painting operation.

Nothing changes for a pool that has none. `lanes` is an optional field with no
default, so no key is written until the first lane exists: a document authored
before this release opens and paints byte for byte as it did, with no migration
and no schema version bump. Removing the last lane takes the key back out
rather than leaving an empty array, so a pool returns to exactly the bytes it
had. In the other direction, a pool WITH lanes opened by an older build keeps
them: unknown element props are preserved verbatim (#73), so the lanes survive
the round trip and are still there when the newer build opens the document
again.

Removing a lane moves nothing. An element is in a lane because its centre falls
in that band, so the lane below simply grows over whatever was drawn in the one
that went — nothing on the canvas jumps, and the sequence flows still land
where they were drawn.

The band placement, the default names and the zoned renaming all come from the
PO's visual recette of 2026-08-26, which replaced a first pass that wrote each
lane name across the lane's top-left corner.
