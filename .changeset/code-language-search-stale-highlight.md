---
'@labre/affine-components': patch
'@labre/affine-block-code': patch
---

The code block's language search now matches the display label as well as the
id and aliases, case-insensitively, ranking id and alias hits above label-only
hits, and no longer reorders the recently-used language list when the query is
empty. Switching language while a grammar is still loading no longer repaints
the block with the previous language's highlighting, and concurrent loads of
the same grammar share one request.
