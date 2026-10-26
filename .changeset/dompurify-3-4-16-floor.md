---
'@labre/affine': patch
---

Raise the dompurify floor to ^3.4.16 (from ^3.4.13) for GHSA-p98j-92pf-mc4p. Same major; dompurify is a peer-level dependency hosts also import, so dedupe it to 3.4.16 or later on the host side.
