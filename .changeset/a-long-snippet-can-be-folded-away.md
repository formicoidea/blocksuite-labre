---
'@labre/affine-block-code': patch
'@labre/affine-model': patch
---

A long code snippet can be folded away

A pasted stack trace or a whole config file took over the page: the code block
grew to the height of its content and pushed everything after it below the
fold, and the only way back was to delete lines.

The code toolbar now carries a collapse toggle. A folded block shows its first
eight lines and fades out into its own background; the language preview is
hidden while it is folded, and unfolding brings both back. The fold is written
onto the block, so it survives a reload and travels with the document — a block
that was never folded keeps no such state and loads exactly as before.
