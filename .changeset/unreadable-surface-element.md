---
'@labre/std': minor
'@labre/affine-shared': minor
---

One canvas element the editor cannot read no longer empties the canvas (#669, ADR 0053). An element with no `type` or `id`, a `type` this version does not register (one a newer client wrote), or a model that throws while being built is now skipped, at load and on a remote update: every other element opens and stays editable, and the skipped element's data is left untouched in the document, so a client that can read it still sees it. Nothing is written on load. The surface reports it once through `damagedElements` / `elementDamaged` with two new `SurfaceDamageReason` values beside `missing-xywh`: `unknown-type` (most likely a newer client's element) and `unreadable` (a corrupt or half-written one); a host that switches on the reason exhaustively must handle them. `DocumentDamaged` widens its `reason` the same way and sends one event per reason in a batch, so a host's telemetry no longer counts these elements as `missing-xywh`. A canvas holding only skipped elements no longer reads as empty.
