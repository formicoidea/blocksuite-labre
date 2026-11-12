---
'@labre/affine-block-list': patch
---

Importing or pasting indented HTML with `<ol start="N">` numbers its items N, N+1, N+2 again: the whitespace between two `<li>` was counted as an item, so `<ol start="3">` came in as 4, 6, 8. Lists without `start` are unchanged (the list block numbers them from 1).
