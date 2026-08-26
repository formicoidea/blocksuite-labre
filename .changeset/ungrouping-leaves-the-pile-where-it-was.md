---
'@labre/std': patch
'@labre/affine-gfx-group': patch
---

Ungrouping leaves the elements where they were in the pile

Ungrouping re-numbered every child with a fresh top-of-the-stack index, so a
group taken apart in the middle of a board jumped in front of everything drawn
above it. The children now inherit the slot the group itself occupied, and keep
their order within it; a board written by an older version, where that slot
cannot be expressed, falls back to the previous behaviour rather than refusing
the gesture.

Grouping and ungrouping also run as a single transaction each, so one undo
takes the whole gesture back, and the selection helper that answers "which of
these elements are the outermost ones" now walks each element up to the root
instead of comparing every pair.
