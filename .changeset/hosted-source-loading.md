---
'@labre/affine': minor
---

A host may answer a view's source with `{ unavailable: 'loading' }` while the database it belongs to is not loaded yet. The view keeps its title and view bar and draws a spinner in place of its body, never "Connect a source" (labre recette of 2.4.1: a view of another database offered "Connect a source" until that database loaded, and a click there re-points the view away for good). A build that does not know the reason still reads it as no source.
