---
'@labre/std': minor
'@labre/affine-shared': minor
---

One canvas element the editor cannot read no longer empties the canvas (#669, ADR 0053). Up to 4.0.0, an element whose `type` is missing or not registered (one a newer client wrote), or whose model throws while being built or mounted (a `mindmap` whose `children` hold a `null` node, written by an outside writer), stopped the surface from loading: the canvas opened empty, or a remote update threw. Such an element is now skipped, at load and on a remote update: every other element opens and stays editable, the skipped element's data is left untouched in the document, so a client that can read it still sees it, and nothing is written on load. It is reported once through `damagedElements` / `elementDamaged` with two new `SurfaceDamageReason` values beside `missing-xywh`: `unknown-type` (most likely a newer client's element) and `unreadable` (no type, not a map, or a model that threw); `getElementById` returns `null` for those keys. One console line per batch names the count and at most five keys, with what threw. The reasons are append-only: a host that switches on `reason` exhaustively gets a compile error and must add a default branch; treat it as an open string.

An element's identity is now its key in the surface's elements map (#681): an element stored without `id`, or with an `id` other than its key, mounts under its key, so `getElementById(key).id === key` and its events carry the key. Up to 4.0.0 its model id was `undefined`, and its first update could throw in the spatial index. The stored `id` is not rewritten.

Telemetry: `DocumentDamaged` widens its `reason` to `missing-xywh | unknown-type | unreadable` and is sent once per reason present in a batch; a document carrying only elements without geometry sends exactly what it sent before. A canvas holding only skipped elements no longer reads as empty, including when they arrive by sync.
