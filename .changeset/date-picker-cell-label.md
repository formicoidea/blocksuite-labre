---
'@labre/affine-components': patch
---

A screen reader now reads a date picker day as a full date in the picker's
`locale` ("Tuesday, November 24, 2026" in `en-US`) instead of "2026-10-24(2)",
which gave the month one too low. The cell's `data-date` attribute is now an
ISO date (`2026-11-24`, zero-padded) instead of `2026-10-24(2)`. Fixes #736
(upstream toeverything/AFFiNE#15870).
