---
'@labre/affine-block-surface': patch
---

A whole-document snapshot (doc copy, template insertion, export / import) no
longer drops the `affine:surface` block's props other than `elements`: the
surface transformer now carries every other prop through both directions
unchanged, unknown keys included, so the user layers and the shared grid setting
of ADR 0031 survive a snapshot. Snapshots written before this fix load exactly
as before.
