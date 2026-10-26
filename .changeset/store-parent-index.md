---
'@labre/affine': patch
---

Opening a large document is now linear in the number of blocks, whatever the view (#507): parent lookups are indexed in memory instead of walking the tree each time, and the store records the blocks it loads in one step instead of copying its list once per block. Opening 4000 blocks drops from about 4.2 s to under 0.1 s, and from about 34 s to under 0.1 s when the view hides blocks. Nothing stored changes.
