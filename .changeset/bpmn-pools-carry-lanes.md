---
'@labre/affine-model': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine': patch
---

feat(blocks): a BPMN pool carries its lanes

A pool can now be divided into lanes (couloirs): "Add lane" and "Remove lane"
sit on the pool's own toolbar, a lane is named by double-clicking its top-left
corner, and the separator between two lanes is dragged to give one of them more
room. The lanes are DATA on the pool — how many there are, what they are called
and how the height is shared between them — so the background primitive paints
them and the audit reports an element's lane the same way it reports any other
zone.

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
