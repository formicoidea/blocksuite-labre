---
'@labre/affine-shared': patch
'@labre/std': patch
---

The editor reports `DocumentDamaged` on the telemetry bus when a document opens with elements that have no geometry, so the host can count damaged documents.
