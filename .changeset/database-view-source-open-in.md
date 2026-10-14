---
'@labre/affine-model': minor
---

`ViewBasicDataType` (the stored shape every view of `affine:database` shares) gains two optional fields, ADR 0035 §8: `sourceId?: string`, the data source a view reads (absent: the block's own implicit source, which is every database stored today), and `openIn?: 'side' | 'center' | 'full'`, where the view opens a row (absent reads `side`). Both are `undefined` by default and never written on load, so every stored view stays valid and a 0.48 client ignores them. `DATABASE_VIEW_OPEN_IN` and `DatabaseViewOpenIn` are exported; the list is append-only. Nothing reads either field yet.
